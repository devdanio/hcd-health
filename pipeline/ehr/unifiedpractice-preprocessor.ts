import fs from 'node:fs'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { parse as parseCsv } from 'csv-parse/sync'
import { sanitizeEmail, sanitizePhone } from '../../src/utils/helpers'
import type {
  EHRPatientJsonld,
  PreprocessContext,
  PreprocessResult,
  RejectedRow,
} from './types'

type CsvRow = string[]

dayjs.extend(customParseFormat)

function normalizeString(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  const lower = trimmed.toLowerCase()
  if (lower === 'n/a' || lower === 'na' || lower === 'null') return undefined
  return trimmed
}

function findHeaderRowIndex(rows: CsvRow[]): number {
  for (let index = 0; index < rows.length; index += 1) {
    const normalized = rows[index].map((value) => value.trim().toLowerCase())
    const hasFirstName = normalized.includes('patient firstname')
    const hasLastName = normalized.includes('patient lastname')
    const hasEmail = normalized.includes('email')
    const hasPhone = normalized.includes('phone number')
    if (hasFirstName && hasLastName && hasEmail && hasPhone) {
      return index
    }
  }
  return -1
}

function rowToRecord(headers: string[], row: CsvRow): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i]?.trim()
    if (!header) continue
    out[header] = row[i] ?? ''
  }
  return out
}

function toDateMmDdYyyy(value: string | null | undefined): string | null {
  const raw = normalizeString(value)
  if (!raw) return null

  const formats = ['M/D/YYYY', 'MM/DD/YYYY', 'M/D/YY', 'MM/DD/YY']
  for (const format of formats) {
    const parsed = dayjs(raw, format, true)
    if (parsed.isValid()) {
      return parsed.format('MM/DD/YYYY')
    }
  }

  const fallback = dayjs(raw)
  return fallback.isValid() ? fallback.format('MM/DD/YYYY') : null
}

function parseAccountAgeDays(value: string | null | undefined): number | null {
  const raw = normalizeString(value)
  if (!raw) return null

  const match = raw.match(/^([\d,]+)\s+days?$/i)
  if (!match) return null
  const numeric = Number.parseInt(match[1].replace(/,/g, ''), 10)
  if (Number.isNaN(numeric)) return null
  return numeric
}

function deriveCreatedAtFromAccountAge(
  context: PreprocessContext,
  accountAge: string | null | undefined,
): string | null {
  if (!context.sourceFileDate) return null
  const baseDate = dayjs(context.sourceFileDate)
  if (!baseDate.isValid()) return null

  const days = parseAccountAgeDays(accountAge)
  if (days == null) return null

  return baseDate.subtract(days, 'day').format('MM/DD/YYYY')
}

export function preprocessUnifiedPracticeFile(
  filePath: string,
  context: PreprocessContext,
): PreprocessResult {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const rows = parseCsv(raw, {
    bom: true,
    skip_empty_lines: false,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  }) as CsvRow[]

  const headerIndex = findHeaderRowIndex(rows)
  if (headerIndex < 0) {
    throw new Error(
      'Could not find Unified Practice header row (Patient Firstname, Patient Lastname, Email, Phone Number).',
    )
  }

  const headers = rows[headerIndex]
  const normalized: EHRPatientJsonld[] = []
  const rejected: RejectedRow[] = []

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i]
    const hasAnyValue = row.some((value) => value && value.trim().length > 0)
    if (!hasAnyValue) continue

    const record = rowToRecord(headers, row)
    const firstName = normalizeString(record['Patient Firstname']) ?? null
    const lastName = normalizeString(record['Patient Lastname']) ?? null
    const email = sanitizeEmail(normalizeString(record.Email)) ?? null
    const phone = sanitizePhone(normalizeString(record['Phone Number'])) ?? null
    const firstApt =
      deriveCreatedAtFromAccountAge(context, record['Account Age']) ??
      toDateMmDdYyyy(record['First Visit'])
    const lastApt = toDateMmDdYyyy(record['Last Visit'])

    if (!email && !phone) {
      rejected.push({
        reason: 'missing_phone_and_email',
        row: record,
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
      cashCollectedCents: null,
      insuranceBalanceCents: null,
      patientBalanceCents: null,
      externalId: null,
    })
  }

  return { normalized, rejected }
}
