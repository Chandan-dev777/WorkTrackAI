import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Clock, AlertCircle, UserCheck } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { dashboardApi } from '@/api/dashboard'
import { worklogsApi } from '@/api/worklogs'
import { MetricCard } from '@/components/common/Card'
import { SkeletonCard, SkeletonTable } from '@/components/common/Skeleton'
import { formatDateShort } from '@/utils/formatDate'
import { cn } from '@/utils/cn'
import type { WorkItem } from '@/types/models'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

export default function TeamDashboardPage() {
  const [dateRange, setDateRange] = useState('last_30')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tableEmployeeFilter, setTableEmployeeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false)
  const [memberView, setMemberView] = useState<'top3' | 'all'>('top3')

  const dateParams = useMemo(() => getDateParams(dateRange), [dateRange])

  const teamSummaryQ  = useQuery({ queryKey: ['team-summary', dateRange],     queryFn: () => dashboardApi.getTeamSummary(dateParams) })
  const teamCategoriesQ = useQuery({ queryKey: ['team-categories', dateRange], queryFn: () => dashboardApi.getTeamCategories(dateParams) })
  const teamItemsQ    = useQuery({
    queryKey: ['worklogs-team', dateRange, selectedEmployee],
    queryFn: () => worklogsApi.getTeam({ ...dateParams, employee_id: selectedEmployee || undefined }),
  })

  const members = teamSummaryQ.data ?? []
  const allItems = teamItemsQ.data ?? []

  // KPI aggregations
  const totalHours   = Math.round(members.reduce((s, m) => s + m.total_hours, 0))
  const totalDone    = members.reduce((s, m) => s + m.done_count, 0)
  const totalBlocked = members.reduce((s, m) => s + m.blocked_count, 0)
  const activeMembers = members.length

  // Filtered table items
  const filteredItems = allItems.filter((item: WorkItem) => {
    if (tableEmployeeFilter && item.employee_id !== tableEmployeeFilter) return false
    if (statusFilter && item.status !== statusFilter) return false
    if (categoryFilter && item.work_category !== categoryFilter) return false
    if (needsReviewOnly && !item.needs_review) return false
    return true
  })

  // Blocked items for the panel
  const blockedItems = allItems.filter((item: WorkItem) => item.status === 'blocked')

  // Chart data — hours per employee
  const employeeChartData = members.map(m => ({
    name: m.full_name.split(' ')[0], // first name for brevity
    hours: m.total_hours,
  }))

  // Category chart data
  const categoryChartData = (teamCategoriesQ.data ?? []).map(c => ({
    category: c.category,
    hours: c.hours,
  }))

  const uniqueStatuses    = [...new Set(allItems.map(i => i.status).filter(Boolean) as string[])].sort()
  const uniqueCategories  = [...new Set(allItems.map(i => i.work_category).filter(Boolean) as string[])].sort()

  // Sorted members for summary cards
  const sortedMembers = [...members].sort((a, b) => b.total_hours - a.total_hours)
  const visibleMembers = memberView === 'top3'
    ? (selectedEmployee ? members.filter(m => m.employee_id === selectedEmployee) : sortedMembers.slice(0, 3))
    : (selectedEmployee ? members.filter(m => m.employee_id === selectedEmployee) : sortedMembers)

  return (
    <div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1440px' }}>

      {/* Zone 1 — Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Team Dashboard
          </h1>
          {members.length > 0 && (
            <span className="mt-1 inline-flex items-center gap-1 text-sm px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--color-brand-primary)' }}>
              <Users size={13} />
              {members.length} members
            </span>
          )}
        </div>
      </div>

      {/* Zone 2 — Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="team-date-range" className="text-sm font-medium"
          style={{ color: 'var(--color-text-secondary)' }}>Date range:</label>
        <select id="team-date-range" aria-label="Date range" value={dateRange}
          onChange={e => setDateRange(e.target.value)}
          className="rounded-md px-3 py-1.5 text-sm" style={cellStyle}>
          <option value="last_7">Last 7 Days</option>
          <option value="last_30">Last 30 Days</option>
          <option value="last_90">Last 90 Days</option>
        </select>

        <select aria-label="Filter by employee" value={selectedEmployee}
          onChange={e => setSelectedEmployee(e.target.value)}
          className="rounded-md px-3 py-1.5 text-sm" style={cellStyle}>
          <option value="">All Employees</option>
          {members.map(m => (
            <option key={m.employee_id} value={m.employee_id}>{m.full_name}</option>
          ))}
        </select>
      </div>

      {/* Zone 3 — Team KPI Cards */}
      {teamSummaryQ.isLoading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <MetricCard label="Total Team Hours" value={totalHours}    icon="clock" />
          <MetricCard label="Tasks Done"        value={totalDone}    icon="chart" />
          <MetricCard label="Blocked"           value={totalBlocked} icon="alert" />
          <MetricCard label="Active Members"    value={activeMembers} icon="users" />
        </div>
      )}

      {/* Zone 4 — Charts */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <section style={sectionStyle} aria-labelledby="emp-chart-heading">
          <h2 id="emp-chart-heading" className="text-base font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}>
            Hours by Employee
          </h2>
          {teamSummaryQ.isLoading ? <SkeletonCard className="h-48" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={employeeChartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="hours" fill="var(--color-brand-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section style={sectionStyle} aria-labelledby="cat-chart-heading">
          <h2 id="cat-chart-heading" className="text-base font-semibold mb-4"
            style={{ color: 'var(--color-text-primary)' }}>
            Team Categories
          </h2>
          {teamCategoriesQ.isLoading ? <SkeletonCard className="h-48" /> : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={categoryChartData} layout="vertical" margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} />
                <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={80} />
                <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: '8px', fontSize: '12px' }} />
                <Bar dataKey="hours" fill="var(--color-brand-secondary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* Zone 5 — Employee Summary Cards */}
      <section aria-labelledby="emp-summary-heading">
        <div className="flex items-center justify-between mb-4">
          <h2 id="emp-summary-heading" className="text-lg font-semibold"
            style={{ color: 'var(--color-text-primary)' }}>
            Employee Summary
          </h2>
          {!selectedEmployee && (
            <div className="flex rounded-lg overflow-hidden text-xs font-medium"
              style={{ border: '1px solid var(--color-border-default)' }}>
              {(['top3', 'all'] as const).map(v => (
                <button key={v} onClick={() => setMemberView(v)}
                  className="px-3 py-1.5 transition-colors"
                  style={{
                    background: memberView === v ? 'var(--color-brand-primary)' : 'var(--color-bg-elevated)',
                    color: memberView === v ? '#fff' : 'var(--color-text-secondary)',
                  }}>
                  {v === 'top3' ? 'Top 3' : 'All'}
                </button>
              ))}
            </div>
          )}
        </div>
        {teamSummaryQ.isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleMembers.map(member => {
              const hasBlocked = member.blocked_count > 0
              return (
                <div key={member.employee_id} className="rounded-xl p-5 flex flex-col gap-3"
                  style={{
                    background: 'var(--color-bg-surface)',
                    border: `1px solid ${hasBlocked ? 'rgba(244,63,94,0.4)' : 'var(--color-border-subtle)'}`,
                    boxShadow: hasBlocked ? '0 0 0 1px rgba(244,63,94,0.15)' : 'none',
                  }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                        {member.full_name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                        {member.employee_id}
                      </p>
                    </div>
                    {hasBlocked && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>
                        {member.blocked_count} blocked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    <span><Clock size={11} className="inline mr-1" />{member.total_hours.toFixed(1)}h</span>
                    <span>✅ {member.done_count} done</span>
                    {hasBlocked && (
                      <span style={{ color: '#F43F5E' }}>🚫 {member.blocked_count} blocked</span>
                    )}
                  </div>
                  {member.last_activity && (
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Last activity: {formatDateShort(member.last_activity)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Zone 6 — Blocked Items Panel */}
      <section style={sectionStyle} aria-labelledby="blocked-heading">
        <h2 id="blocked-heading" className="text-base font-semibold mb-4 flex items-center gap-2"
          style={{ color: 'var(--color-text-primary)' }}>
          <AlertCircle size={16} color="var(--color-status-danger)" />
          Blocked Items
          {blockedItems.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>
              {blockedItems.length}
            </span>
          )}
        </h2>

        {teamItemsQ.isLoading ? (
          <SkeletonCard />
        ) : blockedItems.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            No blocked items — the team is unblocked.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {blockedItems.map(item => (
              <div key={item.id} className="flex items-start gap-3 rounded-lg px-4 py-3"
                style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <AlertCircle size={14} color="#F43F5E" className="mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                    {item.task_description}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {item.employee_name ?? item.employee_id} · {formatDateShort(item.work_date)}
                    {item.hours_spent != null && ` · ${item.hours_spent}h`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Zone 6 — Team Work Items Table */}
      <section aria-labelledby="team-items-heading">
        <h2 id="team-items-heading" className="text-lg font-semibold mb-4"
          style={{ color: 'var(--color-text-primary)' }}>
          Team Work Items
        </h2>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          <select aria-label="Filter table by employee" value={tableEmployeeFilter}
            onChange={e => setTableEmployeeFilter(e.target.value)}
            className="rounded-md px-3 py-1.5 text-sm" style={cellStyle}>
            <option value="">All Employees</option>
            {members.map(m => (
              <option key={m.employee_id} value={m.employee_id}>{m.full_name}</option>
            ))}
          </select>

          <select aria-label="Filter by status" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-md px-3 py-1.5 text-sm" style={cellStyle}>
            <option value="">All Statuses</option>
            {uniqueStatuses.map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          <select aria-label="Filter by category" value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="rounded-md px-3 py-1.5 text-sm" style={cellStyle}>
            <option value="">All Categories</option>
            {uniqueCategories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 text-sm cursor-pointer"
            style={{ color: 'var(--color-text-secondary)' }}>
            <input type="checkbox" aria-label="Needs review only"
              checked={needsReviewOnly}
              onChange={e => setNeedsReviewOnly(e.target.checked)}
              className="rounded" />
            Needs review only
          </label>
        </div>

        {teamItemsQ.isLoading ? (
          <SkeletonTable rows={5} cols={6} />
        ) : filteredItems.length === 0 ? (
          <div className="rounded-xl py-12 text-center"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No work items match the current filters.
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--color-border-subtle)' }}>
            <table className="w-full border-collapse" aria-label="Team work items">
              <thead>
                <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border-default)' }}>
                  {['Date', 'Employee', 'Description', 'Category', 'Hours', 'Status'].map(h => (
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
                    className={cn('transition-colors', item.status === 'blocked' && 'bg-rose-500/5')}
                    style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {formatDateShort(item.work_date)}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      <span className="inline-flex items-center gap-1">
                        <UserCheck size={12} />
                        {item.employee_name ?? item.employee_id}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-primary)', maxWidth: '280px' }}>
                      <span className="truncate block">{item.task_description}</span>
                      {item.needs_review && (
                        <span className="text-xs mt-0.5 block" style={{ color: '#F59E0B' }}>⚠ Needs review</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      {item.work_category}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--color-text-primary)' }}>
                      {item.hours_spent ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
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
