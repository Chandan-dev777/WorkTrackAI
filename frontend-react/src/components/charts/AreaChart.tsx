import { ResponsiveContainer, AreaChart as ReAreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import type { DailyHours } from '@/api/dashboard'

export function AreaChart({ data, height = 200 }: { data: DailyHours[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ReAreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: '8px', fontSize: '12px' }} />
        <Area type="monotone" dataKey="hours" stroke="var(--color-brand-primary)" strokeWidth={2} fill="rgba(99,102,241,0.1)" dot={false} activeDot={{ r: 4 }} />
      </ReAreaChart>
    </ResponsiveContainer>
  )
}
