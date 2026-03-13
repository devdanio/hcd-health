// This file imports Shopify orders and creates Purchase records

import { parse } from 'csv-parse/sync'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

import { DataSource } from '@/generated/prisma/enums'
import { prisma } from '@/server/db/client'
import {
  parseDollarsToCents,
  sanitizeEmail,
  sanitizePhone,
} from '@/utils/helpers'
import { InputJsonObject } from '@prisma/client/runtime/client'

// EHI company ID
const companyId = 'cmjq8rjqi0000doap08up0s41'

// Batch size for bulk operations to avoid transaction timeouts
const BATCH_SIZE = 100

interface CsvRow {
  Name: string
  Email: string
  'Financial Status': string
  'Paid at': string
  'Fulfillment Status': string
  'Fulfilled at': string
  'Accepts Marketing': string
  Currency: string
  Subtotal: string
  Shipping: string
  Taxes: string
  Total: string
  'Discount Code': string
  'Discount Amount': string
  'Shipping Method': string
  'Created at': string
  'Lineitem quantity': string
  'Lineitem name': string
  'Lineitem price': string
  'Lineitem compare at price': string
  'Lineitem sku': string
  'Lineitem requires shipping': string
  'Lineitem taxable': string
  'Lineitem fulfillment status': string
  'Billing Name': string
  'Billing Street': string
  'Billing Address1': string
  'Billing Address2': string
  'Billing Company': string
  'Billing City': string
  'Billing Zip': string
  'Billing Province': string
  'Billing Country': string
  'Billing Phone': string
  'Shipping Name': string
  'Shipping Street': string
  'Shipping Address1': string
  'Shipping Address2': string
  'Shipping Company': string
  'Shipping City': string
  'Shipping Zip': string
  'Shipping Province': string
  'Shipping Country': string
  'Shipping Phone': string
  Notes: string
  'Note Attributes': string
  'Cancelled at': string
  'Payment Method': string
  'Payment Reference': string
  'Refunded Amount': string
  Vendor: string
  'Outstanding Balance': string
  Employee: string
  Location: string
  'Device ID': string
  Id: string
  Tags: string
  'Risk Level': string
  Source: string
  'Lineitem discount': string
  'Tax 1 Name': string
  'Tax 1 Value': string
  'Tax 2 Name': string
  'Tax 2 Value': string
  'Tax 3 Name': string
  'Tax 3 Value': string
  'Tax 4 Name': string
  'Tax 4 Value': string
  'Tax 5 Name': string
  'Tax 5 Value': string
  Phone: string
  'Receipt Number': string
  Duties: string
  'Billing Province Name': string
  'Shipping Province Name': string
  'Payment ID': string
  'Payment Terms Name': string
  'Next Payment Due At': string
  'Payment References': string
}

interface OrderData {
  orderName: string
  email: string
  phone: string
  shippingPhone: string
  billingPhone: string
  amountInCents: number
  createdAt: Date
  rawData: Record<string, unknown>
}

/**
 * Parse date string to Date object
 * Example: "2025-12-28 22:40:00 -0500" -> Date
 */
function parseDate(dateStr: string): Date {
  return new Date(dateStr)
}

/**
 * Upsert purchases from a batch of order data
 */
async function upsertPurchases(
  ordersBatch: Map<string, OrderData>,
  batchNumber: number,
  totalBatches: number,
) {
  console.log(
    `[SHOPIFY PAYMENTS] Processing batch ${batchNumber}/${totalBatches} (${ordersBatch.size} orders)...`,
  )

  let purchasesCreated = 0
  const unmatchedOrders: Array<{
    orderName: string
    email: string
    phone: string
    shippingPhone: string
    billingPhone: string
    reason: string
  }> = []

  // Step 1: Collect all emails and phones to look up
  const emailsToCheck: string[] = []
  const phonesToCheck: string[] = []

  for (const orderData of ordersBatch.values()) {
    const sanitizedEmail = sanitizeEmail(orderData.email)
    if (sanitizedEmail) {
      emailsToCheck.push(sanitizedEmail)
    }

    const sanitizedPhone = sanitizePhone(orderData.phone)
    const sanitizedShippingPhone = sanitizePhone(orderData.shippingPhone)
    const sanitizedBillingPhone = sanitizePhone(orderData.billingPhone)

    if (sanitizedPhone) phonesToCheck.push(sanitizedPhone)
    if (sanitizedShippingPhone) phonesToCheck.push(sanitizedShippingPhone)
    if (sanitizedBillingPhone) phonesToCheck.push(sanitizedBillingPhone)
  }

  // Step 2: Query for Shopify profiles by email or phone
  const shopifyProfiles = await prisma.profile.findMany({
    where: {
      source: DataSource.SHOPIFY,
      person: {
        company_id: companyId,
      },
      OR: [{ email: { in: emailsToCheck } }, { phone: { in: phonesToCheck } }],
    },
    select: {
      person_id: true,
      email: true,
      phone: true,
    },
  })

  // Step 3: Build lookup maps
  const personIdByEmail = new Map(
    shopifyProfiles.filter((p) => p.email).map((p) => [p.email!, p.person_id]),
  )
  const personIdByPhone = new Map(
    shopifyProfiles.filter((p) => p.phone).map((p) => [p.phone!, p.person_id]),
  )

  // Step 4: Match orders to persons and prepare purchases
  const purchasesToCreate: Array<{
    personId: string
    orderData: OrderData
  }> = []

  for (const [orderName, orderData] of ordersBatch) {
    let personId: string | undefined

    // Try to match by email first
    const sanitizedEmail = sanitizeEmail(orderData.email)
    if (sanitizedEmail && personIdByEmail.has(sanitizedEmail)) {
      personId = personIdByEmail.get(sanitizedEmail)
    }

    // Try to match by phones if not found by email
    if (!personId) {
      const phonesToTry = [
        sanitizePhone(orderData.phone),
        sanitizePhone(orderData.shippingPhone),
        sanitizePhone(orderData.billingPhone),
      ].filter((p) => p !== undefined) as string[]

      for (const phone of phonesToTry) {
        if (personIdByPhone.has(phone)) {
          personId = personIdByPhone.get(phone)
          break
        }
      }
    }

    if (personId) {
      purchasesToCreate.push({ personId, orderData })
    } else {
      unmatchedOrders.push({
        orderName,
        email: orderData.email,
        phone: orderData.phone,
        shippingPhone: orderData.shippingPhone,
        billingPhone: orderData.billingPhone,
        reason: 'No matching Shopify profile found',
      })
    }
  }

  // Step 5: Create purchases
  if (purchasesToCreate.length > 0) {
    await prisma.purchase.createMany({
      data: purchasesToCreate.map(({ personId, orderData }) => ({
        person_id: personId,
        source: DataSource.SHOPIFY,
        external_id: orderData.orderName,
        amount_in_cents: orderData.amountInCents,
        currency: 'USD',
        purchased_at: orderData.createdAt,
        metadata: orderData.rawData as unknown as InputJsonObject,
      })),
      skipDuplicates: true,
    })

    purchasesCreated = purchasesToCreate.length
  }

  return {
    purchasesCreated,
    unmatchedOrders,
  }
}

