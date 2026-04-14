import { describe, it, expect } from 'vitest'
import { formatDate, formatDateShort, formatRelative, isToday } from './formatDate'

describe('formatDate', () => {
  it('formats ISO date string to readable date', () => {
    expect(formatDate('2026-04-13')).toBe('Apr 13, 2026')
  })

  it('handles date-time strings', () => {
    expect(formatDate('2026-01-05T00:00:00')).toBe('Jan 5, 2026')
  })
})

describe('formatDateShort', () => {
  it('returns short format', () => {
    expect(formatDateShort('2026-04-13')).toBe('Apr 13')
  })
})

describe('formatRelative', () => {
  it('returns "Today" for today\'s date', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(formatRelative(today)).toBe('Today')
  })

  it('returns "Yesterday" for yesterday', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    expect(formatRelative(yesterday)).toBe('Yesterday')
  })

  it('returns formatted date for older dates', () => {
    const result = formatRelative('2020-01-01')
    expect(result).toBe('Jan 1, 2020')
  })
})

describe('isToday', () => {
  it('returns true for today', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(isToday(today)).toBe(true)
  })

  it('returns false for other dates', () => {
    expect(isToday('2020-01-01')).toBe(false)
  })
})
