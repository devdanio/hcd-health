// This file expects the payment transactions. It will loop over every payment as an upsert and insert new payments and create contacts as needed.

import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { join } from 'path'

import { DataSource } from '@/generated/prisma/enums'
import { prisma } from '@/server/db/client'

// EHI company ID
const companyId = 'cmjq8rjqi0000doap08up0s41'

// Batch size for bulk operations to avoid transaction timeouts
const BULK_WRITE_SIZE = 100

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

interface ContactData {
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
}

interface PaymentData {
  paymentName: string
  invoice: string
  amountInCents: number
  paymentDate: Date
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

/**
 * Upsert person and profile records from contact data using batch operations
 */
async function upsertPeople(contactsMap: Map<string, ContactData>) {
  console.log('[JASMINE IMPORT] Phase 1: Creating persons and profiles...')

  const personIdMap = new Map<string, string>() // contactId -> personId

  // Step 1: Bulk query all existing profiles by external_id
  const allContactIds = Array.from(contactsMap.keys())
  console.log(`[JASMINE IMPORT] Querying existing profiles...`)

  const existingProfiles = await prisma.profile.findMany({
    where: {
      source: DataSource.JASMINE,
      external_id: { in: allContactIds },
      person: {
        company_id: companyId,
      },
    },
    select: {
      external_id: true,
      person_id: true,
      person: {
        select: {
          id: true,
          email: true,
          phone: true,
        },
      },
    },
  })

  const existingProfileMap = new Map(
    existingProfiles.map((p) => [p.external_id, p]),
  )

  console.log(
    `[JASMINE IMPORT] Found ${existingProfiles.length} existing profiles`,
  )

  // Step 2: Identify contacts that need new persons/profiles
  const contactsNeedingProfiles: Array<{
    contactId: string
    contactData: ContactData
  }> = []

  for (const [contactId, contactData] of contactsMap) {
    if (existingProfileMap.has(contactId)) {
      const profile = existingProfileMap.get(contactId)!
      personIdMap.set(contactId, profile.person_id)
    } else {
      contactsNeedingProfiles.push({ contactId, contactData })
    }
  }

  console.log(
    `[JASMINE IMPORT] ${contactsNeedingProfiles.length} contacts need new profiles`,
  )

  if (contactsNeedingProfiles.length === 0) {
    return {
      personIdMap,
      personsCreated: 0,
      personsUpdated: existingProfiles.length,
    }
  }

  // Step 3: Check for existing persons by email/phone
  const emailsToCheck = contactsNeedingProfiles
    .map((c) => c.contactData.email)
    .filter((e) => e && e.trim() !== '')
  const phonesToCheck = contactsNeedingProfiles
    .map((c) => sanitizePhone(c.contactData.phone))
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

  console.log(
    `[JASMINE IMPORT] Found ${existingPersons.length} existing persons by email/phone`,
  )

  // Step 4: Separate into new persons vs existing persons
  const newPersonsToCreate: Array<{
    contactId: string
    contactData: ContactData
  }> = []
  const newProfilesToCreate: Array<{
    contactId: string
    personId: string
    contactData: ContactData
  }> = []

  for (const { contactId, contactData } of contactsNeedingProfiles) {
    const sanitizedPhone = sanitizePhone(contactData.phone)
    const email =
      contactData.email.trim() !== '' ? contactData.email : undefined

    let personId: string | undefined

    // Check if person exists by email or phone
    if (email && personByEmail.has(email)) {
      personId = personByEmail.get(email)
    } else if (sanitizedPhone && personByPhone.has(sanitizedPhone)) {
      personId = personByPhone.get(sanitizedPhone)
    }

    if (personId) {
      // Person exists, just need to create profile
      newProfilesToCreate.push({ contactId, personId, contactData })
      personIdMap.set(contactId, personId)
    } else {
      // Need to create new person
      newPersonsToCreate.push({ contactId, contactData })
    }
  }

  console.log(
    `[JASMINE IMPORT] Creating ${newPersonsToCreate.length} new persons...`,
  )
  console.log(
    `[JASMINE IMPORT] Creating ${newProfilesToCreate.length} profiles for existing persons...`,
  )

  // Step 5: Bulk create new persons in batches
  if (newPersonsToCreate.length > 0) {
    const totalBatches = Math.ceil(newPersonsToCreate.length / BULK_WRITE_SIZE)

    for (let i = 0; i < totalBatches; i++) {
      const start = i * BULK_WRITE_SIZE
      const end = Math.min(start + BULK_WRITE_SIZE, newPersonsToCreate.length)
      const batch = newPersonsToCreate.slice(start, end)

      console.log(
        `[JASMINE IMPORT] Creating persons batch ${i + 1}/${totalBatches} (${batch.length} records)...`,
      )

      const personsCreated = await prisma.$transaction(
        batch.map(({ contactData }) =>
          prisma.person.create({
            data: {
              company_id: companyId,
              first_name: contactData.firstName,
              last_name: contactData.lastName,
              email: contactData.email || undefined,
              phone: sanitizePhone(contactData.phone),
            },
          }),
        ),
      )

      // Map the created persons back to contact IDs
      personsCreated.forEach((person, index) => {
        const { contactId, contactData } = batch[index]
        personIdMap.set(contactId, person.id)
        newProfilesToCreate.push({
          contactId,
          personId: person.id,
          contactData,
        })
      })
    }
  }

  // Step 6: Bulk create all profiles in batches
  console.log(
    `[JASMINE IMPORT] Creating ${newProfilesToCreate.length} profiles...`,
  )

  if (newProfilesToCreate.length > 0) {
    const totalBatches = Math.ceil(newProfilesToCreate.length / BULK_WRITE_SIZE)

    for (let i = 0; i < totalBatches; i++) {
      const start = i * BULK_WRITE_SIZE
      const end = Math.min(start + BULK_WRITE_SIZE, newProfilesToCreate.length)
      const batch = newProfilesToCreate.slice(start, end)

      console.log(
        `[JASMINE IMPORT] Creating profiles batch ${i + 1}/${totalBatches} (${batch.length} records)...`,
      )

      await prisma.profile.createMany({
        data: batch.map(({ contactId, personId, contactData }) => ({
          person_id: personId,
          source: DataSource.JASMINE,
          external_id: contactId,
          first_name: contactData.firstName,
          last_name: contactData.lastName,
          email: contactData.email || undefined,
          phone: sanitizePhone(contactData.phone),
          gender: contactData.gender || undefined,
          city: contactData.city || undefined,
          state: contactData.state || undefined,
          country: contactData.country,
          external_created_at: contactData.createdDate,
        })),
        skipDuplicates: true,
      })
    }
  }

  console.log('[JASMINE IMPORT] Phase 1 complete!')
  console.log(`- Persons created: ${newPersonsToCreate.length}`)
  console.log(
    `- Persons updated/reused: ${contactsMap.size - newPersonsToCreate.length}`,
  )

  return {
    personIdMap,
    personsCreated: newPersonsToCreate.length,
    personsUpdated: contactsMap.size - newPersonsToCreate.length,
  }
}

/**
 * Bulk insert purchases for all persons in batches
 */
async function upsertPayments(
  paymentsMap: Map<string, PaymentData[]>,
  personIdMap: Map<string, string>,
) {
  console.log('[JASMINE IMPORT] Phase 2: Inserting purchases...')

  // Flatten all purchases into a single array
  const allPurchases: Array<{
    personId: string
    payment: PaymentData
  }> = []

  for (const [jasmineContactId, payments] of paymentsMap) {
    const personId = personIdMap.get(jasmineContactId)

    if (!personId) {
      console.warn(
        `[JASMINE IMPORT] No person found for contact ${jasmineContactId}, skipping ${payments.length} payments`,
      )
      continue
    }

    payments.forEach((payment) => {
      allPurchases.push({ personId, payment })
    })
  }

  console.log(
    `[JASMINE IMPORT] Total purchases to insert: ${allPurchases.length}`,
  )

  // Insert in batches
  let purchasesInserted = 0
  const totalBatches = Math.ceil(allPurchases.length / BULK_WRITE_SIZE)

  for (let i = 0; i < totalBatches; i++) {
    const start = i * BULK_WRITE_SIZE
    const end = Math.min(start + BULK_WRITE_SIZE, allPurchases.length)
    const batch = allPurchases.slice(start, end)

    console.log(
      `[JASMINE IMPORT] Inserting purchases batch ${i + 1}/${totalBatches} (${batch.length} records)...`,
    )

    try {
      await prisma.purchase.createMany({
        data: batch.map(({ personId, payment }) => ({
          person_id: personId,
          source: DataSource.JASMINE,
          external_id: payment.paymentName,
          amount_in_cents: payment.amountInCents,
          currency: 'USD',
          purchased_at: payment.paymentDate,
          metadata: {
            invoice: payment.invoice,
          },
        })),
        skipDuplicates: true,
      })

      purchasesInserted += batch.length
    } catch (error) {
      console.error(
        `[JASMINE IMPORT] Error inserting purchases batch ${i + 1}:`,
        error,
      )
      throw error
    }
  }

  console.log('[JASMINE IMPORT] Phase 2 complete!')
  console.log(`- Purchases inserted: ${purchasesInserted}`)

  return { purchasesInserted }
}

async function main() {
  console.log('[JASMINE IMPORT] Starting import process...')

  // Read and parse CSV file
  const csvPath = join(__dirname, 'jasmine-export-2025-12-23-09-26-11.csv')
  const fileContent = readFileSync(csvPath, 'utf-8')

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[]

  console.log(`[JASMINE IMPORT] Parsed ${records.length} payment records`)

  // ============================================================================
  // PHASE 1: Load data and create maps
  // ============================================================================

  const contactsMap = new Map<string, ContactData>()
  const paymentsMap = new Map<string, PaymentData[]>()
  const paymentErrors: Array<{
    contactId: string
    paymentName: string
    amount: string
    reason: string
  }> = []

  for (const row of records) {
    const contactId = row['Contact: Contact ID']

    // Build contact data (only once per contact)
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
      })
    }

    // Build payment data
    const amountInCents = parseDollarsToCents(row['Amount'])

    if (amountInCents === null) {
      paymentErrors.push({
        contactId,
        paymentName: row['Payment: Payment Name'],
        amount: row['Amount'] || 'EMPTY',
        reason: 'Missing or invalid amount',
      })
      continue
    }

    if (!paymentsMap.has(contactId)) {
      paymentsMap.set(contactId, [])
    }

    paymentsMap.get(contactId)!.push({
      paymentName: row['Payment: Payment Name'],
      invoice: row['Invoice'],
      amountInCents,
      paymentDate: parseDate(row['Payment Date']),
    })
  }

  console.log(
    `[JASMINE IMPORT] Loaded ${contactsMap.size} unique contacts and ${paymentsMap.size} contacts with payments`,
  )

  // ============================================================================
  // PHASE 2: Create Person + Profile records
  // ============================================================================

  const { personIdMap, personsCreated, personsUpdated } =
    await upsertPeople(contactsMap)

  // ============================================================================
  // PHASE 3: Bulk insert purchases
  // ============================================================================

  const { purchasesInserted } = await upsertPayments(paymentsMap, personIdMap)

  // ============================================================================
  // Summary
  // ============================================================================

  console.log('\n[JASMINE IMPORT] Import complete!')
  console.log(`- Persons created: ${personsCreated}`)
  console.log(`- Persons updated: ${personsUpdated}`)
  console.log(`- Purchases inserted: ${purchasesInserted}`)
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
