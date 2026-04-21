import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import type { StatusCount } from '@/api/dashboard'

const STATUS_COLORS: Record<string, string> = {
  done:        '#10B981',
  in_progress: '#0EA5E9',
  blocked:     '#F43F5E',
  planned:     '#4B5563',
}

function EmptyState({ height }: { height: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No data for this period</p>
    </div>
  )
}

export function DonutChart({ data, height = 200 }: { data: StatusCount[]; height?: number }) {
  if (!data.length) return <EmptyState height={height} />

  const total = data.reduce((s, d) => s + d.count, 0)

  return (
    <div>
      {/* Chart — no Legend inside so cy="50%" is the true vertical centre */}
      <div style={{ position: 'relative', width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              cx="50%"
              cy="50%"
              innerRadius="52%"
              outerRadius="72%"
              paddingAngle={2}
              isAnimationActive
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((entry) => (
                <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#374151'} />
              ))}
            </Pie>

            <Tooltip
              contentStyle={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-default)',
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                fontSize: '12px',
                padding: '8px 12px',
              }}
              labelStyle={{ display: 'none' }}
              itemStyle={{ fontFamily: 'monospace', fontWeight: 600 }}
              formatter={(value, name) => [
                `${value} items`,
                String(name ?? '').replace('_', ' '),
              ]}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Centre label — cy="50%" means the pie centre is exactly at 50% of the div height */}
        <div
          aria-label={`${total} total items`}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            lineHeight: 1.2,
          }}
        >
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
            {total}
          </div>
          <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
            items
          </div>
        </div>
      </div>

      {/* Legend rendered as plain HTML below the chart — avoids SVG space allocation */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 16px', marginTop: 10 }}>
        {data.map(entry => (
          <span key={entry.status} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[entry.status] ?? '#374151', flexShrink: 0 }} />
            {entry.status.replace('_', ' ')}
          </span>
        ))}
      </div>
    </div>
  )
}
