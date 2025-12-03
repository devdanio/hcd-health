/**
 * Parse Unified Practice clinic activity Excel exports
 *
 * This script parses ClinicActivity-11_28_2025.xlsx and extracts appointment data.
 * It searches for the header row and parses all data until the first blank row.
 * Then creates appointments in the database.
 */
import XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../../src/generated/prisma/client'
import { cuid } from 'zod'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local from project root
config({ path: join(__dirname, '../../../.env.local') })

// Set up Prisma client
const connectionString = `${process.env.DATABASE_URL}`
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// Constants
const COMPANY_ID = 'cmijjrb0j0000i2apq31ubh28'
const PROVIDER_ID = 'cmiko2b670000sjapgytqk2tt'

// Column headers to look for in the exact order (from the Excel file)
const EXPECTED_HEADERS = [
  'Date of Service',
  'Patient',
  'Patient DoB',
  'Sale Type',
  'Service',
  'Total Charges',
  'Paid By Pt.',
  'Paid By Ins.',
  'Adjustment',
  'Amount Due',
] as const

export type AppointmentData = {
  'Date of Service': string
  Patient: string
  'Patient DoB': string
  'Sale Type': string
  Service: string
  'Total Charges': string | number
  'Paid By Pt.': string | number
  'Paid By Ins.': string | number
  Adjustment: string | number
  'Amount Due': string | number
}

/**
 * Parse Excel file and extract appointment data
 *
 * @param filePath - Path to the Excel file
 * @returns Array of appointment data objects
 */
export function parseExcelFile(filePath: string): AppointmentData[] {
  // Read the Excel file
  const workbook = XLSX.readFile(filePath)

  // Get the first sheet
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  // Convert sheet to array of arrays (preserves raw structure)
  const data = XLSX.utils.sheet_to_json<any[]>(worksheet, {
    header: 1, // Return array of arrays instead of objects
    raw: false, // Convert values to strings for easier parsing
  })

  // Search for the header row that matches our expected columns
  let headerRowIndex = -1
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    // Check if this row matches our expected headers exactly
    const matches = EXPECTED_HEADERS.every((header, index) => {
      return row[index] === header
    })

    if (matches) {
      headerRowIndex = i
      break
    }
  }

  if (headerRowIndex === -1) {
    throw new Error(
      `Could not find header row with expected columns: ${EXPECTED_HEADERS.join(', ')}`,
    )
  }

  console.log(`Found header row at index ${headerRowIndex}`)

  // Parse data rows until we hit the first blank row
  const results: AppointmentData[] = []

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i]

    // Check if this is a blank row (all cells are empty or undefined)
    if (!row || row.length === 0 || row.every((cell) => !cell)) {
      console.log(`Hit blank row at index ${i}, stopping parsing`)
      break
    }

    // Create object from row data using expected headers as keys
    const rowData: any = {}
    EXPECTED_HEADERS.forEach((header, index) => {
      rowData[header] = row[index] !== undefined ? row[index] : ''
    })

    results.push(rowData as AppointmentData)
  }

  return results
}

/**
 * Parse date string from Excel to Date object
 * Handles formats like "10/21/1977", "10/21/1977 12:00:00 AM", or Excel serial dates
 */
function parseDate(dateStr: string | number): Date | null {
  if (!dateStr) return null

  try {
    // If it's a number, it might be an Excel serial date
    if (typeof dateStr === 'number') {
      // Excel serial date: days since January 1, 1900
      const excelEpoch = new Date(1899, 11, 30) // December 30, 1899
      const date = new Date(
        excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000,
      )
      return isNaN(date.getTime()) ? null : date
    }

    // Try parsing as string date
    const str = String(dateStr).trim()
    if (!str || str === 'N/A' || str === '') {
      return null
    }

    // Remove time portion if present (e.g., "10/21/1977 12:00:00 AM")
    const datePart = str.split(' ')[0]
    const date = new Date(datePart)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

async function main() {
  try {
    const filePath = join(__dirname, 'ClinicActivity-11_29_2025.xlsx')

    console.log(`Parsing file: ${filePath}`)

    const appointments = parseExcelFile(filePath)

    console.log(`\nSuccessfully parsed ${appointments.length} appointments`)
    console.log('\nFirst 3 records:')
    console.log(JSON.stringify(appointments.slice(0, 3), null, 2))

    // Query services for the company
    console.log(`\n\nFetching services for company ${COMPANY_ID}...`)
    const services = await prisma.service.findMany({
      where: {
        companyId: COMPANY_ID,
      },
    })

    // Create a map of service name to serviceId for quick lookup
    const serviceMap = new Map<string, string>()
    services.forEach((service) => {
      serviceMap.set(service.name.trim(), service.id)
    })

    // Process appointments
    console.log(`\n\nProcessing ${appointments.length} appointments...`)

    let successCount = 0
    let errorCount = 0
    let skippedCount = 0

    for (const apt of appointments) {
      const patientName = apt.Patient?.trim()
      const dateOfServiceStr = apt['Date of Service']
      const serviceName = apt.Service?.trim()

      if (!patientName || !dateOfServiceStr || !serviceName) {
        console.log(
          `⚠️  Skipping row: No patient name, date of service, or service name`,
        )
        skippedCount++
        continue
      }

      const dateOfService = parseDate(dateOfServiceStr)
      if (!dateOfService) {
        console.log(`⚠️  Skipping row: Invalid date of service`)
        skippedCount++
        continue
      }

      let contact = await prisma.contact.findFirst({
        where: {
          companyId: COMPANY_ID,
          fullName: patientName,
        },
        include: {
          patient: true,
        },
      })

      if (!contact) {
        console.log(`⚠️  Creating new contact: ${patientName}`)
        contact = await prisma.contact.create({
          data: {
            companyId: COMPANY_ID,
            fullName: patientName,
            dateOfBirth: parseDate(apt['Patient DoB']) || undefined,
            patient: {
              create: {
                id: crypto.randomUUID(),
              },
            },
          },
          include: {
            patient: true,
          },
        })
      }

      let patient = contact.patient

      if (!patient) {
        patient = await prisma.patient.create({
          data: {
            contact: {
              connect: {
                id: contact.id,
              },
            },
          },
        })
      }

      const serviceId = serviceMap.get(serviceName)
      if (!serviceId) {
        console.log(
          `⚠️  Skipping row: Service "${serviceName}" not found in services table for ${patientName}`,
        )
        skippedCount++
        continue
      }

      console.log(
        `✅ Creating new appointment: ${patientName} on ${dateOfService} for service ${serviceName}`,
      )
      const appointment = await prisma.appointment.create({
        data: {
          companyId: COMPANY_ID,
          patientId: patient.id,
          dateOfService: dateOfService,
          providerId: PROVIDER_ID,
          serviceId: serviceId,
        },
      })
      successCount++

      console.log(
        `✅ Successfully created appointment: ${appointment.id} for ${patientName} on ${dateOfService}`,
      )
    }

    console.log(`\n📊 Upload Summary:`)
    console.log(`✅ Successfully created: ${successCount}`)
    console.log(`⚠️  Skipped: ${skippedCount}`)
    console.log(`❌ Failed: ${errorCount}`)
    console.log(`📝 Total processed: ${appointments.length}`)

    return appointments
  } catch (error) {
    console.error(
      'Error processing appointments:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
main()
