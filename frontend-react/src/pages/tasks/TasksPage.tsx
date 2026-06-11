import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import {
  Pencil, Download, ListTodo, FolderKanban,
  ChevronDown, ChevronUp, Clock, CheckCircle2,
  AlertCircle, Loader2, Search,
} from 'lucide-react'
import { toast } from 'sonner'
import { worklogsApi } from '@/api/worklogs'
import { OpenTasksPanel } from '@/components/common/OpenTasksPanel'
import { WorkStatusBadge } from '@/components/common/WorkStatusBadge'
import { StaggerList, StaggerItem } from '@/components/common/StaggerList'
import { SkeletonTable, SkeletonCard } from '@/components/common/Skeleton'
import { formatDateShort } from '@/utils/formatDate'
import type { WorkItem } from '@/types/models'

// ── Constants ─────────────────────────────────────────────────────────────────

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

const CATEGORY_COLORS: Record<string, string> = {
  project: '#6366F1', ticket: '#8B5CF6', polaris_classification: '#A78BFA',
  meeting: '#0EA5E9', admin: '#6B7280', learning: '#10B981',
  support: '#F59E0B', documentation: '#34D399', review: '#06B6D4', other: '#4B5563',
}

const PROJECT_PALETTE = ['#6366F1','#8B5CF6','#EC4899','#0EA5E9','#10B981','#F59E0B','#EF4444','#06B6D4','#84CC16']

function projectColor(name: string) {
  const h = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return PROJECT_PALETTE[h % PROJECT_PALETTE.length]
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'tasks' | 'projects'

interface ProjectGroup {
  name: string
  items: WorkItem[]
  totalHours: number
  doneCount: number
  inProgressCount: number
  blockedCount: number
  plannedCount: number
  lastDate: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByProject(items: WorkItem[]): ProjectGroup[] {
  const map = new Map<string, WorkItem[]>()
  for (const item of items) {
    const key = item.project_name?.trim() || '__unassigned__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }
  return [...map.entries()]
    .map(([key, groupItems]) => {
      const sorted = [...groupItems].sort((a, b) => b.work_date.localeCompare(a.work_date))
      return {
        name: key === '__unassigned__' ? 'Unassigned' : key,
        items: sorted,
        totalHours:      groupItems.reduce((s, i) => s + (i.hours_spent ?? 0), 0),
        doneCount:       groupItems.filter(i => i.status === 'done').length,
        inProgressCount: groupItems.filter(i => i.status === 'in_progress').length,
        blockedCount:    groupItems.filter(i => i.status === 'blocked').length,
        plannedCount:    groupItems.filter(i => i.status === 'planned').length,
        lastDate:        sorted[0]?.work_date ?? '',
      }
    })
    .sort((a, b) => {
      if (a.name === 'Unassigned') return 1
      if (b.name === 'Unassigned') return -1
      return b.totalHours - a.totalHours
    })
}

function exportToCSV(items: WorkItem[], startDate: string, endDate: string) {
  const headers = ['Date','Description','Category','Hours','Status','Priority','Project','Ticket ID','Blockers','Next Steps']
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
  a.href = url; a.download = `tasks-${startDate}-to-${endDate}.csv`
  a.click(); URL.revokeObjectURL(url)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabButton({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 600 : 500,
        background: active ? 'var(--color-bg-surface)' : 'transparent',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.12), 0 0 0 1px var(--color-border-subtle)' : 'none',
        transition: 'all 0.15s',
      }}
    >
      {label}
      <span style={{
        fontSize: 11, fontWeight: 600, fontFamily: 'monospace',
        padding: '2px 7px', borderRadius: 10,
        background: active ? 'rgba(99,102,241,0.12)' : 'var(--color-bg-elevated)',
        color: active ? '#6366F1' : 'var(--color-text-muted)',
      }}>
        {count}
      </span>
    </button>
  )
}

function CategoryPill({ category }: { category: string }) {
  const color = CATEGORY_COLORS[category] ?? '#4B5563'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10,
      background: `${color}18`, color,
    }}>
      {category.replace('_', ' ')}
    </span>
  )
}

function ProjectTag({ name, onClick }: { name: string; onClick?: () => void }) {
  const color = projectColor(name)
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10,
        background: `${color}15`, color, border: 'none', cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {name}
    </button>
  )
}

// ── Project Card (grid) ───────────────────────────────────────────────────────

