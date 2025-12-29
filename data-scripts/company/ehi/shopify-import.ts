// This file imports Shopify customers and creates Person + Profile records

import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { join } from 'path'

import { DataSource } from '@/generated/prisma/enums'
import { prisma } from '@/server/db/client'
import { parseDollarsToCents, sanitizePhone } from '@/utils/helpers'

// EHI company ID
const companyId = 'cmjq8rjqi0000doap08up0s41'

// Batch size for bulk operations to avoid transaction timeouts
const BATCH_SIZE = 100

interface CsvRow {
  'Customer ID': string
  'First Name': string
  'Last Name': string
  Email: string
  'Accepts Email Marketing': string
  'Default Address Company': string
  'Default Address Address1': string
  'Default Address Address2': string
  'Default Address City': string
  'Default Address Province Code': string
  'Default Address Country Code': string
  'Default Address Zip': string
  'Default Address Phone': string
  Phone: string
  'Accepts SMS Marketing': string
  'Total Spent': string
  'Total Orders': string
  Note: string
  'Tax Exempt': string
  Tags: string
}

interface CustomerData {
  customerId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  acceptsEmailMarketing: boolean
  acceptsSmsMarketing: boolean
  totalSpent: number
  totalOrders: number
  address: {
    company?: string
    address1?: string
    address2?: string
    city?: string
    provinceCode?: string
    countryCode?: string
    zip?: string
    phone?: string
  }
  note?: string
  taxExempt: boolean
  tags?: string
}

/**
 * Upsert person and profile records from a batch of customer data
 */
async function upsertPeople(
  customersBatch: Map<string, CustomerData>,
  batchNumber: number,
  totalBatches: number,
) {
  console.log(
    `[SHOPIFY IMPORT] Processing batch ${batchNumber}/${totalBatches} (${customersBatch.size} customers)...`,
  )

  const personIdMap = new Map<string, string>() // customerId -> personId
  let personsCreated = 0
  let personsUpdated = 0

  // Step 1: Query existing profiles by external_id
  const allCustomerIds = Array.from(customersBatch.keys())

  const existingProfiles = await prisma.profile.findMany({
    where: {
      source: DataSource.SHOPIFY,
      external_id: { in: allCustomerIds },
      person: {
        company_id: companyId,
      },
    },
    select: {
      external_id: true,
      person_id: true,
    },
  })

  const existingProfileMap = new Map(
    existingProfiles.map((p) => [p.external_id, p]),
  )

  // Step 2: Identify customers that need new persons/profiles
  const customersNeedingProfiles: Array<{
    customerId: string
    customerData: CustomerData
  }> = []

  for (const [customerId, customerData] of customersBatch) {
    if (existingProfileMap.has(customerId)) {
      const profile = existingProfileMap.get(customerId)!
      personIdMap.set(customerId, profile.person_id)
      personsUpdated++
    } else {
      customersNeedingProfiles.push({ customerId, customerData })
    }
  }

  if (customersNeedingProfiles.length === 0) {
    return {
      personIdMap,
      personsCreated: 0,
      personsUpdated,
    }
  }

  // Step 3: Check for existing persons by email/phone
  const emailsToCheck = customersNeedingProfiles
    .map((c) => c.customerData.email)
    .filter((e) => e && e.trim() !== '')
  const phonesToCheck = customersNeedingProfiles
    .map((c) => sanitizePhone(c.customerData.phone))
    .filter((p) => p !== undefined) as string[]

  const existingPersons = await prisma.person.findMany({
    where: {
      company_id: companyId,
      OR: [{ email: { in: emailsToCheck } }, { phone: { in: phonesToCheck } }],
    },
    select: {
      id: true,
      email: true,
      phone: true,
    },
  })

  // Map by email and phone for quick lookup
  const personByEmail = new Map(
    existingPersons.filter((p) => p.email).map((p) => [p.email!, p.id]),
  )
  const personByPhone = new Map(
    existingPersons.filter((p) => p.phone).map((p) => [p.phone!, p.id]),
  )

  // Step 4: Separate into new persons vs existing persons
  const newPersonsToCreate: Array<{
    customerId: string
    customerData: CustomerData
  }> = []
  const newProfilesToCreate: Array<{
    customerId: string
    personId: string
    customerData: CustomerData
  }> = []

  for (const { customerId, customerData } of customersNeedingProfiles) {
    const sanitizedPhone = sanitizePhone(customerData.phone)
    const email =
      customerData.email.trim() !== '' ? customerData.email : undefined

    let personId: string | undefined

    // Check if person exists by email or phone
    if (email && personByEmail.has(email)) {
      personId = personByEmail.get(email)
    } else if (sanitizedPhone && personByPhone.has(sanitizedPhone)) {
      personId = personByPhone.get(sanitizedPhone)
    }

    if (personId) {
      // Person exists, just need to create profile
      newProfilesToCreate.push({ customerId, personId, customerData })
      personIdMap.set(customerId, personId)
    } else {
      // Need to create new person
      newPersonsToCreate.push({ customerId, customerData })
    }
  }

  // Step 5: Create new persons
  if (newPersonsToCreate.length > 0) {
    const personsCreatedBatch = await prisma.$transaction(
      newPersonsToCreate.map(({ customerData }) =>
        prisma.person.create({
          data: {
            company_id: companyId,
            first_name: customerData.firstName,
            last_name: customerData.lastName,
            email: customerData.email || undefined,
            phone: sanitizePhone(customerData.phone),
          },
        }),
      ),
    )

    // Map the created persons back to customer IDs
    personsCreatedBatch.forEach((person, index) => {
      const { customerId, customerData } = newPersonsToCreate[index]
      personIdMap.set(customerId, person.id)
      newProfilesToCreate.push({
        customerId,
        personId: person.id,
        customerData,
      })
    })

    personsCreated = newPersonsToCreate.length
  }

  // Step 6: Create all profiles
  if (newProfilesToCreate.length > 0) {
    await prisma.profile.createMany({
      data: newProfilesToCreate.map(
        ({ customerId, personId, customerData }) => ({
          person_id: personId,
          source: DataSource.SHOPIFY,
          external_id: customerId,
          first_name: customerData.firstName,
          last_name: customerData.lastName,
          email: customerData.email || undefined,
          phone: sanitizePhone(customerData.phone),
          city: customerData.address.city || undefined,
          state: customerData.address.provinceCode || undefined,
          address1: customerData.address.address1 || undefined,
          address2: customerData.address.address2 || undefined,
          zip: customerData.address.zip || undefined,
          country: customerData.address.countryCode || undefined,
          raw: {
            acceptsEmailMarketing: customerData.acceptsEmailMarketing,
            acceptsSmsMarketing: customerData.acceptsSmsMarketing,
            totalSpent: customerData.totalSpent,
            totalOrders: customerData.totalOrders,
            note: customerData.note,
            taxExempt: customerData.taxExempt,
            tags: customerData.tags,
          },
        }),
      ),
      skipDuplicates: true,
    })
  }

  return {
    personIdMap,
    personsCreated,
    personsUpdated,
  }
}

