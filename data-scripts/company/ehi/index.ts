// This file expects the payment transactions. It will loop over every payment as an upsert and insert new payments and create contacts as needed.

import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { join } from 'path'

import { prisma } from '@/server/db/client'
import { ExternalIdSource, PaymentStatus } from '@/generated/prisma/enums'

// EHI company ID
const companyId = 'cmjblu3mh000004kv8seh2wfr'
// Localhost
// const companyId = 'cmjjfxrk900000bap12gn7d4n'

interface CsvRow {
  'Payment: Payment Name': string
  'Contact: Last Name': string
  Invoice: string
  'Contact: Phone': string
  'Contact: Email': string
  Amount: string
  'Contact: Contact ID': string
  'Contact: Created Date': string
  'Contact: Mailing City': string
  'Contact: Mailing State/Province': string
  'Contact: Mailing Country': string
  'Contact: Age': string
  'Contact: Gender': string
  'Contact: First Name': string
  'Payment Date': string
}

interface GroupedPayment {
  paymentName: string
  invoice: string
  amountInCents: number | null
  amountOriginal: string
  postedDate: Date
}

interface PaymentError {
  contactId: string
  paymentName: string
  invoice: string
  amount: string
  reason: string
}

interface GroupedContact {
  contactId: string
  firstName: string
  lastName: string
  email: string
  phone: string
  city: string
  state: string
  country: string
  age: number | null
  gender: string
  createdDate: Date
  payments: GroupedPayment[]
}

/**
 * Sanitize phone number by removing all non-numeric characters
 */
function sanitizePhone(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined
  const sanitized = phone.replace(/\D/g, '')
  return sanitized.length > 0 ? sanitized : undefined
}

/**
 * Parse dollar amount string to cents
 * Example: "$1,938.47" -> 193847
 * Returns null if invalid
 */
function parseDollarsToCents(amount: string): number | null {
  if (!amount || amount.trim() === '') return null
  // Remove dollar sign, commas, and parse as float
  const cleaned = amount.replace(/[$,]/g, '')
  const dollars = parseFloat(cleaned)
  if (isNaN(dollars)) return null
  return Math.round(dollars * 100)
}

/**
 * Parse date string to Date object
 * Example: "12/20/2018" -> Date
 */
function parseDate(dateStr: string): Date {
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const [month, day, year] = parts
    return new Date(`${year}-${month}-${day}`)
  }
  return new Date(dateStr)
}

