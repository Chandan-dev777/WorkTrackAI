export interface BenchmarkCardProps {
  label: string
  you: number
  average: number
  unit?: string
  className?: string
}

/**
 * Comparison card showing your metric vs team average.
 * Shows a signed delta percentage with colour coding.
 */
export function BenchmarkCard({ label, you, average, unit = '', className }: BenchmarkCardProps) {
  const deltaRaw = average > 0 ? ((you - average) / average) * 100 : 0
  const delta    = Math.round(deltaRaw)
  const isAbove  = delta > 0
  const isBelow  = delta < 0

  const deltaColor = isAbove
    ? 'var(--color-status-success)'
    : isBelow
    ? 'var(--color-status-danger)'
    : 'var(--color-text-muted)'

  const deltaLabel = isAbove ? `+${delta}%` : isBelow ? `${delta}%` : '0%'

  return (
    <div
      className={className}
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
      }}
    >
      {/* Label row */}
      <p className="text-xs font-medium uppercase tracking-wide mb-3"
        style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </p>

      {/* Values row */}
      <div className="flex items-end justify-between gap-4">
        {/* You */}
        <div>
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>You</p>
          <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
            {you}{unit}
          </p>
        </div>

        {/* Delta badge */}
        <span
          data-testid="benchmark-delta"
          className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{
            background: `${deltaColor}18`,
            color: deltaColor,
            border: `1px solid ${deltaColor}33`,
          }}
        >
          {deltaLabel}
        </span>

        {/* Average */}
        <div className="text-right">
          <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>Avg</p>
          <p className="text-xl font-semibold font-mono" style={{ color: 'var(--color-text-secondary)' }}>
            {average}{unit}
          </p>
        </div>
      </div>
    </div>
  )
}
