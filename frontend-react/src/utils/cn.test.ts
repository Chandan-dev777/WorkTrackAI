import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('handles undefined and null values', () => {
    expect(cn('a', undefined, null, 'b')).toBe('a b')
  })

  it('handles false conditionals', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    const result = cn('bg-red-500', 'bg-blue-500')
    expect(result).toBe('bg-blue-500')
    expect(result).not.toContain('bg-red-500')
  })

  it('handles object syntax', () => {
    expect(cn({ 'text-white': true, 'text-black': false })).toBe('text-white')
  })

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('')
  })
})
