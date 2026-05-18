import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { FolderKanban, ChevronDown, ChevronUp, Clock, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { worklogsApi } from '@/api/worklogs'
import { WorkStatusBadge } from '@/components/common/WorkStatusBadge'
import { SkeletonCard } from '@/components/common/Skeleton'
import { formatDateShort } from '@/utils/formatDate'
import type { WorkItem } from '@/types/models'

// ── Types ─────────────────────────────────────────────────────────────────────

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
    const key = item.project_name ?? '__unassigned__'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(item)
  }

  const groups: ProjectGroup[] = []

  for (const [key, groupItems] of map.entries()) {
    const totalHours    = groupItems.reduce((s, i) => s + (i.hours_spent ?? 0), 0)
    const doneCount     = groupItems.filter(i => i.status === 'done').length
    const inProgressCount = groupItems.filter(i => i.status === 'in_progress').length
    const blockedCount  = groupItems.filter(i => i.status === 'blocked').length
    const plannedCount  = groupItems.filter(i => i.status === 'planned').length
    const lastDate      = groupItems.map(i => i.work_date).sort().reverse()[0] ?? ''

    groups.push({
      name: key === '__unassigned__' ? 'Unassigned' : key,
      items: groupItems.sort((a, b) => b.work_date.localeCompare(a.work_date)),
      totalHours,
      doneCount,
      inProgressCount,
      blockedCount,
      plannedCount,
      lastDate,
    })
  }

  // Named projects first, then Unassigned last
  return groups.sort((a, b) => {
    if (a.name === 'Unassigned') return 1
    if (b.name === 'Unassigned') return -1
    return b.totalHours - a.totalHours
  })
}

// ── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ group }: { group: ProjectGroup }) {
  const [expanded, setExpanded] = useState(false)
  const isUnassigned = group.name === 'Unassigned'

  return (
    <div style={{
      border: '1px solid var(--color-border-subtle)',
      borderRadius: 12,
      overflow: 'hidden',
      background: 'var(--color-bg-surface)',
    }}>
      {/* Card header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 16,
          padding: '16px 20px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isUnassigned ? 'rgba(107,114,128,0.12)' : 'rgba(99,102,241,0.12)',
        }}>
          <FolderKanban size={18} color={isUnassigned ? '#6B7280' : '#6366F1'} />
        </div>

        {/* Project name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)', marginBottom: 2 }}>
            {group.name}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--color-text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} />{group.totalHours}h logged
            </span>
            <span>{group.items.length} task{group.items.length !== 1 ? 's' : ''}</span>
            {group.lastDate && <span>Last: {formatDateShort(group.lastDate)}</span>}
          </div>
        </div>

        {/* Status chips */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {group.doneCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#10B981' }}>
              <CheckCircle2 size={12} />{group.doneCount} done
            </span>
          )}
          {group.inProgressCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#0EA5E9' }}>
              <Loader2 size={12} />{group.inProgressCount} active
            </span>
          )}
          {group.blockedCount > 0 && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#F43F5E' }}>
              <AlertCircle size={12} />{group.blockedCount} blocked
            </span>
          )}
        </div>

        {/* Hours badge */}
        <div style={{
          padding: '4px 10px', borderRadius: 20, flexShrink: 0,
          background: isUnassigned ? 'rgba(107,114,128,0.1)' : 'rgba(99,102,241,0.1)',
          color: isUnassigned ? '#6B7280' : '#6366F1',
          fontSize: 13, fontWeight: 700, fontFamily: 'monospace',
        }}>
          {group.totalHours}h
        </div>

        {/* Expand icon */}
        <span style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Expanded task list */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          {group.items.map((item, idx) => (
            <div
              key={item.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 20px',
                borderBottom: idx < group.items.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
                background: 'var(--color-bg-elevated)',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
                  {item.task_description}
                </p>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', gap: 8 }}>
                  <span>{formatDateShort(item.work_date)}</span>
                  <span>· {item.work_category}</span>
                  {item.hours_spent != null && <span>· {item.hours_spent}h</span>}
                </div>
              </div>
              <WorkStatusBadge status={item.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const itemsQ = useQuery({
    queryKey: ['projects-my'],
    queryFn: () => worklogsApi.getMy(),
    placeholderData: keepPreviousData,
  })

  const groups = useMemo(() => groupByProject(itemsQ.data ?? []), [itemsQ.data])

  const namedProjects = groups.filter(g => g.name !== 'Unassigned')
  const totalHours    = groups.reduce((s, g) => s + g.totalHours, 0)

  return (
    <div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1200px' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderKanban size={22} color="var(--color-brand-primary)" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
              Projects
            </h1>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {itemsQ.isLoading
                ? 'Loading projects…'
                : `${namedProjects.length} project${namedProjects.length !== 1 ? 's' : ''} · ${totalHours.toFixed(1)}h total`}
            </p>
          </div>
        </div>
        <Link to="/submit"
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold"
          style={{ background: 'var(--color-brand-primary)', color: '#fff', textDecoration: 'none' }}>
          + Submit Update
        </Link>
      </div>

      {/* Summary strip */}
      {!itemsQ.isLoading && groups.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Projects', value: namedProjects.length, color: '#6366F1' },
            { label: 'Total Hours', value: `${totalHours.toFixed(1)}h`, color: 'var(--color-brand-primary)' },
            { label: 'Total Tasks', value: groups.reduce((s, g) => s + g.items.length, 0), color: '#10B981' },
          ].map(stat => (
            <div key={stat.label} style={{
              padding: '16px 20px', borderRadius: 12,
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-subtle)',
            }}>
              <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>{stat.label}</p>
              <p style={{ fontSize: 22, fontWeight: 700, fontFamily: 'monospace', color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Project cards */}
      {itemsQ.isLoading ? (
        <div className="flex flex-col gap-4">
          {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-xl py-16 text-center"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <FolderKanban size={28} style={{ margin: '0 auto 8px', color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
            No work items yet. Submit your first update to see projects here.
          </p>
          <Link to="/submit" className="mt-3 inline-block text-sm font-medium"
            style={{ color: 'var(--color-brand-primary)' }}>
            Submit an update →
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(group => (
            <ProjectCard key={group.name} group={group} />
          ))}
        </div>
      )}
    </div>
  )
}
