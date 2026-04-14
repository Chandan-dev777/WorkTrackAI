export function formatCurrency(value: number, currency = 'EUR', locale = 'en-DE'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

export function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000
    return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (value >= 1_000) {
    const k = value / 1_000
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K`
  }
  return String(value)
}

export function formatHours(value: number): string {
  return `${value % 1 === 0 ? value.toFixed(0) : value}h`
}
