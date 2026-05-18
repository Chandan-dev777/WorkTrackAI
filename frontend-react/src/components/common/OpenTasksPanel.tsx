import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Plus, CheckCircle2, Unlock, FolderOpen } from 'lucide-react'
import { worklogsApi } from '@/api/worklogs'
import type { WorkItem } from '@/types/models'

const STATUS_COLORS: Record<string, string> = {
  in_progress: '#6366F1',
  planned: '#F59E0B',
  blocked: '#EF4444',
}

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'In Progress',
  planned: 'Planned',
  blocked: 'Blocked',
}

interface QuickActionModal {
  task: WorkItem
  type: 'add_hours' | 'mark_done' | 'unblock'
}

export function OpenTasksPanel() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [modal, setModal] = useState<QuickActionModal | null>(null)
  const [hoursToday, setHoursToday] = useState(1)
  const [newStatus, setNewStatus] = useState('in_progress')
  const [note, setNote] = useState('')
  const [workDate, setWorkDate] = useState(new Date().toISOString().split('T')[0])

  const { data: openTasks = [], isLoading } = useQuery({
    queryKey: ['open-tasks'],
    queryFn: () => worklogsApi.getOpen(14),
    staleTime: 30_000,
  })

  const continueMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof worklogsApi.continueTask>[1] }) =>
      worklogsApi.continueTask(id, payload),
    onSuccess: () => {
      toast.success('Task updated successfully')
      qc.invalidateQueries({ queryKey: ['open-tasks'] })
      qc.invalidateQueries({ queryKey: ['worklogs'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setModal(null)
      setHoursToday(1)
      setNote('')
    },
    onError: () => toast.error('Failed to update task'),
  })

  function openModal(task: WorkItem, type: QuickActionModal['type']) {
    setModal({ task, type })
    setHoursToday(1)
    setNote('')
    setWorkDate(new Date().toISOString().split('T')[0])
    setNewStatus(
      type === 'mark_done' ? 'done' :
      type === 'unblock'   ? 'in_progress' :
      task.status ?? 'in_progress'
    )
  }

  function handleSave() {
    if (!modal) return
    continueMutation.mutate({
      id: modal.task.id,
      payload: {
        hours_today: hoursToday > 0 ? hoursToday : null,
        status: newStatus,
        note: note || null,
        work_date: workDate,
      },
    })
  }

  if (isLoading) return null
  if (openTasks.length === 0) return null

  return (
    <div style={{
      border: '1px solid var(--color-border-default)',
      borderRadius: 12,
      marginBottom: 24,
      overflow: 'hidden',
      background: 'var(--color-bg-elevated)',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px', background: 'none', border: 'none',
          cursor: 'pointer', color: 'var(--color-text-primary)',
        }}
      >
        <FolderOpen size={18} color="#6366F1" />
        <span style={{ fontWeight: 600, fontSize: 15 }}>
          Open Tasks ({openTasks.length})
        </span>
        <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginLeft: 4 }}>
          — update without re-typing
        </span>
        <span style={{ marginLeft: 'auto' }}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Task list */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--color-border-default)' }}>
          {openTasks.map((task, idx) => (
            <div
              key={task.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 18px',
                borderBottom: idx < openTasks.length - 1 ? '1px solid var(--color-border-subtle)' : 'none',
              }}
            >
              {/* Status dot */}
              <span style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: STATUS_COLORS[task.status ?? ''] ?? '#94A3B8',
              }} />

              {/* Task info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {task.task_description}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, display: 'flex', gap: 8 }}>
                  <span>{STATUS_LABELS[task.status ?? ''] ?? task.status}</span>
                  {task.project_name && <span>· {task.project_name}</span>}
                  {task.hours_spent != null && <span>· {task.hours_spent}h logged</span>}
                  <span>· since {task.work_date}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <ActionBtn
                  icon={<Plus size={13} />}
                  label="Add Hours"
                  color="#6366F1"
                  onClick={() => openModal(task, 'add_hours')}
                />
                {task.status !== 'blocked' && (
                  <ActionBtn
                    icon={<CheckCircle2 size={13} />}
                    label="Done"
                    color="#10B981"
                    onClick={() => openModal(task, 'mark_done')}
                  />
                )}
                {task.status === 'blocked' && (
                  <ActionBtn
                    icon={<Unlock size={13} />}
                    label="Unblock"
                    color="#F59E0B"
                    onClick={() => openModal(task, 'unblock')}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick-action modal overlay */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}
          onClick={() => setModal(null)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-elevated)', borderRadius: 12,
              border: '1px solid var(--color-border-default)',
              padding: 24, width: 480, maxWidth: '95vw',
            }}
          >
            <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {modal.type === 'add_hours' ? '➕ Add Hours' :
               modal.type === 'mark_done' ? '✅ Mark Done' : '🔓 Unblock'}
            </h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {modal.task.task_description}
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Work Date</span>
                <input
                  type="date" value={workDate} max={new Date().toISOString().split('T')[0]}
                  onChange={e => setWorkDate(e.target.value)}
                  style={{
                    padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)',
                    background: 'var(--color-bg-default)', color: 'var(--color-text-primary)', fontSize: 14,
                  }}
                />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Hours Today</span>
                <input
                  type="number" min={0} step={0.5} value={hoursToday}
                  onChange={e => setHoursToday(parseFloat(e.target.value) || 0)}
                  style={{
                    padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)',
                    background: 'var(--color-bg-default)', color: 'var(--color-text-primary)', fontSize: 14,
                  }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Status</span>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value)}
                  style={{
                    padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)',
                    background: 'var(--color-bg-default)', color: 'var(--color-text-primary)', fontSize: 14,
                  }}
                >
                  <option value="in_progress">In Progress</option>
                  <option value="planned">Planned</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </label>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)' }}>Note (optional)</span>
              <input
                type="text" placeholder="e.g. Deployed to staging"
                value={note} onChange={e => setNote(e.target.value)}
                style={{
                  padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border-default)',
                  background: 'var(--color-bg-default)', color: 'var(--color-text-primary)', fontSize: 14,
                }}
              />
            </label>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleSave}
                disabled={continueMutation.isPending}
                style={{
                  flex: 1, padding: '10px 0', borderRadius: 8, border: 'none',
                  background: '#6366F1', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer',
                }}
              >
                {continueMutation.isPending ? 'Saving…' : '💾 Save Update'}
              </button>
              <button
                onClick={() => setModal(null)}
                style={{
                  padding: '10px 18px', borderRadius: 8,
                  border: '1px solid var(--color-border-default)',
                  background: 'none', color: 'var(--color-text-primary)',
                  fontWeight: 500, fontSize: 14, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionBtn({ icon, label, color, onClick }: {
  icon: React.ReactNode; label: string; color: string; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 10px', borderRadius: 6, border: `1px solid ${color}`,
        background: hovered ? color : 'transparent',
        color: hovered ? '#fff' : color,
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        transition: 'all 0.15s',
      }}
    >
      {icon} {label}
    </button>
  )
}
