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
  const sanitized = phone.replace(/\D/g, '')
  return sanitized.length > 0 ? sanitized : undefined
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
