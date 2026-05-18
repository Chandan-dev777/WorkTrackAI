import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { ListTodo, FolderKanban, BarChart3 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { dashboardApi } from '@/api/dashboard'
import { worklogsApi } from '@/api/worklogs'
import { MetricCard } from '@/components/common/Card'
import { BenchmarkCard } from '@/components/common/BenchmarkCard'
import { SkeletonCard } from '@/components/common/Skeleton'
import { AreaChart } from '@/components/charts/AreaChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { ProductivityHeatmap } from '@/components/charts/ProductivityHeatmap'
import { AskAiButton } from '@/components/ai/AskAiButton'

// ── Date range helpers ────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const PRESETS = [
  { label: '7d',  startDate: daysAgo(7),  endDate: TODAY },
  { label: '30d', startDate: daysAgo(30), endDate: TODAY },
  { label: '90d', startDate: daysAgo(90), endDate: TODAY },
] as const

function getPrevDates(startDate: string, endDate: string) {
  const ms   = new Date(endDate).getTime() - new Date(startDate).getTime()
  const days = Math.round(ms / 86_400_000)
  return { start_date: daysAgo(days * 2), end_date: daysAgo(days) }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

const cellStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  color: 'var(--color-text-primary)',
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '12px',
  padding: '24px',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)

  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate]     = useState(TODAY)

  const dateParams     = useMemo(() => ({ start_date: startDate, end_date: endDate }), [startDate, endDate])
  const prevDateParams = useMemo(() => getPrevDates(startDate, endDate),               [startDate, endDate])
  const dateKey        = `${startDate}__${endDate}`

  const summaryQ     = useQuery({ queryKey: ['dashboard-summary',      dateKey], queryFn: () => dashboardApi.getSummary(dateParams),    placeholderData: keepPreviousData })
  const prevSummaryQ = useQuery({ queryKey: ['dashboard-summary-prev', dateKey], queryFn: () => dashboardApi.getSummary(prevDateParams), placeholderData: keepPreviousData })
  const categoriesQ  = useQuery({ queryKey: ['dashboard-categories',   dateKey], queryFn: () => dashboardApi.getCategories(dateParams), placeholderData: keepPreviousData })
  const statusQ      = useQuery({ queryKey: ['dashboard-status',       dateKey], queryFn: () => dashboardApi.getStatus(dateParams),     placeholderData: keepPreviousData })
  const trendQ       = useQuery({ queryKey: ['dashboard-trend',        dateKey], queryFn: () => dashboardApi.getTrend(dateParams),      placeholderData: keepPreviousData })
  // Still fetch items for sparklines on MetricCards
  const itemsQ       = useQuery({ queryKey: ['worklogs-my',            dateKey], queryFn: () => worklogsApi.getMy(dateParams),          placeholderData: keepPreviousData })

  const firstName  = user?.full_name.split(' ')[0] ?? 'there'
  const allItems   = itemsQ.data ?? []

  return (
    <div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1440px' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {summaryQ.data
              ? `${summaryQ.data.total_items} work items logged this period`
              : 'Loading your analytics…'}
          </p>
        </div>
        <Link to="/submit"
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--color-brand-primary)', color: '#fff', textDecoration: 'none' }}>
          + Submit Update
        </Link>
      </div>

      {/* Navigation strip — quick links to Tasks and Projects */}
      <div className="flex gap-3">
        {[
          { to: '/tasks',    icon: ListTodo,     label: 'Manage Tasks',    desc: 'View, search & update all tasks',  color: '#6366F1' },
          { to: '/projects', icon: FolderKanban, label: 'View Projects',   desc: 'Browse work grouped by project',   color: '#8B5CF6' },
        ].map(({ to, icon: Icon, label, desc, color }) => (
          <Link key={to} to={to}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 18px', borderRadius: 12, textDecoration: 'none',
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}18`, flexShrink: 0 }}>
              <Icon size={17} color={color} />
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>{label}</p>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{desc}</p>
            </div>
          </Link>
        ))}
        <Link to="/my-dashboard"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 18px', borderRadius: 12, textDecoration: 'none',
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}
        >
          <div style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(14,165,233,0.1)', flexShrink: 0 }}>
            <BarChart3 size={17} color="#0EA5E9" />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 2 }}>Full Analytics</p>
            <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Charts, trends & benchmarks</p>
          </div>
        </Link>
      </div>

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map(p => {
          const active = startDate === p.startDate && endDate === p.endDate
          return (
            <button key={p.label}
              onClick={() => { setStartDate(p.startDate); setEndDate(p.endDate) }}
              className="rounded-full px-3 py-1 text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--color-brand-primary)' : 'var(--color-bg-elevated)',
                color: active ? '#fff' : 'var(--color-text-secondary)',
                border: active ? 'none' : '1px solid var(--color-border-default)',
              }}>
              Last {p.label}
            </button>
          )
        })}
        <span style={{ color: 'var(--color-border-strong)', fontSize: 12 }}>|</span>
        <input type="date" aria-label="Start date" value={startDate} max={endDate}
          onChange={e => setStartDate(e.target.value)}
          className="rounded-md px-2 py-1 text-xs" style={cellStyle} />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>to</span>
        <input type="date" aria-label="End date" value={endDate} min={startDate} max={TODAY}
          onChange={e => setEndDate(e.target.value)}
          className="rounded-md px-2 py-1 text-xs" style={cellStyle} />
      </div>

      {/* Metric Cards */}
      {summaryQ.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : summaryQ.data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Total Hours" value={summaryQ.data.total_hours}       icon="clock"  accent="brand"   sparklineData={trendQ.data?.map(d => d.hours)} />
          <MetricCard label="Tasks Done"  value={summaryQ.data.done_count}        icon="chart"  accent="success" sparklineData={trendQ.data?.map(d => d.item_count ?? 0)} />
          <MetricCard label="In Progress" value={summaryQ.data.in_progress_count} icon="chart"  accent="info"    />
          <MetricCard label="Blocked"     value={summaryQ.data.blocked_count}     icon="alert"  accent="danger"  />
        </div>
      ) : null}

      {/* Benchmark Cards */}
      {summaryQ.data && prevSummaryQ.data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <BenchmarkCard label="Hours — this vs prev period" you={Math.round(summaryQ.data.total_hours * 10) / 10} average={Math.round(prevSummaryQ.data.total_hours * 10) / 10} unit="h" />
          <BenchmarkCard label="Tasks Done — this vs prev period" you={summaryQ.data.done_count} average={prevSummaryQ.data.done_count} />
          <BenchmarkCard label="Blocked — this vs prev period" you={summaryQ.data.blocked_count} average={prevSummaryQ.data.blocked_count} />
        </div>
      )}

      {/* Productivity Heatmap */}
      {trendQ.data && trendQ.data.length > 0 && (
        <section style={sectionStyle} aria-labelledby="heatmap-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="heatmap-heading" className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Activity Heatmap
            </h2>
            <AskAiButton question="Summarize my activity pattern over the past months" />
          </div>
          <ProductivityHeatmap data={trendQ.data.map(d => ({ date: d.date, count: d.hours }))} weeks={52} />
        </section>
      )}

      {/* Charts */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <section style={sectionStyle} aria-labelledby="trend-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="trend-heading" className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Daily Hours Logged
            </h2>
            <AskAiButton question="Explain the trend in my daily hours this period" />
          </div>
          {trendQ.isLoading
            ? <SkeletonCard className="h-48" />
            : <AreaChart data={trendQ.data ?? []} height={180} />}
        </section>

        <section style={sectionStyle} aria-labelledby="status-heading">
          <h2 id="status-heading" className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Tasks by Status
          </h2>
          {statusQ.isLoading
            ? <SkeletonCard className="h-48" />
            : <DonutChart data={statusQ.data ?? []} height={180} />}
        </section>
      </div>

      <section style={sectionStyle} aria-labelledby="category-heading">
        <h2 id="category-heading" className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
          Hours by Category
        </h2>
        {categoriesQ.isLoading
          ? <SkeletonCard className="h-48" />
          : <BarChart data={categoriesQ.data ?? []} height={180} />}
      </section>

      {/* Footer link to Tasks */}
      {!itemsQ.isLoading && allItems.length > 0 && (
        <div className="text-center py-2">
          <Link to="/tasks" style={{ fontSize: 13, color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
            View all {allItems.length} tasks →
          </Link>
        </div>
      )}
    </div>
  )
}
