import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'
import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const PAOM_COMPANY_ID = 'cmijjrb0j0000i2apq31ubh28'

const connectionString = `${process.env.DATABASE_URL}`
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

interface CSVRow {
  'Patient Firstname': string
  'Patient Middlename': string
  'Patient Lastname': string
  'Patient DOB': string
  Gender: string
  Email: string
  'Phone Number': string
  '# of visits': string
  Balance: string
  'Address Line 1': string
  'Address Line 2': string
  City: string
  State: string
  Zip: string
  Country: string
  'First Visit': string
  'Last Visit': string
  'Account Age': string
}

/**
 * Clean phone number - remove all non-numeric characters
 */
function cleanPhoneNumber(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Parse date string to Date object
 * Handles formats like "10/21/1977" or "N/A"
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr === 'N/A' || dateStr.trim() === '') {
    return null
  }

  try {
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * Check if a row has valid data (not a placeholder or invalid row)
 */
function isValidRow(row: CSVRow): boolean {
  const firstName = row['Patient Firstname']?.trim()
  const lastName = row['Patient Lastname']?.trim()

  // Skip rows with no name or placeholder names
  if (!firstName || !lastName) return false
  if (firstName.includes('***') || lastName.includes('***')) return false
  if (firstName === 'N/A' || lastName === 'N/A') return false

  return true
}

/**
 * Upsert a single patient record
 */
async function upsertPatient(row: CSVRow) {
  const firstName = row['Patient Firstname']?.trim() || null
  const lastName = row['Patient Lastname']?.trim() || null
  const email = row.Email?.trim() || null
  const rawPhone = row['Phone Number']?.trim() || null
  const phone = rawPhone ? cleanPhoneNumber(rawPhone) : null
  const gender = row.Gender?.trim() || null
  const dateOfBirth = parseDate(row['Patient DOB'])
  const address1 = row['Address Line 1']?.trim() || null
  const address2 = row['Address Line 2']?.trim() || null
  const city = row.City?.trim() || null
  const state = row.State?.trim() || null
  const zip = row.Zip?.trim() || null

  // Create fullName
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

  console.log(
    `Processing: ${fullName} (${email || 'no email'} / ${phone || 'no phone'})`,
  )

  // Skip if no email and no phone
  if (!email && !phone) {
    console.log('  ⚠️  Skipping - no email or phone')
    return
  }

  try {
    // Step 1: Find or create contact
    // Try to find existing contact by phone or email
    let contact = null

    if (phone || email) {
      contact = await prisma.contact.findFirst({
        where: {
          companyId: PAOM_COMPANY_ID,
          OR: [
            phone ? { phone } : { id: '' }, // Use impossible ID if no phone
            email ? { email } : { id: '' }, // Use impossible ID if no email
          ].filter((condition) => condition.id !== ''), // Remove impossible conditions
        },
        include: {
          patient: true,
        },
      })
    }

    if (contact) {
      // Update existing contact
      console.log(`  ✓ Found existing contact (${contact.id})`)
      contact = await prisma.contact.update({
        where: { id: contact.id },
        data: {
          firstName,
          lastName,
          fullName,
          email: email || contact.email,
          phone: phone || contact.phone,
          gender,
          dateOfBirth,
        },
        include: {
          patient: true,
        },
      })
      console.log(`  ✓ Updated contact`)
    } else {
      // Create new contact
      console.log(`  + Creating new contact`)
      contact = await prisma.contact.create({
        data: {
          companyId: PAOM_COMPANY_ID,
          firstName,
          lastName,
          fullName,
          email,
          phone,
          gender,
          dateOfBirth,
        },
        include: {
          patient: true,
        },
      })
      console.log(`  ✓ Created new contact (${contact.id})`)
    }

    // Step 2: Upsert patient record
    if (contact.patient) {
      // Update existing patient
      console.log(`  ✓ Found existing patient - updating`)
      await prisma.patient.update({
        where: { id: contact.patient.id },
        data: {
          address1,
          address2,
          city,
          state,
          zip,
        },
      })
      console.log(`  ✓ Updated patient`)
    } else {
      // Create new patient
      console.log(`  + Creating new patient`)
      await prisma.patient.create({
        data: {
          contactId: contact.id,
          address1,
          address2,
          city,
          state,
          zip,
        },
      })
      console.log(`  ✓ Created new patient`)
    }

    console.log(`  ✅ Successfully processed ${fullName}`)
  } catch (error) {
    console.error(`  ❌ Error processing ${fullName}:`, error)
    throw error
  }
}

async function main() {
  console.log('🚀 Starting patient upsert process...\n')

  // Read and parse CSV file
  const csvPath = join(__dirname, 'PatientSummary-11_29_2025.csv')
  const fileContent = fs.readFileSync(csvPath, 'utf-8')

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    escape: '\\',
    from_line: 3, // Skip the title row and blank line, start from the header row
  }) as CSVRow[]

  console.log(`📄 Found ${records.length} total rows in CSV\n`)

  // Filter valid rows
  const validRows = records.filter(isValidRow)
  console.log(`✓ ${validRows.length} valid patient rows to process\n`)
  console.log('─'.repeat(60))

  let processed = 0
  let errors = 0

  for (const row of validRows) {
    try {
      await upsertPatient(row)
      processed++
    } catch (error) {
      errors++
      console.error('Error:', error)
    }
    console.log('─'.repeat(60))
  }

  console.log('\n📊 Summary:')
  console.log(`   Total rows in CSV: ${records.length}`)
  console.log(`   Valid rows: ${validRows.length}`)
  console.log(`   Successfully processed: ${processed}`)
  console.log(`   Errors: ${errors}`)

  await prisma.$disconnect()
  console.log('\n✅ Done!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
