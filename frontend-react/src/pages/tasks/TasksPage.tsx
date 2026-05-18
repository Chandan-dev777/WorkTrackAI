import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { Pencil, Download, ListTodo } from 'lucide-react'
import { toast } from 'sonner'
import { worklogsApi } from '@/api/worklogs'
import { OpenTasksPanel } from '@/components/common/OpenTasksPanel'
import { WorkStatusBadge } from '@/components/common/WorkStatusBadge'
import { StaggerList, StaggerItem } from '@/components/common/StaggerList'
import { SkeletonTable } from '@/components/common/Skeleton'
import { formatDateShort } from '@/utils/formatDate'
import { cn } from '@/utils/cn'
import type { WorkItem } from '@/types/models'

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

const cellStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  color: 'var(--color-text-primary)',
}

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
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `tasks-${startDate}-to-${endDate}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function TasksPage() {
  const queryClient = useQueryClient()

  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate]     = useState(TODAY)
  const [search, setSearch]       = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter]     = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHours, setEditHours] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  const dateParams = useMemo(() => ({ start_date: startDate, end_date: endDate }), [startDate, endDate])
  const dateKey    = `${startDate}__${endDate}`

  const itemsQ = useQuery({
    queryKey: ['tasks-my', dateKey],
    queryFn: () => worklogsApi.getMy(dateParams),
    placeholderData: keepPreviousData,
  })

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
      queryClient.invalidateQueries({ queryKey: ['tasks-my'] })
    } catch {
      toast.error('Failed to save changes.')
      setEditError('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1440px' }}>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <ListTodo size={22} color="var(--color-brand-primary)" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Tasks
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {itemsQ.data
                ? `${filteredItems.length} task${filteredItems.length !== 1 ? 's' : ''} in this period`
                : 'Loading tasks…'}
            </p>
          </div>
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

      {/* Date Range Filter */}
      <div className="flex flex-wrap items-center gap-2">
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
              }}>
              Last {p.label}
            </button>
          )
        })}
        <span style={{ color: 'var(--color-border-strong)', fontSize: 12 }}>|</span>
        <input
          type="date" aria-label="Start date"
          value={startDate} max={endDate}
          onChange={e => setStartDate(e.target.value)}
          className="rounded-md px-2 py-1 text-xs" style={cellStyle}
        />
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>to</span>
        <input
          type="date" aria-label="End date"
          value={endDate} min={startDate} max={TODAY}
          onChange={e => setEndDate(e.target.value)}
          className="rounded-md px-2 py-1 text-xs" style={cellStyle}
        />
      </div>

      {/* Work Items Table */}
      <section aria-labelledby="tasks-heading">
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

        {itemsQ.isLoading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl py-16 text-center"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              No tasks found. Try adjusting filters or submit an update.
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
                  {['Date', 'Description', 'Category', 'Project', 'Hours', 'Status', 'Actions'].map(h => (
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

                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)', maxWidth: '280px' }}>
                      <span className="truncate block">{item.task_description}</span>
                    </td>

                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.work_category}
                    </td>

                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                      {item.project_name
                        ? <Link to="/projects" style={{ color: 'var(--color-brand-primary)', textDecoration: 'none', fontSize: 12 }}>{item.project_name}</Link>
                        : <span style={{ fontSize: 12 }}>—</span>}
                    </td>

                    <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--color-text-primary)' }}>
                      {editingId === item.id ? (
                        <input
                          type="number"
                          aria-label="Hours"
                          value={editHours}
                          onChange={e => setEditHours(e.target.value)}
                          min="0" step="0.5"
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
