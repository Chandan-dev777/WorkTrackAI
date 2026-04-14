import { describe, it, expect } from 'vitest'
import { formatCurrency, formatPercent, formatLargeNumber, formatHours } from './formatNumber'

describe('formatCurrency', () => {
  it('formats with currency symbol and thousands separator', () => {
    expect(formatCurrency(1234.56)).toBe('€1,234.56')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('€0.00')
  })

  it('formats large numbers', () => {
    expect(formatCurrency(100000)).toBe('€100,000.00')
  })
})

describe('formatPercent', () => {
  it('formats decimal to percent', () => {
    expect(formatPercent(0.856)).toBe('85.6%')
  })

  it('formats 0', () => {
    expect(formatPercent(0)).toBe('0.0%')
  })

  it('formats 1', () => {
    expect(formatPercent(1)).toBe('100.0%')
  })
})

describe('formatLargeNumber', () => {
  it('returns number as-is under 1000', () => {
    expect(formatLargeNumber(999)).toBe('999')
  })

  it('formats thousands as K', () => {
    expect(formatLargeNumber(1500)).toBe('1.5K')
  })

  it('formats millions as M', () => {
    expect(formatLargeNumber(2_300_000)).toBe('2.3M')
  })

  it('formats exactly 1000 as 1K', () => {
    expect(formatLargeNumber(1000)).toBe('1K')
  })
})

describe('formatHours', () => {
  it('formats 1 as "1h"', () => {
    expect(formatHours(1)).toBe('1h')
  })

  it('formats 1.5 as "1.5h"', () => {
    expect(formatHours(1.5)).toBe('1.5h')
  })

  it('formats 0 as "0h"', () => {
    expect(formatHours(0)).toBe('0h')
  })
})
