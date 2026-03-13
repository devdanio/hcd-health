import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import xlsx from 'xlsx'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface PatientRecord {
  firstName: string
  lastName: string
  phone: number | null
  email: string | null
  firstAppt: string | null
  lastAppt: string | null
  patientBalance: number
  insuranceBalance: number
  accountBalance: number
}

type Row = (string | number | undefined)[]

function cellStr(row: Row, col: number): string {
  const val = row[col]
  if (val == null) return ''
  return String(val).trim()
}

function parseCurrency(str: string): number {
  if (!str) return 0
  const isNegative = str.includes('(') && str.includes(')')
  const cleaned = str.replace(/[($,)]/g, '').trim()
  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0
  return isNegative ? -num : num
}

function parsePhone(str: string): number | null {
  if (!str) return null
  // Strip everything except digits
  const digits = str.replace(/\D/g, '')
  if (digits.length < 7) return null
  return parseInt(digits, 10)
}

function parseDateField(str: string, prefix: string): string | null {
  if (!str) return null
  const idx = str.indexOf(prefix)
  if (idx === -1) return null
  const rest = str.slice(idx + prefix.length).trim()
  return rest || null
}

function isPatientStartRow(row: Row): boolean {
  const colA = cellStr(row, 0)
  const colC = cellStr(row, 2)
  const colD = cellStr(row, 3)

  if (!colA.includes(',')) return false
  if (
    colC.startsWith('Cell') ||
    colC.startsWith('Home') ||
    colD.startsWith('First:')
  ) {
    return true
  }
  return false
}

function extractEmail(blockRows: Row[]): string | null {
  let fallback: string | null = null
  for (let i = 0; i < blockRows.length; i++) {
    const colC = cellStr(blockRows[i], 2)
    if (colC.startsWith('Email')) {
      // "Email : user@email.com" or "Email :"
      const afterColon = colC.split(':').slice(1).join(':').trim()
      if (afterColon && afterColon.includes('@')) {
        return afterColon
      }
      // Email might be on the next row in Col C
      if (i + 1 < blockRows.length) {
        const nextColC = cellStr(blockRows[i + 1], 2)
        if (nextColC.includes('@')) {
          return nextColC.trim()
        }
      }
      return null
    }
    if (!fallback && colC.includes('@')) {
      fallback = colC.trim()
    }
  }
  return fallback
}

function extractAccountBalance(blockRows: Row[]): number {
  for (const row of blockRows) {
    const colE = cellStr(row, 4)
    if (colE.startsWith('Account:')) {
      return parseCurrency(colE.replace('Account:', '').trim())
    }
  }
  return 0
}

function extractPhone(blockRows: Row[]): number | null {
  let homePhone: number | null = null
  for (const row of blockRows) {
    const colC = cellStr(row, 2)
    if (colC.toLowerCase().startsWith('cell')) {
      const phone = parsePhone(colC)
      if (phone) return phone
    }
    if (!homePhone && colC.toLowerCase().startsWith('home')) {
      const phone = parsePhone(colC)
      if (phone) homePhone = phone
    }
  }
  return homePhone
}

function extractDate(blockRows: Row[], prefix: string): string | null {
  for (const row of blockRows) {
    const colD = cellStr(row, 3)
    const parsed = parseDateField(colD, prefix)
    if (parsed) return parsed
  }
  return null
}

function parsePatientBlock(blockRows: Row[]): PatientRecord {
  const row1 = blockRows[0]
  const row2 = blockRows.length > 1 ? blockRows[1] : []

  // Name
  const nameParts = cellStr(row1, 0).split(',')
  const lastName = nameParts[0].trim()
  const firstName =
    nameParts.length > 1 ? nameParts.slice(1).join(',').trim() : ''

  // Phone (prefer Cell, fallback to Home)
  const phone = extractPhone(blockRows)

  // Dates
  const firstAppt = extractDate(blockRows, 'First:')
  const lastAppt = extractDate(blockRows, 'Last:')

  // Balances
  const patientBalStr = cellStr(row1, 4)
  const patientBalance = patientBalStr.startsWith('Patient:')
    ? parseCurrency(patientBalStr.replace('Patient:', '').trim())
    : 0

  const insuranceBalStr = cellStr(row2, 4)
  const insuranceBalance = insuranceBalStr.startsWith('Insurance:')
    ? parseCurrency(insuranceBalStr.replace('Insurance:', '').trim())
    : 0

  const accountBalance = extractAccountBalance(blockRows)

  // Email
  const email = extractEmail(blockRows)

  return {
    firstName,
    lastName,
    phone,
    email,
    firstAppt,
    lastAppt,
    patientBalance,
    insuranceBalance,
    accountBalance,
  }
}

export function parseNewPatientsExcel(filePath: string): PatientRecord[] {
  const workbook = xlsx.readFile(filePath)
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows: Row[] = xlsx.utils.sheet_to_json(sheet, { header: 1 })

  // Find all patient-start row indices
  const startIndices: number[] = []
  for (let i = 0; i < rows.length; i++) {
    if (isPatientStartRow(rows[i])) {
      startIndices.push(i)
    }
  }

  // Group rows into patient blocks and parse
  const patients: PatientRecord[] = []
  for (let i = 0; i < startIndices.length; i++) {
    const start = startIndices[i]
    const end = i + 1 < startIndices.length ? startIndices[i + 1] : rows.length
    // Limit block to 8 rows max to avoid grabbing too much
    const blockEnd = Math.min(end, start + 8)
    const block = rows.slice(start, blockEnd)
    patients.push(parsePatientBlock(block))
  }

  return patients
}

function main() {
  const filePath = path.resolve(
    __dirname,
    '../../../temp-data/thrive-freehold-new-patients-5-year-lookback-feb-10-2026.xls',
  )

  console.log(`Reading: ${filePath}`)
  const patients = parseNewPatientsExcel(filePath)
  console.log(`Parsed ${patients.length} patient records`)

  // Log first record for verification
  if (patients.length > 0) {
    console.log('\nFirst record:')
    console.log(patients[0])
  }

  // Write output JSON
  const outPath = path.resolve(
    __dirname,
    '../../../temp-data/parsed-new-patients-thrive-freehold.json',
  )
  fs.writeFileSync(outPath, JSON.stringify(patients, null, 2))
  console.log(`\nWritten to: ${outPath}`)
}

const entryFile = process.argv[1]
if (entryFile && import.meta.url === pathToFileURL(entryFile).href) {
  main()
}
