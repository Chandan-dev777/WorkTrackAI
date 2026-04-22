import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Users, AlertCircle, UserCheck, Lock, Sparkles, X, RefreshCw, ChevronRight } from 'lucide-react'
import { GlassCard } from '@/components/common/GlassCard'
import { useAuthStore } from '@/store/authStore'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { dashboardApi } from '@/api/dashboard'
import { worklogsApi } from '@/api/worklogs'
import { chatApi } from '@/api/chat'
import { MetricCard } from '@/components/common/Card'
import { WorkStatusBadge } from '@/components/common/WorkStatusBadge'
import { SkeletonCard, SkeletonTable } from '@/components/common/Skeleton'
import { formatDateShort, formatRelative } from '@/utils/formatDate'
import { cn } from '@/utils/cn'
import type { WorkItem } from '@/types/models'

// Semantic category colours — matches BarChart.tsx
const CATEGORY_COLORS: Record<string, string> = {
  project: '#6366F1', ticket: '#8B5CF6', polaris_classification: '#A78BFA',
  meeting: '#0EA5E9', admin: '#6B7280', learning: '#10B981',
  support: '#F59E0B', documentation: '#34D399', review: '#06B6D4', other: '#4B5563',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '12px',
  padding: '24px',
}

// StatusBadge now uses shared WorkStatusBadge component

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TeamDashboardPage() {
  const user     = useAuthStore(s => s.user)
  const isAdmin  = user?.role === 'admin'

  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate]     = useState(TODAY)
  const [adminTeamSearch, setAdminTeamSearch] = useState('')
  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [tableEmployeeFilter, setTableEmployeeFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [needsReviewOnly, setNeedsReviewOnly] = useState(false)
  const [memberView, setMemberView]       = useState<'top3' | 'all'>('top3')
  const [workloadView, setWorkloadView]   = useState<'top5' | 'all'>('top5')
  const [drawerEmployee, setDrawerEmployee] = useState<string | null>(null)
  const [aiHelpResult, setAiHelpResult]   = useState<string | null>(null)
  const [aiHelpLoading, setAiHelpLoading] = useState(false)

  const dateKey    = `${startDate}__${endDate}`
  const dateParams = useMemo(() => ({ start_date: startDate, end_date: endDate }), [startDate, endDate])

  // Managers are locked to their own team; admins can search across teams
  const effectiveTeamName = useMemo(() => {
    if (isAdmin) return adminTeamSearch.trim() || undefined
    return user?.team_name ?? undefined
  }, [isAdmin, adminTeamSearch, user?.team_name])

  const apiParams = useMemo(() => ({
    ...dateParams,
    ...(effectiveTeamName ? { team_name: effectiveTeamName } : {}),
  }), [dateParams, effectiveTeamName])

  const teamSummaryQ    = useQuery({ queryKey: ['team-summary',    dateKey, effectiveTeamName], queryFn: () => dashboardApi.getTeamSummary(apiParams),    placeholderData: keepPreviousData })
  const teamCategoriesQ = useQuery({ queryKey: ['team-categories', dateKey, effectiveTeamName], queryFn: () => dashboardApi.getTeamCategories(apiParams), placeholderData: keepPreviousData })
  const teamItemsQ      = useQuery({
    queryKey: ['worklogs-team', dateKey, selectedEmployee, effectiveTeamName],
    queryFn: () => worklogsApi.getTeam({ ...apiParams, employee_id: selectedEmployee || undefined }),
    placeholderData: keepPreviousData,
  })

  // Separate unfiltered query for workload chart — not affected by selectedEmployee
  const teamAllItemsQ = useQuery({
    queryKey: ['worklogs-team-all', dateKey, effectiveTeamName],
    queryFn: () => worklogsApi.getTeam(apiParams),
    placeholderData: keepPreviousData,
  })

  const members     = teamSummaryQ.data ?? []
  const allItems    = teamItemsQ.data ?? []
  const allTeamItems = teamAllItemsQ.data ?? []

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

  // Workload balance — per-employee category breakdown, sorted by total hours
  // Name lookup from members (authoritative) — avoids falling back to employee IDs
  // Team-scoped by intersecting allTeamItems with the members set (handles null team_name)
  const { workloadData, workloadCats } = useMemo(() => {
    const nameMap: Record<string, string> = {}
    const teamIds = new Set<string>()
    members.forEach(m => { nameMap[m.employee_id] = m.full_name; teamIds.add(m.employee_id) })

    const empMap: Record<string, { name: string; total: number; [cat: string]: string | number }> = {}
    const cats = new Set<string>()

    allTeamItems.forEach((item: WorkItem) => {
      // Only include employees that are in the current team scope
      if (teamIds.size > 0 && !teamIds.has(item.employee_id)) return
      const fullName = nameMap[item.employee_id] ?? item.employee_name ?? item.employee_id
      if (!empMap[item.employee_id]) empMap[item.employee_id] = { name: fullName, total: 0 }
      const h = item.hours_spent ?? 0
      empMap[item.employee_id][item.work_category] = ((empMap[item.employee_id][item.work_category] as number) || 0) + h
      empMap[item.employee_id].total = ((empMap[item.employee_id].total as number) || 0) + h
      cats.add(item.work_category)
    })

    const sorted = Object.values(empMap)
      .sort((a, b) => (b.total as number) - (a.total as number))
      .map(e => {
        const parts = (e.name as string).split(' ')
        const label = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0]
        return { ...e, name: label }
      })
    return { workloadData: sorted, workloadCats: Array.from(cats) }
  }, [allTeamItems, members])

  const uniqueStatuses    = [...new Set(allItems.map(i => i.status).filter(Boolean) as string[])].sort()
  const uniqueCategories  = [...new Set(allItems.map(i => i.work_category).filter(Boolean) as string[])].sort()

  // Per-employee 7-day sparkline data
  const empSparklines = useMemo(() => {
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      return d.toISOString().split('T')[0]
    })
    const result: Record<string, number[]> = {}
    members.forEach(m => { result[m.employee_id] = new Array(7).fill(0) })
    allTeamItems.forEach(item => {
      const idx = last7.indexOf(item.work_date)
      if (idx >= 0 && result[item.employee_id]) {
        result[item.employee_id][idx] += item.hours_spent ?? 0
      }
    })
    return result
  }, [allTeamItems, members])

  // Blocked items sorted by urgency (oldest work_date first)
  const sortedBlocked = useMemo(() => {
    return [...blockedItems].sort((a, b) =>
      new Date(a.work_date).getTime() - new Date(b.work_date).getTime()
    )
  }, [blockedItems])

  // Team narrative
  const teamNarrative = totalHours > 0
    ? `${activeMembers} active member${activeMembers !== 1 ? 's' : ''} · ${totalHours}h logged · ${totalDone} tasks done${totalBlocked > 0 ? ` · ${totalBlocked} blocked` : ' · no blockers'}`
    : null

  // Fetch AI "Who Needs Help" response
  async function fetchWhoNeedsHelp() {
    setAiHelpLoading(true)
    setAiHelpResult(null)
    try {
      const r = await chatApi.query({
        question: 'Which team members need attention based on recent work logs? List names and reasons briefly.',
      })
      setAiHelpResult(r.answer)
    } catch {
      setAiHelpResult('Unable to fetch AI insights right now.')
    } finally {
      setAiHelpLoading(false)
    }
  }

  // Drawer: items for the selected employee
  const drawerMember = members.find(m => m.employee_id === drawerEmployee)
  const drawerItems  = allTeamItems.filter(i => i.employee_id === drawerEmployee).slice(0, 10)

  // Sorted members for summary cards
  const sortedMembers = [...members].sort((a, b) => b.total_hours - a.total_hours)
  const visibleMembers = memberView === 'top3'
    ? (selectedEmployee ? members.filter(m => m.employee_id === selectedEmployee) : sortedMembers.slice(0, 3))
    : (selectedEmployee ? members.filter(m => m.employee_id === selectedEmployee) : sortedMembers)

  return (
    <div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1440px' }}>

      {/* Employee drilldown drawer */}
      <AnimatePresence>
        {drawerEmployee && (
          <>
            <motion.div key="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 40 }}
              onClick={() => setDrawerEmployee(null)} />
            <motion.aside key="drawer"
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              style={{ position: 'fixed', top: 56, right: 0, bottom: 0, width: 440, zIndex: 41,
                background: 'var(--color-bg-surface)', borderLeft: '1px solid var(--color-border-default)',
                overflowY: 'auto', padding: 24, boxShadow: '-4px 0 24px rgba(0,0,0,0.25)' }}>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))', color: '#fff' }}>
                    {drawerMember?.full_name.charAt(0) ?? '?'}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>{drawerMember?.full_name}</p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{drawerMember?.employee_id}</p>
                  </div>
                </div>
                <button onClick={() => setDrawerEmployee(null)} style={{ color: 'var(--color-text-muted)', lineHeight: 0 }}>
                  <X size={18} />
                </button>
              </div>
              {/* Quick stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'Hours', value: `${(drawerMember?.total_hours ?? 0).toFixed(1)}h` },
                  { label: 'Done', value: String(drawerMember?.done_count ?? 0) },
                  { label: 'Blocked', value: String(drawerMember?.blocked_count ?? 0) },
                ].map(s => (
                  <div key={s.label} className="rounded-lg p-3 text-center"
                    style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}>
                    <p className="text-base font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>{s.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {/* Recent items */}
              <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>Recent work</p>
              <div className="flex flex-col gap-2">
                {drawerItems.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No items in this period.</p>
                ) : drawerItems.map(item => (
                  <div key={item.id} className="rounded-lg px-3 py-2.5"
                    style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-text-primary)' }}>{item.task_description}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      {item.work_category} · {item.hours_spent != null ? `${item.hours_spent}h` : '—'} · {formatDateShort(item.work_date)}
                    </p>
                    <WorkStatusBadge status={item.status} />
                  </div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

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

      {/* Team narrative strip */}
      {teamNarrative && (
        <div className="rounded-xl px-5 py-3 flex items-center gap-3"
          style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderLeft: '3px solid var(--color-brand-primary)' }}>
          <Users size={13} color="var(--color-brand-primary)" style={{ flexShrink: 0 }} />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{teamNarrative}</p>
        </div>
      )}

      {/* Zone 2 — Filters */}
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

        <span style={{ color: 'var(--color-border-strong)', fontSize: 12 }}>|</span>

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

        <span style={{ color: 'var(--color-border-strong)', fontSize: 12 }}>|</span>

        {/* Team scope: locked for managers, searchable for admins */}
        {isAdmin ? (
          <input
            type="text"
            aria-label="Filter by team name"
            placeholder="All teams (type to filter)"
            value={adminTeamSearch}
            onChange={e => { setAdminTeamSearch(e.target.value); setSelectedEmployee('') }}
            className="rounded-md px-3 py-1.5 text-sm w-52"
            style={cellStyle}
          />
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--color-brand-primary)' }}>
            <Lock size={11} />
            {user?.team_name ?? 'Your team'}
          </span>
        )}

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

      {/* Zone 4b — Workload Balance: per-employee hours by category */}
      {workloadData.length > 0 && (
        <section style={sectionStyle} aria-labelledby="workload-balance-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="workload-balance-heading" className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Workload Balance — Hours by Category
            </h2>
            <div className="flex rounded-lg overflow-hidden text-xs font-medium"
              style={{ border: '1px solid var(--color-border-default)' }}>
              {(['top5', 'all'] as const).map(v => (
                <button key={v} onClick={() => setWorkloadView(v)}
                  className="px-3 py-1.5 transition-colors"
                  style={{
                    background: workloadView === v ? 'var(--color-brand-primary)' : 'var(--color-bg-elevated)',
                    color: workloadView === v ? '#fff' : 'var(--color-text-secondary)',
                  }}>
                  {v === 'top5' ? 'Top 5' : 'All'}
                </button>
              ))}
            </div>
          </div>
          {teamAllItemsQ.isLoading ? <SkeletonCard className="h-40" /> : (() => {
            const displayData = workloadView === 'top5' ? workloadData.slice(0, 5) : workloadData
            return (
              <>
                <ResponsiveContainer width="100%" height={Math.max(80, displayData.length * 36)}>
                  <BarChart data={displayData} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}h`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} tickLine={false} axisLine={false} width={80} />
                    <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: '8px', fontSize: '12px' }} formatter={(v, name) => [`${typeof v === 'number' ? v.toFixed(1) : v}h`, String(name).replace('_', ' ')]} />
                    {workloadCats.map(cat => (
                      <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat] ?? '#6366F1'} radius={[0, 2, 2, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                {/* Category colour legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 12 }}>
                  {workloadCats.map(cat => (
                    <span key={cat} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-text-secondary)' }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: CATEGORY_COLORS[cat] ?? '#6366F1', flexShrink: 0 }} />
                      {cat.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </>
            )
          })()}
        </section>
      )}

      {/* Zone 5 — Employee Health Cards + Blocked Queue side by side */}
      <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Employee Health Cards */}
        <section aria-labelledby="emp-summary-heading">
          <div className="flex items-center justify-between mb-4">
            <h2 id="emp-summary-heading" className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
              Team Health
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
            <div className="flex flex-col gap-3">{[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleMembers.map(member => {
                const hasBlocked  = member.blocked_count > 0
                const stale = member.last_activity
                  ? (Date.now() - new Date(member.last_activity).getTime()) / 3600000 > 48
                  : false
                const sparkValues = empSparklines[member.employee_id] ?? []
                const sparkMax    = Math.max(...sparkValues, 1)
                return (
                  <button key={member.employee_id}
                    onClick={() => setDrawerEmployee(member.employee_id)}
                    className="rounded-xl p-4 text-left transition-all w-full"
                    style={{
                      background: 'var(--color-bg-surface)',
                      border: `1px solid ${hasBlocked ? 'rgba(244,63,94,0.35)' : stale ? 'rgba(245,158,11,0.35)' : 'var(--color-border-subtle)'}`,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg-surface)')}>
                    <div className="flex items-center gap-3 mb-3">
                      {/* Avatar initial */}
                      <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold"
                        style={{ background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))', color: '#fff' }}>
                        {member.full_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-primary)' }}>{member.full_name}</p>
                        <p className="text-xs" style={{ color: stale ? '#F59E0B' : 'var(--color-text-muted)' }}>
                          {member.last_activity ? `Last: ${formatRelative(member.last_activity)}` : 'No activity'}
                          {stale ? ' ⚠' : ''}
                        </p>
                      </div>
                      {hasBlocked && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0"
                          style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>
                          {member.blocked_count} blocked
                        </span>
                      )}
                      <ChevronRight size={13} color="var(--color-text-muted)" style={{ flexShrink: 0 }} />
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                        <span className="font-mono font-semibold" style={{ color: 'var(--color-text-primary)' }}>{member.total_hours.toFixed(1)}h</span>
                        {' · '}{member.done_count} done
                      </div>
                      {/* Mini 7-day bar sparkline */}
                      <div className="flex items-end gap-0.5 ml-auto" style={{ height: 20 }}>
                        {sparkValues.map((v, i) => (
                          <div key={i} style={{ width: 4, borderRadius: 2, background: v > 0 ? 'var(--color-brand-primary)' : 'var(--color-border-default)', height: `${Math.max(15, (v / sparkMax) * 100)}%`, opacity: 0.8 }} />
                        ))}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* Blocked Items Queue — urgency sorted */}
        <section aria-labelledby="blocked-heading">
          <h2 id="blocked-heading" className="text-base font-semibold mb-4 flex items-center gap-2"
            style={{ color: 'var(--color-text-primary)' }}>
            <AlertCircle size={15} color="var(--color-status-danger)" />
            Blocked Queue
            {sortedBlocked.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(244,63,94,0.12)', color: '#F43F5E' }}>
                {sortedBlocked.length}
              </span>
            )}
          </h2>
          {teamItemsQ.isLoading ? (
            <SkeletonCard />
          ) : sortedBlocked.length === 0 ? (
            <div className="rounded-xl py-8 text-center"
              style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
              <p className="text-sm font-medium" style={{ color: '#10B981' }}>✓ No blocked items</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>Team is unblocked</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {sortedBlocked.map(item => {
                const daysBlocked = Math.floor((Date.now() - new Date(item.work_date).getTime()) / 86400000)
                const critical    = daysBlocked > 3
                return (
                  <div key={item.id} className="flex items-start gap-3 rounded-lg px-4 py-3"
                    style={{
                      background: critical ? 'rgba(244,63,94,0.08)' : 'rgba(244,63,94,0.04)',
                      border: `1px solid ${critical ? 'rgba(244,63,94,0.35)' : 'rgba(244,63,94,0.18)'}`,
                    }}>
                    <AlertCircle size={13} color="#F43F5E" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>
                        {item.task_description}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                        {item.employee_name ?? item.employee_id} · {formatDateShort(item.work_date)}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: critical ? 'rgba(244,63,94,0.15)' : 'transparent', color: critical ? '#F43F5E' : 'var(--color-text-muted)' }}>
                      {daysBlocked}d
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Who Needs Help AI card */}
          <GlassCard className="mt-4 overflow-hidden" style={{ borderColor: 'rgba(139,92,246,0.25)' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ borderBottom: aiHelpResult || aiHelpLoading ? '1px solid rgba(139,92,246,0.15)' : 'none' }}>
              <span className="text-xs font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-brand-secondary)' }}>
                <Sparkles size={12} /> Who Needs Help?
              </span>
              <div className="flex items-center gap-1">
                {aiHelpResult && (
                  <>
                    <button onClick={fetchWhoNeedsHelp} disabled={aiHelpLoading}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
                      style={{ color: 'var(--color-brand-secondary)', background: 'rgba(139,92,246,0.1)' }}>
                      <RefreshCw size={10} style={{ animation: aiHelpLoading ? 'spin 1s linear infinite' : 'none' }} />
                      Re-ask
                    </button>
                    <button onClick={() => setAiHelpResult(null)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
                      style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-elevated)' }}>
                      <X size={10} /> Clear
                    </button>
                  </>
                )}
                {!aiHelpResult && (
                  <button onClick={fetchWhoNeedsHelp} disabled={aiHelpLoading}
                    className="p-1 rounded" style={{ color: 'var(--color-text-muted)' }}>
                    <RefreshCw size={12} style={{ animation: aiHelpLoading ? 'spin 1s linear infinite' : 'none' }} />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            {!aiHelpResult && !aiHelpLoading && (
              <button onClick={fetchWhoNeedsHelp}
                className="text-xs w-full text-center py-2.5 transition-colors"
                style={{ color: 'var(--color-brand-secondary)' }}>
                Ask AI →
              </button>
            )}
            {aiHelpLoading && (
              <p className="text-xs px-4 py-2.5" style={{ color: 'var(--color-text-muted)' }}>
                Analysing team data…
              </p>
            )}
            {aiHelpResult && !aiHelpLoading && (
              /* Scrollable box — capped at 280px so large responses don't break layout */
              <div style={{ maxHeight: 280, overflowY: 'auto', padding: '12px 16px' }}>
                <div className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{children}</strong>,
                      ul:     ({ children }) => <ul className="pl-3 mb-2 space-y-0.5 list-disc">{children}</ul>,
                      ol:     ({ children }) => <ol className="pl-3 mb-2 space-y-0.5 list-decimal">{children}</ol>,
                      li:     ({ children }) => <li className="leading-relaxed">{children}</li>,
                      h3:     ({ children }) => <p className="font-semibold mb-1 mt-2 first:mt-0" style={{ color: 'var(--color-text-primary)' }}>{children}</p>,
                      hr:     () => <hr className="my-2" style={{ borderColor: 'rgba(139,92,246,0.2)' }} />,
                      table:  ({ children }) => (
                        <div className="overflow-x-auto my-2 rounded-lg" style={{ border: '1px solid rgba(139,92,246,0.2)' }}>
                          <table className="w-full text-xs border-collapse">{children}</table>
                        </div>
                      ),
                      thead:  ({ children }) => <thead style={{ background: 'rgba(139,92,246,0.1)' }}>{children}</thead>,
                      th:     ({ children }) => <th className="px-2 py-1.5 text-left font-semibold" style={{ color: 'var(--color-brand-secondary)', borderBottom: '1px solid rgba(139,92,246,0.2)' }}>{children}</th>,
                      td:     ({ children }) => <td className="px-2 py-1.5" style={{ borderTop: '1px solid var(--color-border-subtle)' }}>{children}</td>,
                      tbody:  ({ children }) => <tbody>{children}</tbody>,
                      tr:     ({ children }) => <tr>{children}</tr>,
                    }}
                  >
                    {aiHelpResult}
                  </ReactMarkdown>
                </div>
              </div>
            )}
          </GlassCard>
        </section>
      </div>

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
                      <WorkStatusBadge status={item.status} />
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
