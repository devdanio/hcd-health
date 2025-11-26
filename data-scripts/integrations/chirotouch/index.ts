import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import csv from 'csv-parser'
import 'dotenv/config'
import { ConvexHttpClient } from 'convex/browser'
import { api } from 'convex/_generated/api'
import { Id } from 'convex/_generated/dataModel'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const csvFilePath = path.join(
  __dirname,
  'thrive-ar-insurance-pii-redacted-nov-20-2025.csv',
)

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)
const companyId = 'jx777b2jmrhtncf5jxnyt0781d7w0m1n' as Id<'companies'>

interface CSVRow {
  'Account #': string
  'Case Type': string
  'Charge Date': string
  'Charge Age': string
  Procedure: string
  Provider: string
  'Charge Amt': string
  'Insurance Balance': string
  'Charge Status': string
  'Policy Sequence': string
  Payer: string
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

interface Provider {
  _id: Id<'providers'>
  name: string
  service: Id<'services'>
  serviceId?: Id<'services'>
  providerId?: Id<'providers'>
}

// Parse date from "11/20/2025 16:00:00" format to Unix timestamp
function parseChargeDate(dateStr: string): number {
  if (!dateStr) return 0
  // Extract just the date part (before the space)
  const datePart = dateStr.split(' ')[0]
  // Parse MM/DD/YYYY to timestamp
  const [month, day, year] = datePart.split('/').map(Number)
  return new Date(year, month - 1, day).getTime()
}

async function main() {
  try {
    console.log('Starting CSV import process...\n')

    // Step 1: Fetch all providers
    console.log('Step 1: Fetching providers...')
    const providers = await convex.query(api.providers.list, { companyId })
    console.log(`Found ${providers.length} provider(s)\n`)

    // Create a map for quick lookup by provider name
    const providerMap = new Map<string, Provider>()
    for (const provider of providers) {
      providerMap.set(provider.name, {
        _id: provider._id,
        name: provider.name,
        service: provider.service,
        serviceId: provider.service,
        providerId: provider._id,
      })
    }

    console.log('Step 2: Reading CSV rows...\n')

    // Step 2: Read CSV into memory
    const rows: CSVRow[] = []
    await new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (row: CSVRow) => {
          rows.push(row)
        })
        .on('end', () => {
          resolve()
        })
        .on('error', (error) => {
          reject(error)
        })
    })

    console.log(`Loaded ${rows.length} rows from CSV\n`)

    // Step 3: Create all contacts in parallel
    console.log('Step 3: Creating contacts in parallel...')
    const uniqueAccountIds = new Set<string>()
    const contactPromises: Promise<Id<'contacts'>>[] = []
    const accountIdToPromiseIndex = new Map<string, number>()

    rows.forEach((row) => {
      const accountId = row['Account #']?.trim()
      if (accountId && !uniqueAccountIds.has(accountId)) {
        uniqueAccountIds.add(accountId)
        accountIdToPromiseIndex.set(accountId, contactPromises.length)
        contactPromises.push(
          convex.mutation(api.contacts.upsertContactByChirotouchAccountId, {
            companyId,
            chirotouchAccountId: accountId,
          }),
        )
      }
    })

    const contactIds = await Promise.all(contactPromises)
    const contactMap = new Map<string, Id<'contacts'>>()
    uniqueAccountIds.forEach((accountId) => {
      const index = accountIdToPromiseIndex.get(accountId)!
      contactMap.set(accountId, contactIds[index])
    })
    console.log(`✅ Created ${contactIds.length} contact(s)\n`)

    // Step 4: Create all appointments in parallel
    console.log('Step 4: Creating appointments in parallel...')
    const appointmentPromises: Promise<Id<'appointments'>>[] = []
    const appointmentKeys: string[] = []
    const seenAppointments = new Set<string>()

    rows.forEach((row, index) => {
      const accountId = row['Account #']?.trim()
      const chargeDate = row['Charge Date']?.trim()
      const providerName = row['Provider']?.trim()

      if (!accountId || !chargeDate) {
        return
      }

      const dateTimestamp = parseChargeDate(chargeDate)
      const appointmentKey = `${accountId}|${dateTimestamp}`

      if (!seenAppointments.has(appointmentKey)) {
        seenAppointments.add(appointmentKey)
        const contactId = contactMap.get(accountId)!
        const provider = providerMap.get(providerName)

        if (!provider && providerName) {
          console.warn(
            `⚠️  Row ${index + 1}: Provider "${providerName}" not found in providers list`,
          )
        }

        appointmentKeys.push(appointmentKey)
        appointmentPromises.push(
          convex.mutation(api.appointments.createAppointmentWithContact, {
            companyId,
            contactId,
            patientName: undefined,
            dateOfService: dateTimestamp,
            service: undefined,
            serviceId: provider?.serviceId,
            providerId: provider?.providerId,
          }),
        )
      }
    })

    const appointmentIds = await Promise.all(appointmentPromises)
    const appointmentMap = new Map<string, Id<'appointments'>>()
    appointmentKeys.forEach((key, index) => {
      appointmentMap.set(key, appointmentIds[index])
    })
    console.log(`✅ Created ${appointmentIds.length} appointment(s)\n`)

    // Step 5: Create all procedures in parallel
    console.log('Step 5: Creating appointment procedures in parallel...')
    const procedurePromises: Promise<Id<'appointmentProcedures'>>[] = []

    rows.forEach((row) => {
      const accountId = row['Account #']?.trim()
      const chargeDate = row['Charge Date']?.trim()
      const procedureCode = row['Procedure']?.trim()
      const chargeAmount = parseFloat(row['Charge Amt']?.trim() || '0')

      if (!accountId || !chargeDate) {
        return
      }

      const dateTimestamp = parseChargeDate(chargeDate)
      const appointmentKey = `${accountId}|${dateTimestamp}`
      const appointmentId = appointmentMap.get(appointmentKey)

      if (appointmentId && procedureCode && chargeAmount > 0) {
        procedurePromises.push(
          convex.mutation(api.appointments.createAppointmentProcedure, {
            appointmentId,
            procedureCode,
            chargeAmount,
          }),
        )
      }
    })

    const procedureIds = await Promise.all(procedurePromises)
    console.log(`✅ Created ${procedureIds.length} procedure(s)\n`)

    console.log(`\n✅ Import Complete!`)
    console.log(`📊 Summary:`)
    console.log(`   Total rows processed: ${rows.length}`)
    console.log(`   Contacts created/updated: ${contactIds.length}`)
    console.log(`   Appointments created: ${appointmentIds.length}`)
    console.log(`   Procedures created: ${procedureIds.length}`)
  } catch (error) {
    console.error(
      '❌ Error:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

main()
