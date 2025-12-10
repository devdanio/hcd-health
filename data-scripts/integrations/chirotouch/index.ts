import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const connectionString = `${process.env.DATABASE_URL}`
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

interface CSVRow {
  'Account #': string
  Patient: string
  'Case Type': string
  'Birth Date': string
  'Charge Date': string
  'Charge Age': string
  Procedure: string
  Provider: string
  'Charge Amt': string
  'Insurance Balance': string
  'Charge Status': string
  'Policy Sequence': string
  Payer: string
  'Subscriber #': string
  'Plan Name': string
  'Plan #': string
  'First Billed Date': string
  'Last Billed Date': string
  'Last Paid Date': string
  'Paid Amount': string
  'Claim #': string
  'Bill Age': string
  'FollowUp Date': string
  'FollowUp Status': string
  'Next FollowUp Date': string
  'Note Date': string
  Note: string
  'Last Activity Date': string
  'Last Activity Age': string
  'Patient Responsibility': string
  'Patient Balance': string
  Adjustment: string
  'Patient Payment': string
}

/**
 * Parse patient name from "Last, First" format
 */
function parseName(patientName: string): {
  firstName: string
  lastName: string
} {
  const parts = patientName.split(',').map((p) => p.trim())
  return {
    lastName: parts[0] || '',
    firstName: parts[1] || '',
  }
}

/**
 * Parse date from M/D/YYYY format to Date object
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null

  // Handle datetime format "M/D/YYYY HH:MM:SS"
  const datePart = dateStr.split(' ')[0]
  const [month, day, year] = datePart.split('/')

  if (!month || !day || !year) return null

  return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
}

/**
 * Parse procedure code - extract just the code without modifiers
 */
function parseProcedureCode(procedure: string): string {
  // Extract code from formats like "97012 [GP]" or "99213 [25]"
  return procedure.split(' ')[0] || procedure
}

/**
 * Check if a row has valid data
 */
function isValidRow(row: CSVRow): boolean {
  return !!(
    row['Account #']?.trim() &&
    row.Patient?.trim() &&
    row.Procedure?.trim() &&
    row.Provider?.trim()
  )
}

async function main() {
  console.log('=� Starting ChiroTouch AR Insurance import...\n')

  // Get company ID from environment or use default
  const companyId = 'cmj0aw8zo0000xwapp9axlyqv'
  if (!companyId) {
    console.error('L Error: COMPANY_ID environment variable is required')
    process.exit(1)
  }

  // Verify company exists
  const company = await prisma.company.findUnique({
    where: { id: companyId },
  })

  if (!company) {
    console.error(`L Error: Company with ID ${companyId} not found`)
    process.exit(1)
  }

  console.log(` Processing data for company: ${company.name}\n`)

  // Read and parse CSV file
  const csvPath = join(__dirname, 'ar-insurance.csv')
  const fileContent = fs.readFileSync(csvPath, 'utf-8')

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
  }) as CSVRow[]

  console.log(`=� Found ${records.length} total rows in CSV\n`)

  // Filter valid rows
  const validRows = records.filter(isValidRow)
  console.log(` ${validRows.length} valid rows to process\n`)

  // Fetch all providers for this company
  const providers = await prisma.provider.findMany({
    where: { companyId },
    include: { service: true },
  })

  console.log(` Found ${providers.length} providers in database\n`)

  // Create a map of provider names to IDs for quick lookup
  const providerMap = new Map(
    providers.map((p) => [p.name.toLowerCase().trim(), p]),
  )

  let stats = {
    contactsCreated: 0,
    contactsUpdated: 0,
    appointmentsCreated: 0,
    proceduresCreated: 0,
    errors: 0,
    providersNotFound: new Set<string>(),
  }

  // Process each row
  for (const [index, row] of validRows.entries()) {
    try {
      const accountNumber = row['Account #'].trim()
      const { firstName, lastName } = parseName(row.Patient)
      const dateOfBirth = parseDate(row['Birth Date'])
      const chargeDate = parseDate(row['Charge Date'])
      const procedureCode = parseProcedureCode(row.Procedure)
      const chargeAmount = parseFloat(row['Charge Amt']) || 0
      const providerName = row.Provider.trim()
      const caseType = row['Case Type']?.trim() || null
      const payerName = row.Payer?.trim() || null

      // Upsert contact
      const existingContact = await prisma.contact.findUnique({
        where: { externalId: accountNumber },
      })

      let contact
      if (existingContact) {
        // Contact exists, optionally update it
        contact = await prisma.contact.update({
          where: { externalId: accountNumber },
          data: {
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            dateOfBirth,
            companyId,
          },
        })
        stats.contactsUpdated++
      } else {
        // Create new contact
        contact = await prisma.contact.create({
          data: {
            externalId: accountNumber,
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`,
            dateOfBirth,
            companyId,
          },
        })
        stats.contactsCreated++
      }

      // Find provider
      const provider = providerMap.get(providerName.toLowerCase())
      if (!provider) {
        stats.providersNotFound.add(providerName)
        console.warn(
          `�  Provider not found: "${providerName}" (row ${index + 2})`,
        )
        continue
      }

      // Find or create appointment for this date of service
      // We'll use the charge date as the date of service
      let appointment = chargeDate
        ? await prisma.appointment.findFirst({
            where: {
              companyId,
              contactId: contact.id,
              providerId: provider.id,
              dateOfService: chargeDate,
            },
          })
        : null

      if (!appointment && chargeDate) {
        appointment = await prisma.appointment.create({
          data: {
            companyId,
            contactId: contact.id,
            dateOfService: chargeDate,
            providerId: provider.id,
            serviceId: provider.serviceId,
          },
        })
        stats.appointmentsCreated++
      }

      // Create appointment procedure
      if (appointment) {
        await prisma.appointmentProcedure.create({
          data: {
            appointmentId: appointment.id,
            procedureCode,
            chargeAmount,
            caseType,
            payerName,
            chargeDate,
          },
        })
        stats.proceduresCreated++
      }

      // Log progress every 50 rows
      if ((index + 1) % 1000 === 0) {
        console.log(`=� Processed ${index + 1} / ${validRows.length} rows...`)
      }
    } catch (error) {
      stats.errors++
      console.error(`L Error processing row ${index + 2}:`, error)
      console.error(
        `   Account #: ${row['Account #']}, Patient: ${row.Patient}`,
      )
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('=� IMPORT SUMMARY')
  console.log('='.repeat(60))
  console.log(`   Total rows processed: ${validRows.length}`)
  console.log(`   Contacts created: ${stats.contactsCreated}`)
  console.log(`   Contacts updated: ${stats.contactsUpdated}`)
  console.log(`   Appointments created: ${stats.appointmentsCreated}`)
  console.log(`   Procedures created: ${stats.proceduresCreated}`)
  console.log(`   Errors: ${stats.errors}`)

  if (stats.providersNotFound.size > 0) {
    console.log('\n�  Providers not found in database:')
    stats.providersNotFound.forEach((name) => console.log(`   - ${name}`))
  }

  console.log('\n Import complete!')

  await prisma.$disconnect()
}

main().catch((error) => {
  console.error('Fatal error:', error)
  prisma.$disconnect()
  process.exit(1)
})