async function main() {
  console.log('[SHOPIFY IMPORT] Starting import process...')

  // Read and parse CSV file
  const csvPath = join(__dirname, 'shopify_customers_dec-29-2025.csv')
  const fileContent = readFileSync(csvPath, 'utf-8')

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[]

  console.log(`[SHOPIFY IMPORT] Parsed ${records.length} customer records`)

  // ============================================================================
  // PHASE 1: Load data and create map
  // ============================================================================

  const customersMap = new Map<string, CustomerData>()

  for (const row of records) {
    const customerId = row['Customer ID']

    if (!customerId) continue

    customersMap.set(customerId, {
      customerId,
      firstName: row['First Name'] || '',
      lastName: row['Last Name'] || '',
      email: row['Email'] || '',
      phone: row['Phone'] || row['Default Address Phone'] || '',
      acceptsEmailMarketing: row['Accepts Email Marketing'] === 'yes',
      acceptsSmsMarketing: row['Accepts SMS Marketing'] === 'yes',
      totalSpent: (parseDollarsToCents(row['Total Spent']) ?? 0) / 100, // Store as dollars
      totalOrders: parseInt(row['Total Orders']) || 0,
      address: {
        company: row['Default Address Company'] || undefined,
        address1: row['Default Address Address1'] || undefined,
        address2: row['Default Address Address2'] || undefined,
        city: row['Default Address City'] || undefined,
        provinceCode: row['Default Address Province Code'] || undefined,
        countryCode: row['Default Address Country Code'] || undefined,
        zip: row['Default Address Zip'] || undefined,
        phone: row['Default Address Phone'] || undefined,
      },
      note: row['Note'] || undefined,
      taxExempt: row['Tax Exempt'] === 'yes',
      tags: row['Tags'] || undefined,
    })
  }

  console.log(`[SHOPIFY IMPORT] Loaded ${customersMap.size} unique customers`)

  // ============================================================================
  // PHASE 2: Create Person + Profile records in batches
  // ============================================================================

  console.log('[SHOPIFY IMPORT] Starting person and profile creation...')

  const allCustomers = Array.from(customersMap.entries())
  const totalBatches = Math.ceil(allCustomers.length / BATCH_SIZE)
  let totalPersonsCreated = 0
  let totalPersonsUpdated = 0

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE
    const end = Math.min(start + BATCH_SIZE, allCustomers.length)
    const batch = allCustomers.slice(start, end)

    // Convert batch array back to Map
    const batchMap = new Map(batch)

    const { personsCreated, personsUpdated } = await upsertPeople(
      batchMap,
      i + 1,
      totalBatches,
    )

    totalPersonsCreated += personsCreated
    totalPersonsUpdated += personsUpdated
  }

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('\n[SHOPIFY IMPORT] Import complete!')
  console.log(`- Persons created: ${totalPersonsCreated}`)
  console.log(`- Persons updated: ${totalPersonsUpdated}`)

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('[SHOPIFY IMPORT] Fatal error:', error)

  prisma.$disconnect()
  process.exit(1)
})
