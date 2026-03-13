import fs from 'node:fs'
import path from 'node:path'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import XLSX from 'xlsx'

dayjs.extend(customParseFormat)

type SheetRow = (string | number | null | undefined)[]

type PaymentContext = {
  paymentDate: string
  patientFirstName: string
  patientLastName: string
  patientAccountId: string
}

type OutputRecord = {
  paymentDate: string
  patientFirstName: string
  patientLastName: string
  patientAccountId: string
  dateOfService: string
  cptCode: string
  amountPaidCents: number
}

const DEFAULT_INPUT_FILE = path.resolve(
  process.cwd(),
  'pipeline/client-data/thrive/raw/chirotouch/payment-details-by-service-provider-aug-13-2026-6-mo-lookback.xls',
)

const DEFAULT_OUTPUT_DIR = path.resolve(
  process.cwd(),
  'pipeline/client-data/thrive/normalized/payment-details-by-service-provider',
)

const DATE_FORMATS = ['M/D/YYYY', 'MM/DD/YYYY', 'M-D-YYYY', 'MM-DD-YYYY']

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true })
}

function normalizeCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function parseDate(value: string): dayjs.Dayjs | null {
  const normalized = normalizeCell(value)
  if (!normalized) return null

  for (const format of DATE_FORMATS) {
    const parsed = dayjs(normalized, format, true)
    if (parsed.isValid()) return parsed
  }

  return null
}

function parseAmountCents(
  value: string | number | null | undefined,
): number | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null
    return Math.round(value * 100)
  }

  const normalized = normalizeCell(value).replace(/[$,]/g, '')
  if (!normalized) return null

  const isParenthesizedNegative =
    normalized.startsWith('(') && normalized.endsWith(')')
  const numericRaw = isParenthesizedNegative
    ? normalized.slice(1, -1)
    : normalized
  const parsed = Number.parseFloat(numericRaw)
  if (Number.isNaN(parsed)) return null

  const signedValue = isParenthesizedNegative ? -parsed : parsed
  return Math.round(signedValue * 100)
}

