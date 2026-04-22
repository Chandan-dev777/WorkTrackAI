import { useState, useEffect } from 'react'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  if (!window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Animates a numeric value from 0 to `target` over `duration` ms.
 * Respects `prefers-reduced-motion` — returns target immediately if set.
 * Pass `duration=0` to also skip animation.
 * In test mode (`import.meta.env.MODE === 'test'`), always returns target immediately.
 */
export function useCountUp(target: number, duration = 600): number {
  const isTest = import.meta.env.MODE === 'test'
  const [value, setValue] = useState(() =>
    isTest || duration === 0 || prefersReducedMotion() ? target : 0
  )

  useEffect(() => {
    if (isTest || duration === 0 || prefersReducedMotion()) {
      setValue(target)
      return
    }

    setValue(0)
    const startTime = performance.now()

    let rafId: number

    function tick(now: number) {
      const elapsed  = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        setValue(target)
      }
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration])

  return value
}
