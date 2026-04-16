import { ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts'
import type { CategoryHours } from '@/api/dashboard'

// Semantic colours per category — real hex values (CSS vars don't work in SVG fill)
const CATEGORY_COLORS: Record<string, string> = {
  project:                '#6366F1',
  ticket:                 '#8B5CF6',
  polaris_classification: '#A78BFA',
  meeting:                '#0EA5E9',
  admin:                  '#6B7280',
  learning:               '#10B981',
  support:                '#F59E0B',
  documentation:          '#34D399',
  review:                 '#06B6D4',
  other:                  '#4B5563',
}

function EmptyState({ height }: { height: number }) {
  return (
    <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>No data for this period</p>
    </div>
  )
}

export function BarChart({ data, height = 200 }: { data: CategoryHours[]; height?: number }) {
  if (!data.length) return <EmptyState height={height} />

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis
          dataKey="category"
          tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: string) => v.replace('_', ' ')}
        />
        <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />

        <Tooltip
          contentStyle={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '10px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            fontSize: '12px',
            padding: '8px 12px',
          }}
          labelStyle={{ color: 'var(--color-text-secondary)', textTransform: 'capitalize', marginBottom: '4px' }}
          itemStyle={{ fontFamily: 'monospace', fontWeight: 600 }}
          formatter={(value) => [`${Number(value).toFixed(1)}h`, 'Hours']}
          labelFormatter={(label) => String(label).replace('_', ' ')}
        />

        <Bar dataKey="hours" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={800} animationEasing="ease-out">
          {data.map((entry) => (
            <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category] ?? '#6366F1'} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  )
}