async function main() {
  console.log('[JASMINE IMPORT] Starting import process...')

  debugger
  // Read and parse CSV file
  const csvPath = join(__dirname, 'jasmine-export-2025-12-23-09-26-11.csv')
  const fileContent = readFileSync(csvPath, 'utf-8')

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[]

  console.log(`[JASMINE IMPORT] Parsed ${records.length} payment records`)

  // Group payments by Contact ID
  const contactsMap = new Map<string, GroupedContact>()
  const paymentErrors: PaymentError[] = []

  for (const row of records) {
    const contactId = row['Contact: Contact ID']

    if (!contactsMap.has(contactId)) {
      contactsMap.set(contactId, {
        contactId,
        firstName: row['Contact: First Name'],
        lastName: row['Contact: Last Name'],
        email: row['Contact: Email'] || '',
        phone: row['Contact: Phone'] || '',
        city: row['Contact: Mailing City'] || '',
        state: row['Contact: Mailing State/Province'] || '',
        country: row['Contact: Mailing Country'] || '',
        age: row['Contact: Age'] ? parseInt(row['Contact: Age']) : null,
        gender: row['Contact: Gender'] || '',
        createdDate: parseDate(row['Contact: Created Date']),
        payments: [],
      })
    }

    const contact = contactsMap.get(contactId)!
    const amountInCents = parseDollarsToCents(row['Amount'])

    contact.payments.push({
      paymentName: row['Payment: Payment Name'],
      invoice: row['Invoice'],
      amountInCents,
      amountOriginal: row['Amount'],
      postedDate: parseDate(row['Payment Date']),
    })
  }

  console.log(
    `[JASMINE IMPORT] Grouped into ${contactsMap.size} unique contacts`,
  )

  // Process each contact
  let contactsCreated = 0
  let contactsUpdated = 0
  let paymentsInserted = 0

  for (const [jasmineContactId, groupedContact] of contactsMap) {
    try {
      // Look up contact by JASMINE external ID
      let existingExternalId = await prisma.externalId.findFirst({
        where: {
          externalId: jasmineContactId,
          source: ExternalIdSource.JASMINE,
        },
        include: {
          contact: true,
        },
      })

      let contact

      // If not found by external ID, try by phone or email
      if (!existingExternalId) {
        const sanitizedPhone = sanitizePhone(groupedContact.phone)
        const email =
          groupedContact.email.trim() !== '' ? groupedContact.email : undefined

        if (sanitizedPhone || email) {
          const whereConditions = []
          if (sanitizedPhone) {
            whereConditions.push({ phone: sanitizedPhone })
          }
          if (email) {
            whereConditions.push({ email })
          }

          contact = await prisma.contact.findFirst({
            where: {
              companyId,
              OR: whereConditions,
            },
          })
        }
      } else if (existingExternalId.contact.companyId === companyId) {
        contact = existingExternalId.contact
      }

      if (contact) {
        // Contact exists - update it
        console.log(`[JASMINE IMPORT] Updating contact ${jasmineContactId}`)

        // Filter out payments with missing amounts and track errors
        const validPayments = groupedContact.payments.filter((payment) => {
          if (payment.amountInCents === null) {
            paymentErrors.push({
              contactId: jasmineContactId,
              paymentName: payment.paymentName,
              invoice: payment.invoice,
              amount: payment.amountOriginal || 'EMPTY',
              reason: 'Missing or invalid amount',
            })
            return false
          }
          return true
        })

        if (validPayments.length > 0) {
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              firstName: groupedContact.firstName,
              lastName: groupedContact.lastName,
              email: groupedContact.email || undefined,
              phone: sanitizePhone(groupedContact.phone),
              city: groupedContact.city || undefined,
              state: groupedContact.state || undefined,
              // Add external ID if it doesn't exist
              externalIds: existingExternalId
                ? undefined
                : {
                    create: {
                      externalId: jasmineContactId,
                      source: ExternalIdSource.JASMINE,
                    },
                  },
              // Create all payments
              payments: {
                createMany: {
                  data: validPayments.map((payment) => ({
                    externalId: payment.paymentName,
                    amountInCents: payment.amountInCents!,
                    posted_date: payment.postedDate,
                    status: PaymentStatus.posted,
                  })),
                  skipDuplicates: true,
                },
              },
            },
          })
          paymentsInserted += validPayments.length
        } else {
          // No valid payments, just update contact info
          await prisma.contact.update({
            where: { id: contact.id },
            data: {
              firstName: groupedContact.firstName,
              lastName: groupedContact.lastName,
              email: groupedContact.email || undefined,
              phone: sanitizePhone(groupedContact.phone),
              city: groupedContact.city || undefined,
              state: groupedContact.state || undefined,
              // Add external ID if it doesn't exist
              externalIds: existingExternalId
                ? undefined
                : {
                    create: {
                      externalId: jasmineContactId,
                      source: ExternalIdSource.JASMINE,
                    },
                  },
            },
          })
        }

        contactsUpdated++
      } else {
        // Contact doesn't exist - create it
        console.log(`[JASMINE IMPORT] Creating contact ${jasmineContactId}`)

        // Filter out payments with missing amounts and track errors
        const validPayments = groupedContact.payments.filter((payment) => {
          if (payment.amountInCents === null) {
            paymentErrors.push({
              contactId: jasmineContactId,
              paymentName: payment.paymentName,
              invoice: payment.invoice,
              amount: payment.amountOriginal || 'EMPTY',
              reason: 'Missing or invalid amount',
            })
            return false
          }
          return true
        })

        await prisma.contact.create({
          data: {
            firstName: groupedContact.firstName,
            lastName: groupedContact.lastName,
            email: groupedContact.email || undefined,
            phone: sanitizePhone(groupedContact.phone),
            city: groupedContact.city || undefined,
            state: groupedContact.state || undefined,
            firstSeenAt: groupedContact.createdDate,
            companyId,
            externalIds: {
              create: {
                externalId: jasmineContactId,
                source: ExternalIdSource.JASMINE,
              },
            },
            payments:
              validPayments.length > 0
                ? {
                    createMany: {
                      data: validPayments.map((payment) => ({
                        externalId: payment.paymentName,
                        amountInCents: payment.amountInCents!,
                        posted_date: payment.postedDate,
                        status: PaymentStatus.posted,
                      })),
                    },
                  }
                : undefined,
          },
        })

        contactsCreated++
        paymentsInserted += validPayments.length
      }
    } catch (error) {
      console.error(
        `[JASMINE IMPORT] Error processing contact ${jasmineContactId}:`,
        error,
      )
      throw error
    }
  }

  console.log('[JASMINE IMPORT] Import complete!')
  console.log(`- Contacts created: ${contactsCreated}`)
  console.log(`- Contacts updated: ${contactsUpdated}`)
  console.log(`- Payments inserted: ${paymentsInserted}`)
  console.log(`- Payment errors: ${paymentErrors.length}`)

  if (paymentErrors.length > 0) {
    console.log('\n[JASMINE IMPORT] Payment Errors:')
    console.log(JSON.stringify(paymentErrors, null, 2))
  }

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('[JASMINE IMPORT] Fatal error:', error)

  prisma.$disconnect()
  process.exit(1)
})