async function main() {
  console.log('[SHOPIFY PAYMENTS] Starting import process...')

  // Read and parse CSV file
  const csvPath = join(__dirname, 'shopify_orders_dec_29_2025.csv')
  const fileContent = readFileSync(csvPath, 'utf-8')

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[]

  console.log(`[SHOPIFY PAYMENTS] Parsed ${records.length} order records`)

  // ============================================================================
  // PHASE 1: Load data and create map (only fulfilled orders)
  // ============================================================================

  const ordersMap = new Map<string, OrderData>()
  let skippedUnfulfilled = 0
  let skippedInvalidAmount = 0

  for (const row of records) {
    const orderName = row['Name']

    if (!orderName) continue

    // Only process fulfilled orders
    if (row['Fulfillment Status']?.toLowerCase() !== 'fulfilled') {
      skippedUnfulfilled++
      continue
    }

    // Parse amount
    const amountInCents = parseDollarsToCents(row['Total'])
    if (amountInCents === null) {
      skippedInvalidAmount++
      continue
    }

    ordersMap.set(orderName, {
      orderName,
      email: sanitizeEmail(row['Email']) || '',
      phone: row['Phone'] || '',
      shippingPhone: row['Shipping Phone'] || '',
      billingPhone: row['Billing Phone'] || '',
      amountInCents,
      createdAt: parseDate(row['Created at']),
      rawData: row as unknown as Record<string, unknown>,
    })
  }

  console.log(`[SHOPIFY PAYMENTS] Loaded ${ordersMap.size} fulfilled orders`)
  console.log(
    `[SHOPIFY PAYMENTS] Skipped ${skippedUnfulfilled} unfulfilled orders`,
  )
  console.log(
    `[SHOPIFY PAYMENTS] Skipped ${skippedInvalidAmount} orders with invalid amounts`,
  )

  // ============================================================================
  // PHASE 2: Create Purchase records in batches
  // ============================================================================

  console.log('[SHOPIFY PAYMENTS] Starting purchase creation...')

  const allOrders = Array.from(ordersMap.entries())
  const totalBatches = Math.ceil(allOrders.length / BATCH_SIZE)
  let totalPurchasesCreated = 0
  const allUnmatchedOrders: Array<{
    orderName: string
    email: string
    phone: string
    shippingPhone: string
    billingPhone: string
    reason: string
  }> = []

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, allOrders.length)
    const batch = allOrders.slice(start, end)

    // Convert batch array back to Map
    const batchMap = new Map(batch)

    const { purchasesCreated, unmatchedOrders } = await upsertPurchases(
      batchMap,
      i + 1,
      totalBatches,
    )

    totalPurchasesCreated += purchasesCreated
    allUnmatchedOrders.push(...unmatchedOrders)
  }

  // ============================================================================
  // Write unmatched orders to file for inspection
  // ============================================================================

  if (allUnmatchedOrders.length > 0) {
    const unmatchedPath = join(__dirname, 'shopify_unmatched_orders.json')
    writeFileSync(unmatchedPath, JSON.stringify(allUnmatchedOrders, null, 2))
    console.log(
      `[SHOPIFY PAYMENTS] Wrote ${allUnmatchedOrders.length} unmatched orders to shopify_unmatched_orders.json`,
    )
  }

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('\n[SHOPIFY PAYMENTS] Import complete!')
  console.log(`- Purchases created: ${totalPurchasesCreated}`)
  console.log(`- Unmatched orders: ${allUnmatchedOrders.length}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('[SHOPIFY PAYMENTS] Fatal error:', error)

  prisma.$disconnect()
  process.exit(1)
})
