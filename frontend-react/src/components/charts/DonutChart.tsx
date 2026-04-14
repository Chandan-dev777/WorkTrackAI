import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'
import type { StatusCount } from '@/api/dashboard'

const STATUS_COLORS: Record<string, string> = {
  done: '#10B981',
  in_progress: '#0EA5E9',
  blocked: '#F43F5E',
  planned: '#4B5563',
}

export function DonutChart({ data, height = 200 }: { data: StatusCount[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={2}>
          {data.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#374151'} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: '8px', fontSize: '12px' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '12px', color: 'var(--color-text-secondary)', paddingTop: '8px' }}
          formatter={(value) => value.replace('_', ' ')}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
