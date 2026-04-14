import { ResponsiveContainer, BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { CategoryHours } from '@/api/dashboard'

export function BarChart({ data, height = 200 }: { data: CategoryHours[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReBarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis dataKey="category" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: '8px', fontSize: '12px' }} />
        <Bar dataKey="hours" fill="var(--color-brand-primary)" radius={[4, 4, 0, 0]} />
      </ReBarChart>
    </ResponsiveContainer>
  )
}
