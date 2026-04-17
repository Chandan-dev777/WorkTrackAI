export interface GoalRingProps {
  current: number
  target: number
  label: string
  size?: number
}

/**
 * SVG radial progress ring.
 * Uses hard-coded hex colours for SVG presentation attributes —
 * CSS custom properties don't reliably resolve in SVG presentation attrs across all browsers.
 */
export function GoalRing({ current, target, size = 120, label }: GoalRingProps) {
  const RADIUS = (size / 2) * 0.75
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS
  const pct = target > 0 ? Math.min(current / target, 1) : 0
  const dashOffset = CIRCUMFERENCE * (1 - pct)
  const displayPct = Math.round(pct * 100)

  const cx = size / 2
  const cy = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label={`${label}: ${displayPct}% complete`}
      role="img"
    >
      <defs>
        <linearGradient id={`ringGrad-${size}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%"   stopColor="#6366F1" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>

      {/* Track — hard hex so it always renders */}
      <circle
        cx={cx} cy={cy} r={RADIUS}
        fill="none"
        stroke="#1C2030"
        strokeWidth={size * 0.07}
      />

      {/* Progress arc */}
      <circle
        cx={cx} cy={cy} r={RADIUS}
        fill="none"
        stroke={`url(#ringGrad-${size})`}
        strokeWidth={size * 0.07}
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={dashOffset}
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.25,0.46,0.45,0.94)' }}
      />

      {/* Centre percentage — use font attrs not style to avoid CSS var issues in SVG */}
      <text
        x={cx}
        y={cy - size * 0.05}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.18}
        fontWeight="700"
        fontFamily="monospace"
        fill="#F9FAFB"
      >
        {displayPct}%
      </text>

      {/* Label */}
      <text
        x={cx}
        y={cy + size * 0.18}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.1}
        fill="#6B7280"
      >
        {label}
      </text>
    </svg>
  )
}
