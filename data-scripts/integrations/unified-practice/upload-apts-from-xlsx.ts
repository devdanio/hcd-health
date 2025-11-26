/**
 * Parse Unified Practice clinic activity Excel exports
 *
 * This script parses paom-ClinicActivity-11_15_2025.xlsx and extracts appointment data.
 * It searches for the header row and parses all data until the first blank row.
 * Then uploads the appointments to Convex.
 */
import XLSX from 'xlsx'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { config } from 'dotenv'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../../convex/_generated/api'
import { Id } from '../../../convex/_generated/dataModel'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env.local from project root
config({ path: join(__dirname, '../../../.env.local') })

const convex = new ConvexHttpClient(process.env.VITE_CONVEX_URL!)
const paomConvexId = 'k57b750v8kpvhp563zztq8tp057vgypq' as Id<'companies'>

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
 * Normalize service name to match schema enum
 */
function normalizeService(service: string): 'acupuncture' | 'consultation' {
  const normalized = service.toLowerCase().trim()
  if (normalized.includes('acupuncture')) {
    return 'acupuncture'
  }
  if (normalized.includes('consultation') || normalized.includes('consult')) {
    return 'consultation'
  }
  // Default to acupuncture if we can't determine
  return 'acupuncture'
}

async function main() {
  try {
    const filePath = join(__dirname, 'paom-ClinicActivity-11_15_2025.xlsx')

    console.log(`Parsing file: ${filePath}`)

    const appointments = parseExcelFile(filePath)

    console.log(`\nSuccessfully parsed ${appointments.length} appointments`)
    console.log('\nFirst 3 records:')
    console.log(JSON.stringify(appointments.slice(0, 3), null, 2))

    console.log('\nSample record structure:')
    if (appointments.length > 0) {
      console.log(Object.keys(appointments[0]))
    }

    // Upload appointments to Convex
    console.log(
      `\n\nUploading ${appointments.length} appointments to Convex...`,
    )

    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < appointments.length; i++) {
      const apt = appointments[i]

      try {
        // TODO: This script needs to be updated to create/find contacts first
        // Skip for now - use chirotouch import instead
        throw new Error(
          'This script is deprecated - use chirotouch import script instead',
        )

        /* await convex.mutation(api.appointments.createAppointment, {
          companyId: paomConvexId,
          contactId: '' as any, // TODO: Need to create/find contact first
          patientName: apt.Patient || 'Unknown',
          dateOfService: apt['Date of Service'] || undefined,
          dateOfService: undefined, // TODO: Parse date to timestamp
          service: normalizeService(apt.Service),
        }) */

        successCount++

        // Log progress every 100 appointments
        if ((i + 1) % 100 === 0) {
          console.log(`Progress: ${i + 1}/${appointments.length} uploaded`)
        }
      } catch (error) {
        errorCount++
        console.error(
          `❌ Failed to upload appointment ${i + 1}:`,
          error instanceof Error ? error.message : String(error),
        )
      }
    }

    console.log(`\n📊 Upload Summary:`)
    console.log(`✅ Successfully uploaded: ${successCount}`)
    console.log(`❌ Failed: ${errorCount}`)
    console.log(`📝 Total processed: ${appointments.length}`)

    return appointments
  } catch (error) {
    console.error(
      'Error parsing Excel file:',
      error instanceof Error ? error.message : String(error),
    )
    process.exit(1)
  }
}

// Run the script
main()
