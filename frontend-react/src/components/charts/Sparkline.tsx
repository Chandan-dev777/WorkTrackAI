export interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  strokeWidth?: number
}

/**
 * Pure SVG sparkline — shows a trend line with no axes or labels.
 * Zero dependencies. Use inside MetricCard KPI cells or table rows.
 */
export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#6366F1',
  strokeWidth = 1.5,
}: SparklineProps) {
  if (!data.length || data.length < 2) {
    return <svg width={width} height={height} aria-hidden="true" />
  }

  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1

  const pad = strokeWidth
  const innerW = width - pad * 2
  const innerH = height - pad * 2

  const points = data
    .map((v, i) => {
      const x = pad + (i / (data.length - 1)) * innerW
      const y = pad + (1 - (v - min) / range) * innerH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
