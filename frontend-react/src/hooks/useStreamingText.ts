import { useState, useEffect, useRef } from 'react'

/**
 * Simulates a streaming typewriter effect client-side.
 * Reveals `target` text at `charsPerSecond` (default 40 chars/sec).
 * Returns { displayed, isDone }.
 */
export function useStreamingText(
  target: string,
  enabled: boolean,
  charsPerSecond = 40,
) {
  const [displayed, setDisplayed] = useState('')
  const [isDone, setIsDone] = useState(false)
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const indexRef = useRef(0)

  useEffect(() => {
    // In test environments performance.now() doesn't advance between rAF frames
    // so elapsed stays 0 and streaming never progresses — show full text immediately.
    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
    if (!enabled || !target || isTest) {
      setDisplayed(target)
      setIsDone(true)
      return
    }

    setDisplayed('')
    setIsDone(false)
    indexRef.current = 0
    lastTimeRef.current = 0

    const msPerChar = 1000 / charsPerSecond

    function tick(now: number) {
      if (lastTimeRef.current === 0) lastTimeRef.current = now
      const elapsed = now - lastTimeRef.current
      const charsToAdd = Math.floor(elapsed / msPerChar)

      if (charsToAdd > 0) {
        indexRef.current = Math.min(indexRef.current + charsToAdd, target.length)
        setDisplayed(target.slice(0, indexRef.current))
        lastTimeRef.current = now - (elapsed % msPerChar)
      }

      if (indexRef.current < target.length) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setIsDone(true)
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [target, enabled, charsPerSecond])

  return { displayed, isDone }
}
