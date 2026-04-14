import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { dashboardApi } from '@/api/dashboard'
import { worklogsApi } from '@/api/worklogs'
import { MetricCard } from '@/components/common/Card'
import { SkeletonCard, SkeletonTable } from '@/components/common/Skeleton'
import { AreaChart } from '@/components/charts/AreaChart'
import { BarChart } from '@/components/charts/BarChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { formatDateShort } from '@/utils/formatDate'
import { cn } from '@/utils/cn'
import type { WorkItem } from '@/types/models'

// ── Date range helpers ────────────────────────────────────────────────────────

function getDateParams(preset: string) {
  const end = new Date()
  const start = new Date()
  if (preset === 'last_7') start.setDate(end.getDate() - 7)
  else if (preset === 'last_30') start.setDate(end.getDate() - 30)
  else start.setDate(end.getDate() - 90)
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0],
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

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  done: '#10B981', in_progress: '#0EA5E9', blocked: '#F43F5E', planned: '#9CA3AF',
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const color = STATUS_COLOR[status] ?? '#9CA3AF'
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: `${color}18`, border: `1px solid ${color}4D`, color }}>
      {status.replace('_', ' ')}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  const [dateRange, setDateRange] = useState('last_30')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHours, setEditHours] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const dateParams = useMemo(() => getDateParams(dateRange), [dateRange])

  const summaryQ   = useQuery({ queryKey: ['dashboard-summary', dateRange],   queryFn: () => dashboardApi.getSummary(dateParams) })
  const categoriesQ = useQuery({ queryKey: ['dashboard-categories', dateRange], queryFn: () => dashboardApi.getCategories(dateParams) })
  const statusQ    = useQuery({ queryKey: ['dashboard-status', dateRange],    queryFn: () => dashboardApi.getStatus(dateParams) })
  const trendQ     = useQuery({ queryKey: ['dashboard-trend', dateRange],     queryFn: () => dashboardApi.getTrend(dateParams) })
  const itemsQ     = useQuery({ queryKey: ['worklogs-my', dateRange],         queryFn: () => worklogsApi.getMy(dateParams) })

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
      setEditingId(null)
      setEditHours('')
      queryClient.invalidateQueries({ queryKey: ['worklogs-my'] })
    } catch {
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
        <a href="/submit"
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--color-brand-primary)', color: '#fff' }}>
          + Submit Update
        </a>
      </div>

      {/* Zone 2 — Date Range Filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="date-range" className="text-sm font-medium"
          style={{ color: 'var(--color-text-secondary)' }}>
          Date range:
        </label>
        <select
          id="date-range"
          aria-label="Date range"
          value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="rounded-md px-3 py-1.5 text-sm"
          style={cellStyle}
        >
          <option value="last_7">Last 7 Days</option>
          <option value="last_30">Last 30 Days</option>
          <option value="last_90">Last 90 Days</option>
        </select>
      </div>

      {/* Zone 3 — Metric Cards */}
      {summaryQ.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : summaryQ.data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Total Hours" value={summaryQ.data.total_hours}      icon="clock" />
          <MetricCard label="Tasks Done"  value={summaryQ.data.done_count}      icon="chart" />
          <MetricCard label="In Progress" value={summaryQ.data.in_progress_count} icon="chart" />
          <MetricCard label="Blocked"     value={summaryQ.data.blocked_count}   icon="alert" />
        </div>
      ) : null}

      {/* Zone 4 — Charts */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <section style={sectionStyle} aria-labelledby="trend-heading">
          <h2 id="trend-heading" className="text-base font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}>
            Daily Hours Logged
          </h2>
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
            <a href="/submit" className="mt-3 inline-block text-sm font-medium"
              style={{ color: 'var(--color-brand-primary)' }}>
              Submit an update →
            </a>
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
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id}
                    className="transition-colors"
                    style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>

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
                      <StatusBadge status={item.status} />
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
