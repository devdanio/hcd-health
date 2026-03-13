/**
 * Sanitize email by trimming whitespace and converting to lowercase
 */
export function sanitizeEmail(
  email: string | undefined | null,
): string | undefined {
  if (!email) return undefined
  const sanitized = email.trim().toLowerCase()
  return sanitized.length > 0 ? sanitized : undefined
}

/**
 * Sanitize phone number by removing all non-numeric characters
 */
export function sanitizePhone(
  phone: string | undefined | null,
): string | undefined {
  if (!phone) return undefined
  const trimmed = phone.trim()
  if (!trimmed) return undefined

  const hasPlus = trimmed.startsWith('+')
  const hasDoubleZero = trimmed.startsWith('00')
  const digits = trimmed.replace(/\D/g, '')

  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return undefined
    return `+${digits}`
  }

  if (hasDoubleZero) {
    if (digits.length < 8 || digits.length > 15) return undefined
    return `+${digits}`
  }

  if (digits.length === 10) {
    return `+1${digits}`
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`
  }

  return undefined
}

/**
 * Parse dollar amount string to cents
 * Example: "$1,938.47" -> 193847
 * Returns null if invalid
 */
export function parseDollarsToCents(amount: string): number | null {
  if (!amount || amount.trim() === '') return null
  // Remove dollar sign, commas, and parse as float
  const cleaned = amount.replace(/[$,]/g, '')
  const dollars = parseFloat(cleaned)
  if (isNaN(dollars)) return null
  return Math.round(dollars * 100)
}
