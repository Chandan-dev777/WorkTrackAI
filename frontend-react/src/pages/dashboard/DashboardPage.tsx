import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Pencil, Download } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { dashboardApi } from '@/api/dashboard'
import { worklogsApi } from '@/api/worklogs'
import { toast } from 'sonner'
import { MetricCard } from '@/components/common/Card'
import { BenchmarkCard } from '@/components/common/BenchmarkCard'
import { WorkStatusBadge } from '@/components/common/WorkStatusBadge'
import { StaggerList, StaggerItem } from '@/components/common/StaggerList'
import { SkeletonCard, SkeletonTable } from '@/components/common/Skeleton'
import { AreaChart } from '@/components/charts/AreaChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { ProductivityHeatmap } from '@/components/charts/ProductivityHeatmap'
import { AskAiButton } from '@/components/ai/AskAiButton'
import { OpenTasksPanel } from '@/components/common/OpenTasksPanel'
import { formatDateShort } from '@/utils/formatDate'
import { cn } from '@/utils/cn'
import type { WorkItem } from '@/types/models'

// ── Date range helpers ────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0]

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

const PRESETS = [
  { label: '7d',    startDate: daysAgo(7),  endDate: TODAY },
  { label: '30d',   startDate: daysAgo(30), endDate: TODAY },
  { label: '90d',   startDate: daysAgo(90), endDate: TODAY },
] as const

/** Previous period of the same length */
function getPrevDates(startDate: string, endDate: string) {
  const ms   = new Date(endDate).getTime() - new Date(startDate).getTime()
  const days = Math.round(ms / 86_400_000)
  return {
    start_date: daysAgo(days * 2),
    end_date:   daysAgo(days),
  }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

// ── Shared cell style ─────────────────────────────────────────────────────────

const cellStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  color: 'var(--color-text-primary)',
}

// StatusBadge now comes from shared WorkStatusBadge component

// ── CSV export ────────────────────────────────────────────────────────────────

