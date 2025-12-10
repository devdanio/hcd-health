import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
 * Convert a row object to CSV line, escaping values properly
 */
function rowToCSVLine(row: CSVRow): string {
  const values = [
    row['Patient Firstname'] || '',
    row['Patient Middlename'] || '',
    row['Patient Lastname'] || '',
    row['Patient DOB'] || '',
    row.Gender || '',
    row.Email || '',
    row['Phone Number'] || '',
    row['# of visits'] || '',
    row.Balance || '',
    row['Address Line 1'] || '',
    row['Address Line 2'] || '',
    row.City || '',
    row.State || '',
    row.Zip || '',
    row.Country || '',
    row['First Visit'] || '',
    row['Last Visit'] || '',
    row['Account Age'] || '',
  ]

  // Escape values that contain commas, quotes, or newlines
  return values
    .map((value) => {
      const stringValue = String(value)
      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    })
    .join(',')
}

async function main() {
  console.log('🚀 Starting patient CSV export process...\n')

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

  // CSV header
  const csvHeader = [
    'Patient Firstname',
    'Patient Middlename',
    'Patient Lastname',
    'Patient DOB',
    'Gender',
    'Email',
    'Phone Number',
    '# of visits',
    'Balance',
    'Address Line 1',
    'Address Line 2',
    'City',
    'State',
    'Zip',
    'Country',
    'First Visit',
    'Last Visit',
    'Account Age',
  ].join(',')

  // Build CSV content
  const csvLines = [csvHeader]
  for (const row of validRows) {
    csvLines.push(rowToCSVLine(row))
  }

  const csvContent = csvLines.join('\n')

  // Write to output CSV file
  const outputPath = join(__dirname, 'PatientSummary-processed.csv')
  fs.writeFileSync(outputPath, csvContent, 'utf-8')

  console.log('\n📊 Summary:')
  console.log(`   Total rows in CSV: ${records.length}`)
  console.log(`   Valid rows: ${validRows.length}`)
  console.log(`   Output file: ${outputPath}`)

  console.log('\n✅ Done!')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
