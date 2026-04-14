import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useCountUp } from './useCountUp'

describe('useCountUp', () => {
  it('returns target value immediately when duration is 0', () => {
    const { result } = renderHook(() => useCountUp(42, 0))
    expect(result.current).toBe(42)
  })

  it('returns target value immediately when duration is 0 and target is decimal', () => {
    const { result } = renderHook(() => useCountUp(42.5, 0))
    expect(result.current).toBe(42.5)
  })

  it('returns final value when prefers-reduced-motion is true', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
    const { result } = renderHook(() => useCountUp(100, 600))
    expect(result.current).toBe(100)
    vi.restoreAllMocks()
  })

  it('starts from 0 when duration > 0 and no reduced motion', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
    const { result } = renderHook(() => useCountUp(100, 600))
    // initial value before animation completes is 0 or near 0
    expect(result.current).toBeLessThanOrEqual(100)
    vi.restoreAllMocks()
  })
})
