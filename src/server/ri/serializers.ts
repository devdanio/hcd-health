export function toIsoString(date: Date): string {
  return date.toISOString()
}

export function clampInt(value: number, opts: { min?: number; max?: number }) {
  const min = opts.min ?? Number.MIN_SAFE_INTEGER
  const max = opts.max ?? Number.MAX_SAFE_INTEGER
  return Math.max(min, Math.min(max, value))
}

