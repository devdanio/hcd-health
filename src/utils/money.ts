export function formatCents(cents: number): string {
  const dollars = cents / 100
  const absDollars = Math.abs(dollars)
  if (absDollars >= 1000) {
    const abbreviated = (absDollars / 1000).toFixed(1).replace(/\.0$/, '')
    const sign = dollars < 0 ? '-' : ''
    return `${sign}$${abbreviated}k`
  }
  return dollars.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

export function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}
