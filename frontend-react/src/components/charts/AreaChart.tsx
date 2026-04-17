import { ResponsiveContainer, AreaChart as ReAreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot } from 'recharts'
import { format, parseISO } from 'date-fns'
import type { DailyHours } from '@/api/dashboard'

function EmptyState({ height }: { height: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No data for this period</p>
    </div>
  )
}

function formatTick(d: string) {
  try { return format(parseISO(d), 'MMM d') } catch { return d }
}

/** Detect anomaly spikes: points > (mean + 1.5 * stddev) */
function detectAnomalies(data: DailyHours[]): string[] {
  if (data.length < 3) return []
  const vals = data.map(d => d.hours)
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const std  = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)
  const threshold = mean + 1.5 * std
  return data.filter(d => d.hours > threshold).map(d => d.date)
}

export function AreaChart({ data, height = 200 }: { data: DailyHours[]; height?: number }) {
  if (!data.length) return <EmptyState height={height} />

  const anomalyDates = detectAnomalies(data)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReAreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        {/* SVG gradient — must use real hex values, not CSS variables */}
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366F1" stopOpacity={0.28} />
            <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />

        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatTick}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
        />

        {/* Styled tooltip using built-in contentStyle — reliable across Recharts v3 */}
        <Tooltip
          contentStyle={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontSize: '12px',
            padding: '8px 12px',
          }}
          labelStyle={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}
          itemStyle={{ color: '#818cf8', fontFamily: 'monospace', fontWeight: 600 }}
          labelFormatter={(label) => formatTick(String(label))}
          formatter={(value) => [`${Number(value).toFixed(1)}h`, 'Hours']}
        />

        <Area
          type="monotone"
          dataKey="hours"
          stroke="#6366F1"
          strokeWidth={2}
          fill="url(#areaGrad)"
          dot={false}
          activeDot={{ r: 4, fill: '#6366F1' }}
          isAnimationActive
          animationDuration={800}
          animationEasing="ease-out"
        />

        {/* Anomaly markers — orange dot on spikes > 1.5σ above mean */}
        {anomalyDates.map(date => {
          const entry = data.find(d => d.date === date)
          if (!entry) return null
          return (
            <ReferenceDot
              key={date}
              x={date}
              y={entry.hours}
              r={5}
              fill="#F59E0B"
              stroke="#fff"
              strokeWidth={1.5}
              label={{ value: '↑', position: 'top', fontSize: 10, fill: '#F59E0B' }}
            />
          )
        })}
      </ReAreaChart>
    </ResponsiveContainer>
  )
}