function exportToCSV(items: WorkItem[], startDate: string, endDate: string) {
  const headers = ['Date', 'Description', 'Category', 'Hours', 'Status', 'Priority', 'Project', 'Ticket ID', 'Blockers', 'Next Steps']
  const esc = (s: string | null | undefined) => `"${(s ?? '').replace(/"/g, '""')}"`
  const rows = items.map(i => [
    i.work_date, esc(i.task_description), i.work_category,
    i.hours_spent ?? '', i.status ?? '', i.priority ?? '',
    esc(i.project_name), esc(i.ticket_id), esc(i.blockers), esc(i.next_steps),
  ].join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href = url
  a.download = `worktrack-logs-${startDate}-to-${endDate}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate]     = useState(TODAY)
  const [search, setSearch]       = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter]     = useState('')

  const [editingId, setEditingId]   = useState<string | null>(null)
  const [editHours, setEditHours]   = useState('')
  const [editError, setEditError]   = useState<string | null>(null)
  const [saving, setSaving]         = useState(false)

  const dateParams     = useMemo(() => ({ start_date: startDate, end_date: endDate }),            [startDate, endDate])
  const prevDateParams = useMemo(() => getPrevDates(startDate, endDate),                           [startDate, endDate])
  const dateKey        = `${startDate}__${endDate}`

  const summaryQ     = useQuery({ queryKey: ['dashboard-summary',      dateKey], queryFn: () => dashboardApi.getSummary(dateParams),    placeholderData: keepPreviousData })
  const prevSummaryQ = useQuery({ queryKey: ['dashboard-summary-prev', dateKey], queryFn: () => dashboardApi.getSummary(prevDateParams), placeholderData: keepPreviousData })
  const categoriesQ  = useQuery({ queryKey: ['dashboard-categories',   dateKey], queryFn: () => dashboardApi.getCategories(dateParams), placeholderData: keepPreviousData })
  const statusQ      = useQuery({ queryKey: ['dashboard-status',       dateKey], queryFn: () => dashboardApi.getStatus(dateParams),     placeholderData: keepPreviousData })
  const trendQ       = useQuery({ queryKey: ['dashboard-trend',        dateKey], queryFn: () => dashboardApi.getTrend(dateParams),      placeholderData: keepPreviousData })
  const itemsQ       = useQuery({ queryKey: ['worklogs-my',            dateKey], queryFn: () => worklogsApi.getMy(dateParams),          placeholderData: keepPreviousData })

  const firstName = user?.full_name.split(' ')[0] ?? 'there'

  const allItems = itemsQ.data ?? []
  const uniqueCategories = [...new Set(allItems.map(i => i.work_category))].sort()
  const uniqueStatuses   = [...new Set(allItems.map(i => i.status).filter(Boolean) as string[])].sort()

  const filteredItems = allItems.filter(item => {
    if (search && !item.task_description.toLowerCase().includes(search.toLowerCase())) return false
    if (categoryFilter && item.work_category !== categoryFilter) return false
    if (statusFilter && item.status !== statusFilter) return false
    return true
  })

  function startEdit(item: WorkItem) {
    setEditingId(item.id)
    setEditHours(String(item.hours_spent ?? ''))
    setEditError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditHours('')
    setEditError(null)
  }

  async function saveEdit(id: string) {
    setSaving(true)
    setEditError(null)
    try {
      await worklogsApi.updateItem(id, { hours_spent: parseFloat(editHours) || 0 })
      toast.success('Hours updated')
      setEditingId(null)
      setEditHours('')
      queryClient.invalidateQueries({ queryKey: ['worklogs-my'] })
    } catch {
      toast.error('Failed to save changes.')
      setEditError('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const sectionStyle: React.CSSProperties = {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-subtle)',
    borderRadius: '12px',
    padding: '24px',
  }

  return (
    <div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1440px' }}>

      {/* Zone 1 — Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {summaryQ.data
              ? `${summaryQ.data.total_items} work items logged this period`
              : 'Loading your work summary…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportToCSV(allItems, startDate, endDate)}
            disabled={allItems.length === 0}
            aria-label="Export to CSV"
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-all"
            style={{
              border: '1px solid var(--color-border-default)',
              color: allItems.length > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
              background: 'var(--color-bg-surface)',
              opacity: allItems.length > 0 ? 1 : 0.5,
              cursor: allItems.length > 0 ? 'pointer' : 'not-allowed',
            }}>
            <Download size={13} /> Export CSV
          </button>
          <Link to="/submit"
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: 'var(--color-brand-primary)', color: '#fff', textDecoration: 'none' }}>
            + Submit Update
          </Link>
        </div>
      </div>

      {/* Open Tasks Quick-Action Panel */}
      <OpenTasksPanel />

      {/* Zone 2 — Date Range Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Preset pills */}
        {PRESETS.map(p => {
          const active = startDate === p.startDate && endDate === p.endDate
          return (
            <button
              key={p.label}
              onClick={() => { setStartDate(p.startDate); setEndDate(p.endDate) }}
              className="rounded-full px-3 py-1 text-xs font-medium transition-all"
              style={{
                background: active ? 'var(--color-brand-primary)' : 'var(--color-bg-elevated)',
                color: active ? '#fff' : 'var(--color-text-secondary)',
                border: active ? 'none' : '1px solid var(--color-border-default)',
              }}
            >
              Last {p.label}
            </button>
          )
        })}

        {/* Custom range divider */}
        <span style={{ color: 'var(--color-border-strong)', fontSize: 12 }}>|</span>

        {/* From date */}
        <input
          type="date"
          aria-label="Start date"
          value={startDate}
          max={endDate}
          onChange={e => setStartDate(e.target.value)}
          className="rounded-md px-2 py-1 text-xs"
          style={cellStyle}
        />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>to</span>
        {/* To date */}
        <input
          type="date"
          aria-label="End date"
          value={endDate}
          min={startDate}
          max={TODAY}
          onChange={e => setEndDate(e.target.value)}
          className="rounded-md px-2 py-1 text-xs"
          style={cellStyle}
        />
      </div>

      {/* Zone 3 — Metric Cards */}
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

      {/* You vs Previous Period benchmark */}
      {summaryQ.data && prevSummaryQ.data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <BenchmarkCard
            label="Hours — this vs prev period"
            you={Math.round(summaryQ.data.total_hours * 10) / 10}
            average={Math.round(prevSummaryQ.data.total_hours * 10) / 10}
            unit="h"
          />
          <BenchmarkCard
            label="Tasks Done — this vs prev period"
            you={summaryQ.data.done_count}
            average={prevSummaryQ.data.done_count}
          />
          <BenchmarkCard
            label="Blocked — this vs prev period"
            you={summaryQ.data.blocked_count}
            average={prevSummaryQ.data.blocked_count}
          />
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

      {/* Zone 4 — Charts */}
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
          <h2 id="status-heading" className="text-base font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}>
            Tasks by Status
          </h2>
          {statusQ.isLoading
            ? <SkeletonCard className="h-48" />
            : <DonutChart data={statusQ.data ?? []} height={180} />}
        </section>
      </div>

      <section style={sectionStyle} aria-labelledby="category-heading">
        <h2 id="category-heading" className="text-base font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)' }}>
          Hours by Category
        </h2>
        {categoriesQ.isLoading
          ? <SkeletonCard className="h-48" />
          : <BarChart data={categoriesQ.data ?? []} height={180} />}
      </section>

      {/* Zone 5 — Work Items Table */}
      <section aria-labelledby="items-heading">
        <h2 id="items-heading" className="text-lg font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)' }}>
          Work Items
        </h2>

        {/* Filter toolbar */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            type="text"
            aria-label="Search work items"
            placeholder="Search by description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-md px-3 py-1.5 text-sm flex-1 min-w-48"
            style={cellStyle}
          />
          <select
            aria-label="Filter by category"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="rounded-md px-3 py-1.5 text-sm"
            style={cellStyle}
          >
            <option value="">All Categories</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-md px-3 py-1.5 text-sm"
            style={cellStyle}
          >
            <option value="">All Statuses</option>
            {uniqueStatuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>

        {/* Content */}
        {itemsQ.isLoading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl py-16 text-center"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              No work items yet. Submit your first update to get started.
            </p>
            <Link to="/submit" className="mt-3 inline-block text-sm font-medium"
              style={{ color: 'var(--color-brand-primary)' }}>
              Submit an update →
            </Link>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border-subtle)' }}>
            <table className="w-full border-collapse" aria-label="Work items">
              <thead>
                <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border-default)' }}>
                  {['Date', 'Description', 'Category', 'Hours', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
                      style={{ color: 'var(--color-text-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <StaggerList as="tbody">
                {filteredItems.map(item => (
                  <StaggerItem as="tr" key={item.id}
                    className="transition-colors"
                    style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                    onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                    onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => (e.currentTarget.style.background = '')}>

                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDateShort(item.work_date)}
                    </td>

                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)', maxWidth: '320px' }}>
                      <span className="truncate block">{item.task_description}</span>
                    </td>

                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.work_category}
                    </td>

                    <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--color-text-primary)' }}>
                      {editingId === item.id ? (
                        <input
                          type="number"
                          aria-label="Hours"
                          value={editHours}
                          onChange={e => setEditHours(e.target.value)}
                          min="0"
                          step="0.5"
                          className={cn('w-20 rounded px-2 py-1 text-sm')}
                          style={cellStyle}
                        />
                      ) : (
                        item.hours_spent ?? '—'
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <WorkStatusBadge status={item.status} />
                    </td>

                    <td className="px-4 py-3">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => saveEdit(item.id)}
                            disabled={saving}
                            aria-label="Save"
                            className={cn('rounded px-3 py-1 text-xs font-semibold', saving && 'opacity-50 cursor-not-allowed')}
                            style={{ background: 'var(--color-brand-primary)', color: '#fff' }}>
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            aria-label="Cancel"
                            className="rounded px-3 py-1 text-xs font-medium"
                            style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
                            Cancel
                          </button>
                          {editError && (
                            <span className="text-xs" style={{ color: 'var(--color-status-danger)' }}>
                              {editError}
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(item)}
                          aria-label={`Edit ${item.task_description}`}
                          className="rounded p-1.5 transition-colors"
                          style={{ color: 'var(--color-text-muted)' }}>
                          <Pencil size={14} />
                        </button>
                      )}
                    </td>
                  </StaggerItem>
                ))}
              </StaggerList>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