interface ProjectCardProps {
  group: ProjectGroup
  onFilterByProject: (name: string) => void
  onContinueTask: (task: WorkItem) => void
}

function ProjectCard({ group, onFilterByProject, onContinueTask }: ProjectCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isUnassigned = group.name === 'Unassigned'
  const color = isUnassigned ? '#6B7280' : projectColor(group.name)
  const total = group.items.length
  const donePct = total > 0 ? Math.round((group.doneCount / total) * 100) : 0

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      background: 'var(--color-bg-surface)',
      border: '1px solid var(--color-border-subtle)',
      borderLeft: `3px solid ${color}`,
      display: 'flex', flexDirection: 'column',
      transition: 'box-shadow 0.15s, transform 0.15s',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.transform = '' }}
    >
      {/* Card body */}
      <div style={{ padding: '18px 20px 16px' }}>
        {/* Top row: icon + name + hours badge */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${color}18`,
          }}>
            <FolderKanban size={17} color={color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {group.name}
            </p>
            <p style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {total} task{total !== 1 ? 's' : ''}{group.lastDate ? ` · last ${formatDateShort(group.lastDate)}` : ''}
            </p>
          </div>
          <div style={{
            padding: '4px 10px', borderRadius: 20, flexShrink: 0,
            background: `${color}15`, color, fontSize: 14, fontWeight: 700, fontFamily: 'monospace',
          }}>
            {group.totalHours}h
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Progress</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: donePct === 100 ? '#10B981' : 'var(--color-text-secondary)' }}>{donePct}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 10, background: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 10,
              width: `${donePct}%`,
              background: donePct === 100 ? '#10B981' : color,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Status chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {group.doneCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
              <CheckCircle2 size={10} />{group.doneCount} done
            </span>
          )}
          {group.inProgressCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: 'rgba(14,165,233,0.1)', color: '#0EA5E9' }}>
              <Loader2 size={10} />{group.inProgressCount} active
            </span>
          )}
          {group.blockedCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
              <AlertCircle size={10} />{group.blockedCount} blocked
            </span>
          )}
          {group.plannedCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: 'rgba(107,114,128,0.1)', color: '#6B7280' }}>
              {group.plannedCount} planned
            </span>
          )}
        </div>
      </div>

      {/* Card footer: actions */}
      <div style={{
        padding: '10px 20px', borderTop: '1px solid var(--color-border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--color-bg-elevated)',
      }}>
        <button
          onClick={() => onFilterByProject(group.name === 'Unassigned' ? '' : group.name)}
          style={{
            fontSize: 11, fontWeight: 500, color: color, background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 0',
          }}
        >
          Filter tasks →
        </button>
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 11, color: 'var(--color-text-muted)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 0',
          }}
        >
          {expanded ? 'Collapse' : 'View tasks'}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Expanded task list with update action */}
      {expanded && (
        <div>
          {group.items.map((item) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px',
              borderTop: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.task_description}
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                  {formatDateShort(item.work_date)} · {item.hours_spent != null ? `${item.hours_spent}h` : '—'}
                </p>
              </div>
              <WorkStatusBadge status={item.status} />
              <button
                onClick={() => onContinueTask(item)}
                title="Update task"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', borderRadius: 6,
                  border: `1px solid ${color}`, background: 'transparent',
                  color, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <Pencil size={11} /> Update
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('tasks')

  // Tasks tab state
  const [startDate, setStartDate] = useState(daysAgo(30))
  const [endDate, setEndDate]     = useState(TODAY)
  const [search, setSearch]       = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter]     = useState('')
  const [projectFilter, setProjectFilter]   = useState('')

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editHours, setEditHours] = useState('')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  const dateParams = useMemo(() => ({ start_date: startDate, end_date: endDate }), [startDate, endDate])
  const dateKey    = `${startDate}__${endDate}`

  // Tasks tab uses date-scoped query; projects tab uses all-time
  const itemsQ = useQuery({ queryKey: ['tasks-my', dateKey], queryFn: () => worklogsApi.getMy(dateParams), placeholderData: keepPreviousData })
  const allQ   = useQuery({ queryKey: ['projects-all'], queryFn: () => worklogsApi.getMy(), placeholderData: keepPreviousData })

  const allItems    = itemsQ.data ?? []
  const groups      = useMemo(() => groupByProject(allQ.data ?? []), [allQ.data])
  const namedGroups = groups.filter(g => g.name !== 'Unassigned')
  const totalHours  = groups.reduce((s, g) => s + g.totalHours, 0)

  const uniqueCategories = useMemo(() => [...new Set(allItems.map(i => i.work_category))].sort(), [allItems])
  const uniqueStatuses   = useMemo(() => [...new Set(allItems.map(i => i.status).filter(Boolean) as string[])].sort(), [allItems])
  const uniqueProjects = useMemo(() => [...new Set(allItems.map(i => i.project_name).filter(Boolean) as string[])].sort(), [allItems])

  const filteredItems = useMemo(() => allItems.filter(item => {
    if (search && !item.task_description.toLowerCase().includes(search.toLowerCase())) return false
    if (categoryFilter && item.work_category !== categoryFilter) return false
    if (statusFilter && item.status !== statusFilter) return false
    if (projectFilter && (item.project_name ?? '') !== projectFilter) return false
    return true
  }), [allItems, search, categoryFilter, statusFilter, projectFilter])

  function startEdit(item: WorkItem) { setEditingId(item.id); setEditHours(String(item.hours_spent ?? '')); setEditError(null) }
  function cancelEdit()               { setEditingId(null); setEditHours(''); setEditError(null) }

  async function saveEdit(id: string) {
    setSaving(true); setEditError(null)
    try {
      await worklogsApi.updateItem(id, { hours_spent: parseFloat(editHours) || 0 })
      toast.success('Hours updated')
      setEditingId(null); setEditHours('')
      queryClient.invalidateQueries({ queryKey: ['tasks-my'] })
    } catch {
      toast.error('Failed to save.'); setEditError('Failed to save changes.')
    } finally { setSaving(false) }
  }

  function switchToTasksAndFilter(projectName: string) {
    setProjectFilter(projectName)
    setActiveTab('tasks')
  }

  // ── Task Update Modal state ──
  const [modalTask, setModalTask] = useState<WorkItem | null>(null)
  const [modalHours, setModalHours] = useState(1)
  const [modalStatus, setModalStatus] = useState('in_progress')
  const [modalNote, setModalNote] = useState('')
  const [modalDate, setModalDate] = useState(TODAY)
  const [modalSaving, setModalSaving] = useState(false)

  function openTaskModal(task: WorkItem) {
    setModalTask(task)
    setModalHours(1)
    setModalStatus(task.status ?? 'in_progress')
    setModalNote('')
    setModalDate(TODAY)
  }

  async function saveTaskModal() {
    if (!modalTask) return
    setModalSaving(true)
    try {
      await worklogsApi.continueTask(modalTask.id, {
        hours_today: modalHours > 0 ? modalHours : null,
        status: modalStatus,
        note: modalNote || null,
        work_date: modalDate,
      })
      toast.success('Task updated')
      setModalTask(null)
      queryClient.invalidateQueries({ queryKey: ['tasks-my'] })
      queryClient.invalidateQueries({ queryKey: ['open-tasks'] })
    } catch {
      toast.error('Failed to update task')
    } finally { setModalSaving(false) }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-default)',
    color: 'var(--color-text-primary)',
    borderRadius: 8, outline: 'none',
  }

  return (
    <div style={{ maxWidth: 1440, margin: '0 auto', padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Page Header ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Tasks &amp; Projects
          </h1>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {allItems.length > 0 || groups.length > 0
              ? `${allItems.length} tasks · ${namedGroups.length} projects · ${totalHours.toFixed(1)}h total`
              : 'Manage your work items and projects'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeTab === 'tasks' && (
            <button
              onClick={() => exportToCSV(allItems, startDate, endDate)}
              disabled={allItems.length === 0}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                border: '1px solid var(--color-border-default)',
                background: 'var(--color-bg-surface)',
                color: allItems.length > 0 ? 'var(--color-text-secondary)' : 'var(--color-text-muted)',
                cursor: allItems.length > 0 ? 'pointer' : 'not-allowed',
                opacity: allItems.length > 0 ? 1 : 0.5,
              }}>
              <Download size={13} /> Export
            </button>
          )}
          <Link to="/submit" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: 'var(--color-brand-primary)', color: '#fff', textDecoration: 'none',
          }}>
            + Submit Update
          </Link>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{
          display: 'inline-flex', padding: 4, borderRadius: 11,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-subtle)',
        }}>
          <TabButton active={activeTab === 'tasks'}    onClick={() => setActiveTab('tasks')}    label="Tasks"    count={allItems.length} />
          <TabButton active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} label="Projects" count={namedGroups.length} />
        </div>
        {/* Active filter indicators */}
        {activeTab === 'tasks' && (projectFilter || categoryFilter || statusFilter) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Filtered:</span>
            {projectFilter && <ProjectTag name={projectFilter} onClick={() => setProjectFilter('')} />}
            {categoryFilter && <CategoryPill category={categoryFilter} />}
            <button onClick={() => { setProjectFilter(''); setCategoryFilter(''); setStatusFilter(''); setSearch('') }}
              style={{ fontSize: 11, color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
              Clear all ×
            </button>
          </div>
        )}
      </div>

      {/* ── TASKS TAB ───────────────────────────────────────────────────── */}
      {activeTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Open tasks panel */}
          <OpenTasksPanel />

          {/* Toolbar row: date presets + custom range */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
            padding: '12px 16px', borderRadius: 10,
            background: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-subtle)',
          }}>
            <Clock size={13} color="var(--color-text-muted)" />
            {PRESETS.map(p => {
              const active = startDate === p.startDate && endDate === p.endDate
              return (
                <button key={p.label}
                  onClick={() => { setStartDate(p.startDate); setEndDate(p.endDate) }}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 500,
                    border: active ? 'none' : '1px solid var(--color-border-default)',
                    background: active ? 'var(--color-brand-primary)' : 'transparent',
                    color: active ? '#fff' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                  }}>
                  Last {p.label}
                </button>
              )
            })}
            <div style={{ width: 1, height: 16, background: 'var(--color-border-default)', margin: '0 4px' }} />
            <input type="date" aria-label="Start date" value={startDate} max={endDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ ...inputStyle, padding: '4px 8px', fontSize: 12 }} />
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>—</span>
            <input type="date" aria-label="End date" value={endDate} min={startDate} max={TODAY}
              onChange={e => setEndDate(e.target.value)}
              style={{ ...inputStyle, padding: '4px 8px', fontSize: 12 }} />
          </div>

          {/* Search + filter toolbar */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240, position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text" aria-label="Search work items"
                placeholder="Search tasks…"
                value={search} onChange={e => setSearch(e.target.value)}
                style={{ ...inputStyle, width: '100%', padding: '8px 12px 8px 30px', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <select aria-label="Filter by category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              style={{ ...inputStyle, padding: '8px 12px', fontSize: 13, cursor: 'pointer', minWidth: 140 }}>
              <option value="">All Categories</option>
              {uniqueCategories.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
            <select aria-label="Filter by status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ ...inputStyle, padding: '8px 12px', fontSize: 13, cursor: 'pointer', minWidth: 130 }}>
              <option value="">All Statuses</option>
              {uniqueStatuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            {uniqueProjects.length > 0 && (
              <select aria-label="Filter by project" value={projectFilter} onChange={e => setProjectFilter(e.target.value)}
                style={{ ...inputStyle, padding: '8px 12px', fontSize: 13, cursor: 'pointer', minWidth: 140 }}>
                <option value="">All Projects</option>
                {uniqueProjects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
            {(search || categoryFilter || statusFilter || projectFilter) && (
              <button onClick={() => { setSearch(''); setCategoryFilter(''); setStatusFilter(''); setProjectFilter('') }}
                style={{ ...inputStyle, padding: '8px 12px', fontSize: 12, color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          {itemsQ.isLoading ? (
            <SkeletonTable rows={6} cols={7} />
          ) : filteredItems.length === 0 ? (
            <div style={{
              borderRadius: 12, padding: '56px 24px', textAlign: 'center',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
            }}>
              <ListTodo size={28} style={{ margin: '0 auto 12px', color: 'var(--color-text-muted)' }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                No tasks match your filters
              </p>
              <Link to="/submit" style={{ fontSize: 13, color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
                Submit an update →
              </Link>
            </div>
          ) : (
            <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }} aria-label="Work items">
                <thead>
                  <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border-default)' }}>
                    {[
                      { label: 'Date',        width: 88 },
                      { label: 'Description', width: 'auto' },
                      { label: 'Category',    width: 130 },
                      { label: 'Project',     width: 120 },
                      { label: 'Hours',       width: 70 },
                      { label: 'Status',      width: 110 },
                      { label: '',            width: 44 },
                    ].map(col => (
                      <th key={col.label} style={{
                        padding: '10px 14px', textAlign: 'left',
                        fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                        textTransform: 'uppercase', color: 'var(--color-text-muted)',
                        width: col.width !== 'auto' ? col.width : undefined,
                      }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <StaggerList as="tbody">
                  {filteredItems.map(item => (
                    <StaggerItem as="tr" key={item.id}
                      style={{ borderTop: '1px solid var(--color-border-subtle)', cursor: 'default' }}
                      onMouseEnter={(e: React.MouseEvent<HTMLTableRowElement>) => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                      onMouseLeave={(e: React.MouseEvent<HTMLTableRowElement>) => (e.currentTarget.style.background = '')}>

                      <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {formatDateShort(item.work_date)}
                      </td>

                      <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--color-text-primary)', maxWidth: 320 }}>
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.task_description}
                        </span>
                      </td>

                      <td style={{ padding: '11px 14px' }}>
                        <CategoryPill category={item.work_category} />
                      </td>

                      <td style={{ padding: '11px 14px' }}>
                        {item.project_name
                          ? <ProjectTag name={item.project_name} onClick={() => { setProjectFilter(item.project_name!); setActiveTab('tasks') }} />
                          : <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>—</span>}
                      </td>

                      <td style={{ padding: '11px 14px', fontSize: 13, fontFamily: 'monospace', color: 'var(--color-text-primary)' }}>
                        {editingId === item.id ? (
                          <input type="number" aria-label="Hours"
                            value={editHours} onChange={e => setEditHours(e.target.value)}
                            min="0" step="0.5"
                            style={{ ...inputStyle, width: 64, padding: '4px 8px', fontSize: 12 }}
                          />
                        ) : (
                          item.hours_spent != null ? `${item.hours_spent}h` : '—'
                        )}
                      </td>

                      <td style={{ padding: '11px 14px' }}>
                        <WorkStatusBadge status={item.status} />
                      </td>

                      <td style={{ padding: '11px 8px' }}>
                        {editingId === item.id ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => saveEdit(item.id)} disabled={saving} aria-label="Save"
                              style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6, border: 'none', background: 'var(--color-brand-primary)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
                              {saving ? '…' : 'Save'}
                            </button>
                            <button onClick={cancelEdit} aria-label="Cancel"
                              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--color-border-default)', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                              ×
                            </button>
                          </div>
                        ) : (
                          <button onClick={() => startEdit(item)} aria-label={`Edit ${item.task_description}`}
                            style={{ padding: 6, borderRadius: 6, border: 'none', background: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                            <Pencil size={13} />
                          </button>
                        )}
                        {editingId === item.id && editError && (
                          <p style={{ fontSize: 10, color: '#EF4444', marginTop: 2 }}>{editError}</p>
                        )}
                      </td>
                    </StaggerItem>
                  ))}
                </StaggerList>
              </table>
              </div>
              {/* Table footer */}
              <div style={{
                padding: '10px 16px', borderTop: '1px solid var(--color-border-subtle)',
                background: 'var(--color-bg-elevated)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {filteredItems.length} of {allItems.length} tasks
                  {filteredItems.length < allItems.length ? ' (filtered)' : ''}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {filteredItems.reduce((s, i) => s + (i.hours_spent ?? 0), 0).toFixed(1)}h shown
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PROJECTS TAB ────────────────────────────────────────────────── */}
      {activeTab === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Summary KPIs */}
          {!allQ.isLoading && groups.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {[
                { label: 'Named Projects', value: namedGroups.length,                                              color: '#6366F1' },
                { label: 'Total Hours',    value: `${totalHours.toFixed(1)}h`,                                     color: '#8B5CF6' },
                { label: 'Total Tasks',    value: groups.reduce((s, g) => s + g.items.length, 0),                  color: '#0EA5E9' },
                { label: 'Done',           value: groups.reduce((s, g) => s + g.doneCount, 0),                     color: '#10B981' },
                { label: 'In Progress',    value: groups.reduce((s, g) => s + g.inProgressCount, 0),               color: '#F59E0B' },
                { label: 'Blocked',        value: groups.reduce((s, g) => s + g.blockedCount, 0),                  color: '#EF4444' },
              ].map(stat => (
                <div key={stat.label} style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
                }}>
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stat.label}</p>
                  <p style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace', color: stat.color, margin: 0 }}>{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Project cards grid */}
          {allQ.isLoading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : groups.length === 0 ? (
            <div style={{
              borderRadius: 12, padding: '64px 24px', textAlign: 'center',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)',
            }}>
              <FolderKanban size={28} style={{ margin: '0 auto 12px', color: 'var(--color-text-muted)' }} />
              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
                No projects yet
              </p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                Add a project name when submitting work updates to see them grouped here.
              </p>
              <Link to="/submit" style={{ fontSize: 13, color: 'var(--color-brand-primary)', textDecoration: 'none', fontWeight: 500 }}>
                Submit an update →
              </Link>
            </div>
          ) : (
            <>
              {/* Named project cards */}
              {namedGroups.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
                  {namedGroups.map(group => (
                    <ProjectCard key={group.name} group={group} onFilterByProject={switchToTasksAndFilter} onContinueTask={openTaskModal} />
                  ))}
                </div>
              )}

              {/* Unassigned section — separate, below cards */}
              {groups.find(g => g.name === 'Unassigned') && (() => {
                const unassigned = groups.find(g => g.name === 'Unassigned')!
                return (
                  <UnassignedSection group={unassigned} onFilterByProject={switchToTasksAndFilter} />
                )
              })()}
            </>
          )}
        </div>
      )}

      {/* ── Task Update Modal ──────────────────────────────────────────────── */}
      {modalTask && (
        <div onClick={() => setModalTask(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--color-bg-elevated)', borderRadius: 12, border: '1px solid var(--color-border-default)', padding: 24, width: 480, maxWidth: '95vw' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>Update Task</h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {modalTask.task_description}
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Work Date</span>
                <input type="date" value={modalDate} max={TODAY} onChange={e => setModalDate(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-default)', color: 'var(--color-text-primary)', fontSize: 14 }} />
              </label>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Hours Today</span>
                <input type="number" min={0} step={0.5} value={modalHours} onChange={e => setModalHours(parseFloat(e.target.value) || 0)}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-default)', color: 'var(--color-text-primary)', fontSize: 14 }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Status</span>
                <select value={modalStatus} onChange={e => setModalStatus(e.target.value)}
                  style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-default)', color: 'var(--color-text-primary)', fontSize: 14 }}>
                  <option value="in_progress">In Progress</option>
                  <option value="planned">Planned</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </label>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Note (optional)</span>
              <input type="text" placeholder="e.g. Deployed to staging" value={modalNote} onChange={e => setModalNote(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-default)', color: 'var(--color-text-primary)', fontSize: 14 }} />
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={saveTaskModal} disabled={modalSaving}
                style={{ flex: 1, padding: '10px 0', borderRadius: 8, border: 'none', background: '#6366F1', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer', opacity: modalSaving ? 0.7 : 1 }}>
                {modalSaving ? 'Saving…' : 'Save Update'}
              </button>
              <button onClick={() => setModalTask(null)}
                style={{ padding: '10px 18px', borderRadius: 8, border: '1px solid var(--color-border-default)', background: 'none', color: 'var(--color-text-primary)', fontWeight: 500, fontSize: 14, cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Unassigned section (flat list, not a card) ────────────────────────────────

function UnassignedSection({ group, onFilterByProject }: { group: ProjectGroup; onFilterByProject: (name: string) => void }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ borderRadius: 12, border: '1px solid var(--color-border-subtle)', overflow: 'hidden' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', background: 'var(--color-bg-elevated)', border: 'none', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Unassigned</span>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'rgba(107,114,128,0.12)', color: '#6B7280', fontWeight: 600 }}>
            {group.items.length} tasks · {group.totalHours}h
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>— no project name set</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={e => { e.stopPropagation(); onFilterByProject('') }}
            style={{ fontSize: 11, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}>
            Filter tasks →
          </button>
          {expanded ? <ChevronUp size={14} color="var(--color-text-muted)" /> : <ChevronDown size={14} color="var(--color-text-muted)" />}
        </div>
      </button>
      {expanded && (
        <div>
          {group.items.map((item) => (
            <div key={item.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 18px', borderTop: '1px solid var(--color-border-subtle)',
              background: 'var(--color-bg-surface)',
            }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#6B7280', flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.task_description}
                </p>
                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  {formatDateShort(item.work_date)} · {item.work_category}{item.hours_spent != null ? ` · ${item.hours_spent}h` : ''}
                </p>
              </div>
              <WorkStatusBadge status={item.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
