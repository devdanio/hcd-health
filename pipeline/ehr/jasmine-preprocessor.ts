import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import XLSX from 'xlsx'
import { sanitizeEmail, sanitizePhone } from '../../src/utils/helpers'
import type {
  EHRPatientJsonld,
  PreprocessContext,
  PreprocessResult,
  RejectedRow,
} from './types'

dayjs.extend(customParseFormat)

type SheetRow = (string | number | null | undefined)[]

const EXPECTED_HEADERS = [
  'Contact: Contact ID',
  'Contact: First Name',
  'Contact: Last Name',
  'Contact: Phone',
  'Contact: Email',
  'Contact: Created Date',
  'Payment Date',
  'Amount',
] as const

type ContactAccumulator = {
  contactId: string
  firstName: string | null
  lastName: string | null
  phone: string | null
  email: string | null
  createdDate: string | null
  earliestPaymentDate: dayjs.Dayjs | null
  latestPaymentDate: dayjs.Dayjs | null
  totalAmountCents: number
}

function normalizeString(value: string | number | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined
  const trimmed = String(value).trim()
  if (trimmed.length === 0) return undefined
  const lower = trimmed.toLowerCase()
  if (lower === 'n/a' || lower === 'na' || lower === 'null') return undefined
  return trimmed
}

function findHeaderRowIndex(rows: SheetRow[]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i]
    if (!row) continue
    const normalized = row.map((v) => (v ? String(v).trim() : ''))
    const hasContactId = normalized.includes('Contact: Contact ID')
    const hasFirstName = normalized.includes('Contact: First Name')
    const hasLastName = normalized.includes('Contact: Last Name')
    if (hasContactId && hasFirstName && hasLastName) {
      return i
    }
  }
  return -1
}

function buildHeaderMap(headerRow: SheetRow): Map<string, number> {
  const map = new Map<string, number>()
  for (let i = 0; i < headerRow.length; i++) {
    const val = headerRow[i]
    if (val !== null && val !== undefined) {
      map.set(String(val).trim(), i)
    }
  }
  return map
}

function cellValue(row: SheetRow, col: number | undefined): string | undefined {
  if (col === undefined) return undefined
  return normalizeString(row[col])
}

function parseDate(value: string | undefined): dayjs.Dayjs | null {
  if (!value) return null
  const formats = ['M/D/YYYY', 'MM/DD/YYYY', 'M/D/YY', 'MM/DD/YY', 'YYYY-MM-DD']
  for (const fmt of formats) {
    const parsed = dayjs(value, fmt, true)
    if (parsed.isValid()) return parsed
  }
  const fallback = dayjs(value)
  return fallback.isValid() ? fallback : null
}

function toDateMmDdYyyy(d: dayjs.Dayjs | null): string | null {
  return d ? d.format('MM/DD/YYYY') : null
}

function dollarsToCents(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null
    return Math.round(value * 100)
  }
  const cleaned = String(value).replace(/[$,]/g, '')
  const num = parseFloat(cleaned)
  if (Number.isNaN(num)) return null
  return Math.round(num * 100)
}

function sanitizeJasminePhone(raw: string | undefined): string | null {
  if (!raw) return null
  // Jasmine phone fields sometimes contain text like "(908) 930-1686 Mary Francis"
  // Extract just the phone portion before any alphabetic characters
  const phoneMatch = raw.match(/^[\d()+\-.\s]+/)
  const phoneOnly = phoneMatch ? phoneMatch[0].trim() : raw
  return sanitizePhone(phoneOnly) ?? null
}

export function preprocessJasmineFile(
  filePath: string,
  _context: PreprocessContext,
): PreprocessResult {
  const wb = XLSX.readFile(filePath)
  const sheetName = wb.SheetNames[0]
  if (!sheetName) {
    throw new Error('No sheets found in workbook')
  }
  const ws = wb.Sheets[sheetName]
  if (!ws) {
    throw new Error(`Sheet "${sheetName}" not found`)
  }
  const rows = XLSX.utils.sheet_to_json<SheetRow>(ws, { header: 1 })

  const headerIdx = findHeaderRowIndex(rows)
  if (headerIdx < 0) {
    throw new Error(
      `Could not find Jasmine header row. Expected columns: ${EXPECTED_HEADERS.join(', ')}`,
    )
  }

  const headerMap = buildHeaderMap(rows[headerIdx])
  const col = {
    contactId: headerMap.get('Contact: Contact ID'),
    firstName: headerMap.get('Contact: First Name'),
    lastName: headerMap.get('Contact: Last Name'),
    phone: headerMap.get('Contact: Phone'),
    email: headerMap.get('Contact: Email'),
    createdDate: headerMap.get('Contact: Created Date'),
    paymentDate: headerMap.get('Payment Date'),
    amount: headerMap.get('Amount'),
  }

  if (col.contactId === undefined) {
    throw new Error('Missing required column: Contact: Contact ID')
  }

  // Aggregate rows by Contact ID
  const contacts = new Map<string, ContactAccumulator>()

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    const contactId = cellValue(row, col.contactId)
    if (!contactId) continue

    const paymentDateStr = cellValue(row, col.paymentDate)
    const paymentDate = parseDate(paymentDateStr)
    const amountRaw = col.amount !== undefined ? row[col.amount] : undefined
    const amountCents = dollarsToCents(amountRaw)

    const existing = contacts.get(contactId)
    if (existing) {
      // Update date bounds
      if (paymentDate) {
        if (!existing.earliestPaymentDate || paymentDate.isBefore(existing.earliestPaymentDate)) {
          existing.earliestPaymentDate = paymentDate
        }
        if (!existing.latestPaymentDate || paymentDate.isAfter(existing.latestPaymentDate)) {
          existing.latestPaymentDate = paymentDate
        }
      }
      // Sum amounts
      if (amountCents !== null) {
        existing.totalAmountCents += amountCents
      }
    } else {
      contacts.set(contactId, {
        contactId,
        firstName: cellValue(row, col.firstName) ?? null,
        lastName: cellValue(row, col.lastName) ?? null,
        phone: cellValue(row, col.phone) ?? null,
        email: cellValue(row, col.email) ?? null,
        createdDate: cellValue(row, col.createdDate) ?? null,
        earliestPaymentDate: paymentDate,
        latestPaymentDate: paymentDate,
        totalAmountCents: amountCents ?? 0,
      })
    }
  }

  const normalized: EHRPatientJsonld[] = []
  const rejected: RejectedRow[] = []

  for (const contact of contacts.values()) {
    const firstName = contact.firstName
    const lastName = contact.lastName
    const email = sanitizeEmail(contact.email) ?? null
    const phone = sanitizeJasminePhone(contact.phone)
    const createdDate = parseDate(contact.createdDate)
    const firstApt = toDateMmDdYyyy(createdDate) ?? toDateMmDdYyyy(contact.earliestPaymentDate)
    const lastApt = toDateMmDdYyyy(contact.latestPaymentDate)

    if (!email && !phone) {
      rejected.push({
        reason: 'missing_phone_and_email',
        row: {
          contactId: contact.contactId,
          firstName: contact.firstName,
          lastName: contact.lastName,
          phone: contact.phone,
          email: contact.email,
        },
      })
      continue
    }

    normalized.push({
      firstName,
      lastName,
      email,
      phone,
      firstApt,
      lastApt,
      cashCollectedCents: contact.totalAmountCents > 0 ? contact.totalAmountCents : null,
      insuranceBalanceCents: null,
      patientBalanceCents: null,
      externalId: contact.contactId,
    })
  }

  return { normalized, rejected }
}