function parsePatientFromPaymentCell(value: string): {
  firstName: string
  lastName: string
  accountId: string
} {
  const raw = normalizeCell(value)
  const numericParenMatches = [...raw.matchAll(/\((\s*-?\d+\s*)\)/g)]

  let accountId = ''
  if (numericParenMatches.length > 0) {
    const lastMatch = numericParenMatches[numericParenMatches.length - 1]
    const digits = lastMatch?.[1]?.replace(/[^0-9]/g, '') ?? ''
    accountId = digits
  }

  const withoutNumericAccount = raw
    .replace(/\(\s*-?\d+\s*\)/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim()

  const commaIndex = withoutNumericAccount.indexOf(',')
  if (commaIndex < 0) {
    return {
      firstName: withoutNumericAccount,
      lastName: '',
      accountId,
    }
  }

  const firstName = withoutNumericAccount.slice(0, commaIndex).trim()
  const lastName = withoutNumericAccount.slice(commaIndex + 1).trim()

  return {
    firstName,
    lastName,
    accountId,
  }
}

function parseAccountContinuation(row: SheetRow): string | null {
  const maybeAccount = normalizeCell(row[2])
  const match = maybeAccount.match(/^-?(\d+)$/)
  if (!match) return null
  return match[1] ?? null
}

function isHeaderOrSummaryRow(row: SheetRow): boolean {
  const col0 = normalizeCell(row[0])
  const col2 = normalizeCell(row[2])
  const col5 = normalizeCell(row[5])
  const col8 = normalizeCell(row[8])

  if (col0 === 'Date' && col2 === 'Patient') return true
  if (col0.startsWith('Payment Details by Service Provider')) return true
  if (col0.startsWith('for payments dated')) return true
  if (col0.startsWith('Case Type:')) return true
  if (col0.startsWith('Printed:')) return true
  if (col2.includes('*** continued from previous page ***')) return true
  if (col5.startsWith('Totals for ')) return true
  if (col5 === 'Report Totals:') return true
  if (col8.startsWith('Thrive Spine and Sports Rehab')) return true
  if (col8.startsWith('616 5th Ave')) return true
  if (col8.startsWith('Belmar, NJ')) return true
  if (col8.startsWith('Phone:')) return true
  if (col8.startsWith('Fax:')) return true

  return false
}

function isPaymentRow(row: SheetRow): boolean {
  const paymentDate = parseDate(normalizeCell(row[0]))
  const patientCell = normalizeCell(row[2])
  if (!paymentDate) return false
  return patientCell.length > 0
}

function isServiceRow(row: SheetRow): boolean {
  const dateOfService = parseDate(normalizeCell(row[2]))
  if (!dateOfService) return false
  const cptCode = normalizeCell(row[3])
  return cptCode.length > 0
}

function extractDateTokenFromFileName(inputFilePath: string): string | null {
  const fileName = path.basename(inputFilePath)

  const numericMatch = fileName.match(
    /\b(0[1-9]|1[0-2])[-_](0[1-9]|[12][0-9]|3[01])[-_](20\d{2})\b/i,
  )
  if (numericMatch) {
    const token = numericMatch[0].replace(/_/g, '-')
    const parsed = dayjs(token, 'MM-DD-YYYY', true)
    if (parsed.isValid()) return parsed.format('MM-DD-YYYY')
  }

  const textMatch = fileName.match(
    /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[-_](\d{1,2})[-_](20\d{2})\b/i,
  )
  if (textMatch) {
    const month = textMatch[1]
    const day = textMatch[2]
    const year = textMatch[3]
    const parsed = dayjs(`${month}-${day}-${year}`, 'MMM-D-YYYY', true)
    if (parsed.isValid()) return parsed.format('MM-DD-YYYY')
  }

  return null
}

function extractDateTokenFromSheet(rows: SheetRow[]): string | null {
  const maxRows = Math.min(rows.length, 80)
  for (let i = 0; i < maxRows; i += 1) {
    const row = rows[i] ?? []
    const candidates = row
      .map((cell) => normalizeCell(cell))
      .filter((cell) => cell.length > 0)
    for (const candidate of candidates) {
      const match = candidate.match(
        /for payments dated\s+\d{1,2}\/\d{1,2}\/\d{4}\s+thru\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      )
      if (!match || !match[1]) continue
      const parsed = parseDate(match[1])
      if (parsed) return parsed.format('MM-DD-YYYY')
    }
  }
  return null
}

function csvEscape(value: string | number): string {
  const raw = String(value)
  if (!/[",\n]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

function toCsv(records: OutputRecord[]): string {
  const header =
    'payment_date,patient_first_name,patient_last_name,patient_account_id,date_of_service,cpt_code,amount_paid_cents'

  const lines = records.map((record) =>
    [
      record.paymentDate,
      record.patientFirstName,
      record.patientLastName,
      record.patientAccountId,
      record.dateOfService,
      record.cptCode,
      record.amountPaidCents,
    ]
      .map((value) => csvEscape(value))
      .join(','),
  )

  return `${[header, ...lines].join('\n')}\n`
}

function parseRows(rows: SheetRow[]): {
  records: OutputRecord[]
  missingContextServiceRows: number
  missingAccountRows: number
} {
  const records: OutputRecord[] = []
  let currentPayment: PaymentContext | null = null
  let missingContextServiceRows = 0
  let missingAccountRows = 0

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i] ?? []
    if (isHeaderOrSummaryRow(row)) continue

    const continuationAccount = parseAccountContinuation(row)
    if (continuationAccount && currentPayment) {
      currentPayment.patientAccountId = continuationAccount
      continue
    }

    if (isPaymentRow(row)) {
      const paymentDate = parseDate(normalizeCell(row[0]))
      if (!paymentDate) continue

      const patient = parsePatientFromPaymentCell(normalizeCell(row[2]))
      currentPayment = {
        paymentDate: paymentDate.format('MM-DD-YYYY'),
        patientFirstName: patient.firstName,
        patientLastName: patient.lastName,
        patientAccountId: patient.accountId,
      }
      continue
    }

    if (!isServiceRow(row)) continue

    if (!currentPayment) {
      missingContextServiceRows += 1
      continue
    }

    const dateOfService = parseDate(normalizeCell(row[2]))
    if (!dateOfService) continue

    const cptCode = normalizeCell(row[3])
    const amountPaidCents = parseAmountCents(row[8]) ?? 0
    if (!currentPayment.patientAccountId) {
      missingAccountRows += 1
    }

    records.push({
      paymentDate: currentPayment.paymentDate,
      patientFirstName: currentPayment.patientFirstName,
      patientLastName: currentPayment.patientLastName,
      patientAccountId: currentPayment.patientAccountId,
      dateOfService: dateOfService.format('MM-DD-YYYY'),
      cptCode,
      amountPaidCents,
    })
  }

  return { records, missingContextServiceRows, missingAccountRows }
}

function main() {
  const inputFileArg = process.argv[2]
  const outputFileArg = process.argv[3]

  const inputFilePath = inputFileArg
    ? path.resolve(process.cwd(), inputFileArg)
    : DEFAULT_INPUT_FILE

  if (!fs.existsSync(inputFilePath)) {
    throw new Error(`Input file not found: ${inputFilePath}`)
  }

  const workbook = XLSX.readFile(inputFilePath)
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('No worksheet found in workbook')
  }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Worksheet "${sheetName}" not found`)
  }

  const rows = XLSX.utils.sheet_to_json<SheetRow>(sheet, {
    header: 1,
    raw: true,
    defval: '',
    blankrows: false,
  })

  const dateToken =
    extractDateTokenFromFileName(inputFilePath) ??
    extractDateTokenFromSheet(rows) ??
    dayjs().format('MM-DD-YYYY')

  const outputFilePath = outputFileArg
    ? path.resolve(process.cwd(), outputFileArg)
    : path.resolve(DEFAULT_OUTPUT_DIR, `${dateToken}-1.csv`)

  ensureDir(path.dirname(outputFilePath))

  const { records, missingContextServiceRows, missingAccountRows } =
    parseRows(rows)
  const csv = toCsv(records)
  fs.writeFileSync(outputFilePath, csv)

  console.log(`Input: ${inputFilePath}`)
  console.log(`Output: ${outputFilePath}`)
  console.log(`Rows written: ${records.length}`)
  console.log(
    `Service rows skipped (no active payment): ${missingContextServiceRows}`,
  )
  console.log(`Rows with missing account ID: ${missingAccountRows}`)
}

main()
