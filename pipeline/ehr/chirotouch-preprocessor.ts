import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { parseNewPatientsExcel } from '../../src/integrations/chirotouch/proccess-new-patients-excel'
import { sanitizeEmail, sanitizePhone } from '../../src/utils/helpers'
import type {
  EHRPatientJsonld,
  PreprocessContext,
  PreprocessResult,
  RejectedRow,
} from './types'

dayjs.extend(customParseFormat)

function normalizeString(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  const lower = trimmed.toLowerCase()
  if (lower === 'n/a' || lower === 'na') return undefined
  return trimmed
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

export function preprocessChirotouchFile(
  filePath: string,
  _context: PreprocessContext,
): PreprocessResult {
  const records = parseNewPatientsExcel(filePath)
  const normalized: EHRPatientJsonld[] = []
  const rejected: RejectedRow[] = []

  for (const record of records) {
    const firstName = normalizeString(record.firstName) ?? null
    const lastName = normalizeString(record.lastName) ?? null
    const email = sanitizeEmail(normalizeString(record.email)) ?? null
    const phone = sanitizePhone(record.phone ? String(record.phone) : null) ?? null
    const firstApt = toDateMmDdYyyy(record.firstAppt)
    if (!email && !phone) {
      rejected.push({
        reason: 'missing_phone_and_email',
        row: {
          firstName: record.firstName,
          lastName: record.lastName,
          email: record.email,
          phone: record.phone,
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
      lastApt: null,
      cashCollectedCents: null,
      insuranceBalanceCents: null,
      patientBalanceCents: null,
      externalId: null,
    })
  }

  return { normalized, rejected }
}
