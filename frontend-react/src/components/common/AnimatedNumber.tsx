import { useCountUp } from '@/hooks/useCountUp'

export interface AnimatedNumberProps {
  /** The target numeric value */
  value: number
  /** Animation duration in ms. Pass 0 to skip animation (useful in tests). Default: 600 */
  duration?: number
  /** Number of decimal places to display. Auto-detects from value when undefined. */
  decimals?: number
  /** Optional suffix appended after the number, e.g. "h" or "%" */
  suffix?: string
  className?: string
}

/**
 * Displays a number that counts up from 0 to `value` on mount.
 * Respects `prefers-reduced-motion` — shows target instantly if set.
 * Pass `duration={0}` to disable animation (e.g. in tests or static contexts).
 */
export function AnimatedNumber({
  value,
  duration = 600,
  decimals,
  suffix = '',
  className,
}: AnimatedNumberProps) {
  const current = useCountUp(value, duration)

  // Determine display precision:
  // If `decimals` is explicitly set, use it.
  // Otherwise auto-detect: show 1 decimal if value has a fractional part, else 0.
  const precision = decimals !== undefined
    ? decimals
    : value % 1 === 0 ? 0 : 1

  const display = current.toFixed(precision)

  return (
    <span className={className}>
      {display}{suffix}
    </span>
  )
}
