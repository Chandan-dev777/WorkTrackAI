import { format, isToday as fnsIsToday, isYesterday, parseISO } from 'date-fns'

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value
  // Handle both 'YYYY-MM-DD' and full ISO strings
  return parseISO(value)
}

export function formatDate(value: string | Date): string {
  return format(toDate(value), 'MMM d, yyyy')
}

export function formatDateShort(value: string | Date): string {
  return format(toDate(value), 'MMM d')
}

export function formatRelative(value: string | Date): string {
  const d = toDate(value)
  if (fnsIsToday(d)) return 'Today'
  if (isYesterday(d)) return 'Yesterday'
  return format(d, 'MMM d, yyyy')
}

export function isToday(value: string | Date): boolean {
  return fnsIsToday(toDate(value))
}

export function formatDateForInput(value: string | Date): string {
  return format(toDate(value), 'yyyy-MM-dd')
}

export function formatDateTime(value: string | Date): string {
  return format(toDate(value), 'MMM d, yyyy HH:mm')
}
