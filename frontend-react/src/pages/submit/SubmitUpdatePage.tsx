import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Sparkles, Trash2, Plus, AlertTriangle, Info,
  GripVertical, CheckCircle2, Calendar, PanelLeftClose, PanelLeftOpen,
  ChevronDown, ChevronUp, Clock, BookmarkPlus, X,
  Users, Code2, Bug, Search, LifeBuoy, GitPullRequest,
  FileText, BookOpen, Settings2, Star,
} from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DragEndEvent } from '@dnd-kit/core'
import { apiClient } from '@/api/client'
import { templatesApi } from '@/api/templates'
import { OpenTasksPanel } from '@/components/common/OpenTasksPanel'
import type { ExtractionResult, WorkItemExtracted, WorkCategory, StatusType, WorkLog, UserTemplate } from '@/types/models'
import { cn } from '@/utils/cn'

// ── User templates (API-backed) ───────────────────────────────────────────────

function useUserTemplates() {
  const qc = useQueryClient()
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['user-templates'],
    queryFn: templatesApi.list,
    staleTime: 60_000,
  })
  const invalidate = () => qc.invalidateQueries({ queryKey: ['user-templates'] })

  const createMutation = useMutation({
    mutationFn: ({ label, text }: { label: string; text: string }) => templatesApi.create(label, text),
    onSuccess: invalidate,
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => templatesApi.remove(id),
    onSuccess: invalidate,
  })

  return {
    templates: (Array.isArray(templates) ? templates : []) as UserTemplate[],
    isLoading,
    save: (label: string, text: string) => createMutation.mutateAsync({ label, text }),
    remove: (id: string) => removeMutation.mutate(id),
  }
}

// ── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: WorkCategory[] = [
  'project', 'ticket', 'polaris_classification', 'admin',
  'meeting', 'learning', 'support', 'documentation', 'review', 'other',
]
const STATUSES: StatusType[] = ['done', 'in_progress', 'blocked', 'planned']
const PRIORITIES = ['low', 'medium', 'high'] as const

const AI_STAGES = [
  'Extracting your update…',
  'Analyzing work items…',
  'Checking confidence…',
  'Ready for review',
] as const

// ── Template definitions ─────────────────────────────────────────────────────
// Each template text is structured so the LLM can cleanly extract all schema
// fields: task_description, work_category, hours_spent, status, priority,
// ticket_id, project_name, blockers, next_steps, tags.

interface Template {
  label: string
  hint: string                                  // one-line description shown in card
  icon: React.ElementType
  color: string                                 // matches CATEGORY_COLORS
  category: WorkCategory
  text: string
}

const TEMPLATES: Template[] = [
  {
    label: 'Meeting',
    hint: 'Standup, sync, planning call',
    icon: Users,
    color: '#0EA5E9',
    category: 'meeting',
    text:
      'Attended [meeting name] for [X] hours with [team / attendees].\n' +
      'Discussed: [topics covered].\n' +
      'Decisions made: [key decisions, or none].\n' +
      'Action items: [follow-up tasks, or none].\n' +
      'Status: done.',
  },
  {
    label: 'Feature / Project',
    hint: 'Named project or feature work',
    icon: Code2,
    color: '#6366F1',
    category: 'project',
    text:
      'Worked on [feature name] as part of project [project name] for [X] hours.\n' +
      'What was done: [description of progress].\n' +
      'Priority: [high / medium / low].\n' +
      'Status: [done / in_progress / blocked].\n' +
      'Next steps: [what comes next].\n' +
      'Blockers: [any blockers, or none].',
  },
  {
    label: 'Bug / Ticket',
    hint: 'JIRA, ServiceNow or hotfix',
    icon: Bug,
    color: '#8B5CF6',
    category: 'ticket',
    text:
      'Investigated and fixed [bug description] for [X] hours.\n' +
      'Ticket: [TICKET-ID], Project: [project name].\n' +
      'Root cause: [brief explanation].\n' +
      'Fix applied: [what was changed].\n' +
      'Priority: [high / medium / low].\n' +
      'Status: [done / in_progress / blocked].\n' +
      'Next steps: [testing / deployment / none].\n' +
      'Blockers: [any blockers, or none].',
  },
  {
    label: 'Code Review',
    hint: 'PR review, design review',
    icon: GitPullRequest,
    color: '#06B6D4',
    category: 'review',
    text:
      'Reviewed [N] pull requests for [X] hours.\n' +
      'Project / repository: [project or repo name].\n' +
      'Scope: [what was reviewed — feature, bug fix, refactor, etc.].\n' +
      'Key feedback given: [summary of comments].\n' +
      'Outcome: [approved / changes requested / merged].\n' +
      'Status: done.',
  },
  {
    label: 'Support',
    hint: 'Tickets, on-call, colleague help',
    icon: LifeBuoy,
    color: '#F59E0B',
    category: 'support',
    text:
      'Handled [N] support tickets for [X] hours.\n' +
      'Ticket IDs: [IDs if known, or none].\n' +
      'Issues resolved: [brief description].\n' +
      'Escalated: [escalation details, or none].\n' +
      'Status: done.',
  },
  {
    label: 'Documentation',
    hint: 'Docs, wikis, runbooks, README',
    icon: FileText,
    color: '#34D399',
    category: 'documentation',
    text:
      'Wrote / updated documentation for [X] hours.\n' +
      'Document type: [wiki / runbook / README / design doc].\n' +
      'Topic covered: [what the doc is about].\n' +
      'Project: [project name].\n' +
      'Link: [URL if published, or none].\n' +
      'Status: [done / in_progress].',
  },
  {
    label: 'Research',
    hint: 'Spike, investigation, PoC',
    icon: Search,
    color: '#10B981',
    category: 'project',
    text:
      'Researched [topic] for [X] hours as part of [project name].\n' +
      'Goal: [what question was being answered].\n' +
      'Key findings: [summary of what was learned].\n' +
      'References / links: [URLs or doc names, or none].\n' +
      'Next steps: [follow-up actions].\n' +
      'Status: done.',
  },
  {
    label: 'Learning',
    hint: 'Training, courses, self-development',
    icon: BookOpen,
    color: '#10B981',
    category: 'learning',
    text:
      'Completed training / learning on [topic] for [X] hours.\n' +
      'Resource: [course name / book / video / conference].\n' +
      'Key takeaways: [what was learned].\n' +
      'Applicable to: [project or team this helps].\n' +
      'Status: done.',
  },
  {
    label: 'Admin',
    hint: 'Emails, HR, expenses, planning',
    icon: Settings2,
    color: '#6B7280',
    category: 'admin',
    text:
      'Handled administrative tasks for [X] hours.\n' +
      'Tasks completed: [emails / expense reports / HR tasks / planning docs].\n' +
      'Status: done.',
  },
  {
    label: 'Polaris',
    hint: 'Polaris classification / scoring',
    icon: Star,
    color: '#A78BFA',
    category: 'polaris_classification',
    text:
      'Worked on Polaris classification / scoring tasks for [X] hours.\n' +
      'Scope: [what was classified or scored].\n' +
      'Dataset / items processed: [describe].\n' +
      'Project: [project name].\n' +
      'Status: [done / in_progress].\n' +
      'Notes: [quality issues or edge cases, or none].',
  },
]

const QUICK_CATEGORIES: WorkCategory[] = ['project', 'meeting', 'review', 'support', 'learning']

// ── Types ────────────────────────────────────────────────────────────────────

interface PreviewRow extends WorkItemExtracted { _key: number }

function makeNewRow(keyRef: React.MutableRefObject<number>): PreviewRow {
  return {
    _key: ++keyRef.current,
    task_description: '', work_category: 'project', hours_spent: null, status: null,
    priority: null, blockers: null, next_steps: null, tags: null, links: null,
    project_name: null, ticket_id: null, confidence_score: null,
    clarification_needed: false, clarification_reason: null,
  }
}

function estimateTaskCount(text: string): number {
  if (!text.trim()) return 0
  const sentences = text.split(/[.!?;]/).filter(s => s.trim().length > 15)
  return Math.max(1, Math.min(sentences.length, 12))
}

// ── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score == null) return null
  const pct = Math.round(score * 100)
  const [bg, color, label] =
    score >= 0.85 ? ['rgba(16,185,129,0.12)', '#10B981', 'High']
    : score >= 0.60 ? ['rgba(245,158,11,0.12)', '#F59E0B', 'Review']
    : ['rgba(244,63,94,0.12)', '#F43F5E', 'Low ⚠']
  return (
    <span title={`AI confidence: ${pct}% — "${label} confidence"`}
      style={{ background: bg, color, border: `1px solid ${color}30`, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontFamily: 'monospace', cursor: 'help' }}>
      {pct}%
    </span>
  )
}

// ── AI stage indicator ───────────────────────────────────────────────────────

function AIThinkingStrip({ stage }: { stage: number }) {
  const done = stage >= AI_STAGES.length
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-lg px-4 py-3"
      style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}
    >
      {done ? (
        <CheckCircle2 size={14} color="#10B981" />
      ) : (
        <span className="flex gap-1">
          {[0, 1, 2].map(i => (
            <motion.span key={i}
              animate={{ y: [0, -4, 0] }}
              transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.15 }}
              style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: 'var(--color-brand-primary)' }}
            />
          ))}
        </span>
      )}
      <span className="text-xs font-medium" style={{ color: 'var(--color-brand-primary)' }}>
        {AI_STAGES[Math.min(stage, AI_STAGES.length - 1)]}
      </span>
    </motion.div>
  )
}

// ── Labeled field wrapper ────────────────────────────────────────────────────

function LabeledField({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, ...style }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' as const, color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

// ── Sortable item card ───────────────────────────────────────────────────────

interface CardProps {
  row: PreviewRow
  onUpdate: (key: number, field: keyof WorkItemExtracted, value: string | number | boolean | null) => void
  onDelete: (key: number) => void
}

function SortableItemCard({ row, onUpdate, onDelete }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row._key })

  const cardStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    background: 'var(--color-bg-elevated)',
    border: `1px solid ${row.clarification_needed ? 'rgba(245,158,11,0.4)' : 'var(--color-border-default)'}`,
    borderRadius: 10,
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--color-bg-surface)',
    border: '1px solid var(--color-border-subtle)',
    color: 'var(--color-text-primary)',
    borderRadius: 6,
    padding: '4px 8px',
    fontSize: 12,
    width: '100%',
  }

  return (
    // role="row" keeps existing tests compatible (getAllByRole('row') count checks)
    <motion.div
      ref={setNodeRef}
      role="row"
      style={cardStyle}
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.18 }}
    >
      {/* Card top row: drag handle + badges + delete */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button {...attributes} {...listeners}
            aria-label="Drag to reorder"
            style={{ cursor: 'grab', color: 'var(--color-text-muted)', flexShrink: 0, touchAction: 'none', lineHeight: 0 }}>
            <GripVertical size={14} />
          </button>
          <ConfidenceBadge score={row.confidence_score ?? null} />
          {row.clarification_needed && (
            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
              Needs review
            </span>
          )}
        </div>
        <button onClick={() => onDelete(row._key)} aria-label="Delete row"
          style={{ color: 'var(--color-status-danger)', lineHeight: 0 }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Task Description */}
      <LabeledField label="Task Description">
        <input type="text"
          value={row.task_description}
          onChange={e => onUpdate(row._key, 'task_description', e.target.value)}
          placeholder="What was worked on…"
          style={{ ...inputStyle, fontWeight: 500, fontSize: 13 }} />
      </LabeledField>

      {/* Hours · Category · Status · Priority */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <LabeledField label="Hours">
          <input type="number" min="0" step="0.5"
            value={row.hours_spent ?? ''}
            onChange={e => onUpdate(row._key, 'hours_spent', parseFloat(e.target.value) || 0)}
            placeholder="0"
            style={{ ...inputStyle, width: 72 }} />
        </LabeledField>
        <LabeledField label="Category">
          <select value={row.work_category}
            onChange={e => onUpdate(row._key, 'work_category', e.target.value as WorkCategory)}
            style={{ ...inputStyle, width: 126 }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Status">
          <select value={row.status ?? ''}
            onChange={e => onUpdate(row._key, 'status', (e.target.value as StatusType) || null)}
            style={{ ...inputStyle, width: 116 }}>
            <option value="">— select —</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </LabeledField>
        <LabeledField label="Priority">
          <select value={row.priority ?? ''}
            onChange={e => onUpdate(row._key, 'priority', e.target.value || null)}
            style={{ ...inputStyle, width: 96 }}>
            <option value="">— none —</option>
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </LabeledField>
      </div>

      {/* Ticket ID · Project */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <LabeledField label="Ticket ID">
          <input type="text"
            value={row.ticket_id ?? ''}
            onChange={e => onUpdate(row._key, 'ticket_id', e.target.value || null)}
            placeholder="e.g. JIRA-123"
            style={{ ...inputStyle, width: 130 }} />
        </LabeledField>
        <LabeledField label="Project">
          <input type="text"
            value={row.project_name ?? ''}
            onChange={e => onUpdate(row._key, 'project_name', e.target.value || null)}
            placeholder="Project name"
            style={{ ...inputStyle, width: 160 }} />
        </LabeledField>
        <LabeledField label="Confidence">
          <div style={{ ...inputStyle, width: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            {row.confidence_score != null
              ? <ConfidenceBadge score={row.confidence_score} />
              : <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>—</span>}
          </div>
        </LabeledField>
        <LabeledField label="Review?">
          <div style={{ ...inputStyle, width: 70, display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox"
              checked={row.clarification_needed ?? false}
              onChange={e => onUpdate(row._key, 'clarification_needed', e.target.checked)}
              style={{ width: 13, height: 13, accentColor: 'var(--color-brand-primary)', cursor: 'pointer' }} />
            <span style={{ fontSize: 11, color: (row.clarification_needed) ? '#F59E0B' : 'var(--color-text-muted)' }}>
              {row.clarification_needed ? 'Yes' : 'No'}
            </span>
          </div>
        </LabeledField>
      </div>

      {/* Blockers · Next Steps */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <LabeledField label="Blockers" style={{ flex: '1 1 180px' }}>
          <input type="text"
            value={row.blockers ?? ''}
            onChange={e => onUpdate(row._key, 'blockers', e.target.value || null)}
            placeholder="Any blockers?"
            style={{ ...inputStyle }} />
        </LabeledField>
        <LabeledField label="Next Steps" style={{ flex: '1 1 180px' }}>
          <input type="text"
            value={row.next_steps ?? ''}
            onChange={e => onUpdate(row._key, 'next_steps', e.target.value || null)}
            placeholder="What's next?"
            style={{ ...inputStyle }} />
        </LabeledField>
      </div>

      {/* Clarification quick-pick — shown when needs review */}
      {row.clarification_needed && (
        <div>
          <div className="flex items-start gap-2 rounded px-3 py-2 text-xs mb-2"
            style={{ background: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}>
            <Info size={11} className="mt-0.5 shrink-0" />
            <span>{row.clarification_reason ?? 'Please verify the category, hours, and status for this item.'}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', alignSelf: 'center' }}>Quick pick:</span>
            {QUICK_CATEGORIES.map(cat => (
              <button key={cat}
                onClick={() => { onUpdate(row._key, 'work_category', cat); onUpdate(row._key, 'clarification_needed', false) }}
                style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 999,
                  border: `1px solid ${row.work_category === cat ? 'var(--color-brand-primary)' : 'var(--color-border-default)'}`,
                  background: row.work_category === cat ? 'rgba(99,102,241,0.15)' : 'transparent',
                  color: row.work_category === cat ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                }}>
                {cat}
              </button>
            ))}
            <button onClick={() => { onUpdate(row._key, 'status', 'done'); onUpdate(row._key, 'clarification_needed', false) }}
              style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: '#10B981', cursor: 'pointer' }}>
              Mark done
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubmitUpdatePage() {
  const navigate = useNavigate()
  const today  = new Date().toISOString().split('T')[0]
  const keyRef = useRef(0)

  const [rawText, setRawText]       = useState('')
  const [workDate, setWorkDate]     = useState(today)
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [aiStage, setAiStage]       = useState(-1)        // -1 = idle
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null)
  const [rows, setRows]             = useState<PreviewRow[]>([])
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [inputHidden, setInputHidden]       = useState(false)
  const [templatesOpen, setTemplatesOpen]   = useState(false)
  const [recentOpen, setRecentOpen]         = useState(false)
  const [saveLabel, setSaveLabel]           = useState<string | null>(null) // null=closed, ''=open input

  const { templates: userTemplates, save: saveUserTemplate, remove: removeUserTemplate } = useUserTemplates()

  // Fetch recent submissions — only when panel is open
  const recentQ = useQuery({
    queryKey: ['recent-updates'],
    queryFn: () => apiClient.get<WorkLog[]>('/updates/', { params: { limit: 5 } }).then(r => r.data),
    enabled: recentOpen,
    staleTime: 30_000,
  })

  // dnd-kit sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── AI stage ticker ────────────────────────────────────────────────────────

  const runAiStages = useCallback(() => {
    setAiStage(0)
    const delays = [800, 1400, 1000]
    let t = 0
    delays.forEach((d, i) => {
      t += d
      setTimeout(() => setAiStage(i + 1), t)
    })
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    runAiStages()
    try {
      const res = await apiClient.post<ExtractionResult>('/updates/submit', {
        raw_message: rawText,
        work_date: workDate,
      })
      const data = res.data
      setExtraction(data)
      setRows(data.items.map(item => ({ ...item, _key: ++keyRef.current })))
      setAiStage(AI_STAGES.length - 1)
    } catch {
      setSubmitError('Extraction failed. Please try again.')
      setAiStage(-1)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirm() {
    if (!extraction) return
    setConfirming(true)
    setConfirmError(null)
    try {
      await apiClient.put(`/updates/${extraction.work_log_id}/confirm`, {
        work_date: workDate,
        items: rows.map(({ _key: _k, ...item }) => item),
      })
      toast.success('Work log saved successfully!')

      // First-submission confetti (silently skipped in non-canvas environments)
      if (!localStorage.getItem('hasSubmittedBefore')) {
        localStorage.setItem('hasSubmittedBefore', '1')
        import('canvas-confetti').then(m => {
          try { m.default({ particleCount: 120, spread: 80, origin: { y: 0.6 } }) } catch { /* jsdom */ }
        }).catch(() => { /* silently skip */ })
      }

      navigate('/my-dashboard')
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number; data?: { detail?: string } } }
      const status   = axiosErr?.response?.status
      const detail   = axiosErr?.response?.data?.detail

      if (status === 409) {
        // Already confirmed — navigate to dashboard to see the saved log
        toast.success('Already saved — taking you to your dashboard.')
        navigate('/my-dashboard')
        return
      }

      const msg = detail
        ? `Save failed: ${detail}`
        : 'Failed to save. Please try again.'

      toast.error(msg)
      setConfirmError(msg)
      console.error('[confirm] save failed', { status, detail, err })
    } finally {
      setConfirming(false)
    }
  }

  function handleCancel() {
    setExtraction(null)
    setRows([])
    setSubmitError(null)
    setConfirmError(null)
    setAiStage(-1)
  }

  function updateRow(key: number, field: keyof WorkItemExtracted, value: string | number | boolean | null) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r))
  }

  function deleteRow(key: number) {
    setRows(prev => prev.filter(r => r._key !== key))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setRows(prev => {
        const oldIdx = prev.findIndex(r => r._key === active.id)
        const newIdx = prev.findIndex(r => r._key === over.id)
        return arrayMove(prev, oldIdx, newIdx)
      })
    }
  }

  // ── Derived ───────────────────────────────────────────────────────────────────

  const totalHours     = rows.reduce((s, r) => s + (r.hours_spent ?? 0), 0)
  const hoursWarning   = extraction?.total_hours_warning || totalHours > 12
  const hasClarify     = extraction?.has_clarification_needed || rows.some(r => r.clarification_needed)
  const taskEstimate   = estimateTaskCount(rawText)
  const hasExtraction  = extraction !== null

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1400px' }}>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Submit Work Update
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Describe what you worked on in plain language — AI handles the rest
        </p>
      </div>

      {/* Open Tasks Panel */}
      <OpenTasksPanel />

      {/* Split-pane workspace */}
      <div className="flex gap-5" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── LEFT: Input zone ─────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
        {!inputHidden && (
        <motion.div
          key="input-zone"
          initial={{ opacity: 0, width: 0, minWidth: 0 }}
          animate={{ opacity: 1, width: 'auto', minWidth: 320 }}
          exit={{ opacity: 0, width: 0, minWidth: 0, overflow: 'hidden' }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-4 rounded-xl p-5"
          style={{ flex: '1 1 380px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>

          {/* ── Templates panel ───────────────────────────────────────────── */}
          <div>
            <button onClick={() => setTemplatesOpen(o => !o)}
              className="flex items-center gap-2 w-full text-xs font-medium mb-1"
              style={{ color: 'var(--color-text-secondary)' }}>
              {templatesOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              Use a template
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>
                {TEMPLATES.length + userTemplates.length} available
              </span>
            </button>

            {templatesOpen && (
              <div style={{ paddingTop: 6 }}>
                {/* My templates */}
                {userTemplates.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 5 }}>
                      My Templates
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {userTemplates.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)' }}>
                          <BookmarkPlus size={11} style={{ flexShrink: 0, color: 'var(--color-brand-primary)' }} />
                          <button className="flex-1 text-left text-xs font-medium truncate"
                            style={{ color: 'var(--color-text-primary)' }}
                            onClick={() => { setRawText(prev => prev ? `${prev}\n\n${t.text}` : t.text); setTemplatesOpen(false) }}>
                            {t.label}
                          </button>
                          <button onClick={() => removeUserTemplate(t.id)} title="Delete template"
                            style={{ color: 'var(--color-text-muted)', flexShrink: 0, lineHeight: 0 }}>
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Built-in templates */}
                <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 5 }}>
                  Built-in
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 6 }}>
                  {TEMPLATES.map(t => {
                    const Icon = t.icon
                    return (
                      <button key={t.label}
                        onClick={() => { setRawText(prev => prev ? `${prev}\n\n${t.text}` : t.text); setTemplatesOpen(false) }}
                        className="flex flex-col gap-1.5 rounded-lg p-2.5 text-left transition-all"
                        style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = t.color; e.currentTarget.style.background = `${t.color}0f` }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-default)'; e.currentTarget.style.background = 'var(--color-bg-elevated)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <Icon size={12} style={{ color: t.color }} />
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)' }}>{t.label}</span>
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{t.hint}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Textarea */}
          <div className="flex flex-col gap-1">
            <label htmlFor="work-description" className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}>
              Describe your work today
            </label>
            <textarea
              id="work-description"
              rows={7}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              disabled={submitting}
              placeholder="e.g. Spent 3 hours fixing the authentication bug, then attended sprint planning for 1 hour, and reviewed 2 PRs..."
              className="rounded-lg px-3 py-2.5 text-sm resize-none transition-all"
              style={{
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-default)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                lineHeight: 1.6,
              }}
            />

            {/* Live stats bar + save-as-template */}
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span>
                {rawText.length > 0 && (
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    ~{taskEstimate} task{taskEstimate !== 1 ? 's' : ''} detected
                  </span>
                )}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>{rawText.length} chars</span>
                {rawText.trim().length > 20 && saveLabel === null && (
                  <button onClick={() => setSaveLabel('')}
                    className="flex items-center gap-1 transition-colors"
                    style={{ color: 'var(--color-brand-primary)', fontSize: 10 }}>
                    <BookmarkPlus size={11} /> Create template
                  </button>
                )}
              </div>
            </div>

            {/* Save template inline form */}
            <AnimatePresence>
              {saveLabel !== null && (
                <motion.div key="save-tmpl"
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
                  style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: 6, paddingTop: 4 }}>
                    <input
                      autoFocus
                      type="text"
                      value={saveLabel}
                      onChange={e => setSaveLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && saveLabel.trim()) { saveUserTemplate(saveLabel, rawText).then(() => { setSaveLabel(null); toast.success('Template saved!') }) }
                        if (e.key === 'Escape') setSaveLabel(null)
                      }}
                      placeholder="Template name…"
                      style={{ flex: 1, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}
                    />
                    <button
                      disabled={!saveLabel.trim()}
                      onClick={() => saveUserTemplate(saveLabel, rawText).then(() => { setSaveLabel(null); toast.success('Template saved!') })}
                      style={{ padding: '4px 10px', borderRadius: 6, background: 'var(--color-brand-primary)', color: '#fff', fontSize: 11, fontWeight: 600, opacity: saveLabel.trim() ? 1 : 0.4 }}>
                      Save
                    </button>
                    <button onClick={() => setSaveLabel(null)} style={{ color: 'var(--color-text-muted)', lineHeight: 0 }}>
                      <X size={13} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ── Recent Submissions ─────────────────────────────────────────── */}
          <div>
            <button onClick={() => setRecentOpen(o => !o)}
              className="flex items-center gap-2 w-full text-xs font-medium mb-1"
              style={{ color: 'var(--color-text-secondary)' }}>
              {recentOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              <Clock size={11} />
              Recent submissions
            </button>

            {recentOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6 }}>
                {recentQ.isLoading && [0,1,2].map(i => (
                  <div key={i} style={{ height: 44, borderRadius: 8, background: 'var(--color-bg-elevated)', opacity: 0.6 }} />
                ))}
                {recentQ.data?.filter(l => l.extraction_status === 'success').slice(0, 5).map(log => (
                  <div key={log.id} style={{ display: 'flex', gap: 8, padding: '7px 10px', borderRadius: 8, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 10, color: 'var(--color-text-muted)', marginBottom: 2 }}>
                        {log.work_date}
                        {log.work_items?.length ? ` · ${log.work_items.length} item${log.work_items.length !== 1 ? 's' : ''}` : ''}
                      </p>
                      <p className="truncate" style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                        {log.raw_message.slice(0, 90)}{log.raw_message.length > 90 ? '…' : ''}
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                      <button onClick={() => { setRawText(log.raw_message); setRecentOpen(false) }}
                        style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)', background: 'transparent', cursor: 'pointer' }}>
                        Use
                      </button>
                      <button onClick={() => { setSaveLabel(log.work_date); setRecentOpen(false) }}
                        style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, border: '1px solid rgba(99,102,241,0.3)', color: 'var(--color-brand-primary)', background: 'transparent', cursor: 'pointer' }}>
                        Bookmark
                      </button>
                    </div>
                  </div>
                ))}
                {recentQ.data?.length === 0 && (
                  <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center', padding: '8px 0' }}>
                    No previous submissions yet.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Date picker */}
          <div className="flex items-center gap-3">
            <Calendar size={14} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <label htmlFor="work-date" className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
              For date:
            </label>
            <input
              id="work-date"
              type="date"
              value={workDate}
              max={today}
              onChange={e => setWorkDate(e.target.value)}
              className="rounded-md px-3 py-1.5 text-sm"
              style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)' }}
            />
          </div>

          {/* AI stage strip / submit button */}
          <AnimatePresence mode="wait">
            {submitting ? (
              <AIThinkingStrip key="thinking" stage={aiStage} />
            ) : (
              <motion.button
                key="submit-btn"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={handleSubmit}
                disabled={!rawText.trim() || submitting}
                aria-label="Submit with AI"
                className={cn(
                  'flex items-center justify-center gap-2 w-full rounded-lg px-4 py-3 text-sm font-semibold transition-all',
                  (!rawText.trim() || submitting) && 'opacity-40 cursor-not-allowed',
                )}
                style={{ background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))', color: '#fff' }}
                whileHover={rawText.trim() ? { scale: 1.01 } : {}}
                whileTap={rawText.trim() ? { scale: 0.98 } : {}}
              >
                <Sparkles size={15} />
                {hasExtraction ? 'Re-extract with AI' : 'Submit with AI'}
              </motion.button>
            )}
          </AnimatePresence>

          {submitError && (
            <p className="text-xs" style={{ color: 'var(--color-status-danger)' }}>{submitError}</p>
          )}
        </motion.div>
        )}
        </AnimatePresence>

        {/* ── RIGHT: Extraction preview ─────────────────────────────────────── */}
        <AnimatePresence>
          {hasExtraction && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col gap-4 rounded-xl overflow-hidden"
              style={{
                flex: '1 1 400px', minWidth: 320,
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
                borderTop: '3px solid var(--color-brand-primary)',
              }}
            >
              {/* Preview header */}
              <div className="px-5 pt-5 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="flex items-center gap-2 text-base font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}>
                    <Sparkles size={15} color="var(--color-brand-secondary)" />
                    AI Extracted Items
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Review and edit before saving — drag to reorder
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
                    {rows.length} item{rows.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h
                  </span>
                  <button
                    onClick={() => setInputHidden(h => !h)}
                    title={inputHidden ? 'Show input panel' : 'Hide input panel'}
                    className="rounded-md p-1.5 transition-colors"
                    style={{ color: 'var(--color-text-muted)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-elevated)' }}
                  >
                    {inputHidden ? <PanelLeftOpen size={13} /> : <PanelLeftClose size={13} />}
                  </button>
                </div>
              </div>

              {/* Warnings */}
              <div className="px-5 flex flex-col gap-2">
                {hoursWarning && (
                  <div className="rounded-md px-3 py-2 text-xs flex items-center gap-2"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.4)', color: '#F59E0B' }}>
                    <AlertTriangle size={12} />
                    Total hours exceed 12 — please verify
                  </div>
                )}
                {hasClarify && (
                  <div className="rounded-md px-3 py-2 text-xs flex items-center gap-2"
                    style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', color: 'var(--color-brand-primary)' }}>
                    <Info size={12} />
                    Some items need clarification — use the quick-pick chips below each
                  </div>
                )}
              </div>

              {/* Draggable item cards */}
              <div className="px-5 flex flex-col gap-3">
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={rows.map(r => r._key)} strategy={verticalListSortingStrategy}>
                    <AnimatePresence>
                      {rows.map(row => (
                        <SortableItemCard
                          key={row._key}
                          row={row}
                          onUpdate={updateRow}
                          onDelete={deleteRow}
                        />
                      ))}
                    </AnimatePresence>
                  </SortableContext>
                </DndContext>
              </div>

              {/* Add row */}
              <div className="px-5">
                <button
                  onClick={() => setRows(prev => [...prev, makeNewRow(keyRef)])}
                  aria-label="Add item"
                  className="flex items-center gap-1.5 text-xs font-medium rounded-lg px-3 py-2 w-full justify-center transition-all"
                  style={{ color: 'var(--color-brand-primary)', border: '1px dashed var(--color-border-default)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-brand-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}>
                  <Plus size={12} /> Add Item
                </button>
              </div>

              {confirmError && (
                <p className="px-5 text-xs" style={{ color: 'var(--color-status-danger)' }}>{confirmError}</p>
              )}

              {/* Footer actions */}
              <div className="px-5 py-4 flex justify-end gap-3"
                style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                <button onClick={handleCancel}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-all"
                  style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
                  Cancel
                </button>
                <button onClick={handleConfirm}
                  disabled={confirming || rows.length === 0}
                  className={cn(
                    'rounded-lg px-5 py-2 text-sm font-semibold transition-all flex items-center gap-2',
                    (confirming || rows.length === 0) && 'opacity-40 cursor-not-allowed',
                  )}
                  style={{ background: 'var(--color-brand-primary)', color: '#fff' }}>
                  {confirming ? (
                    <>
                      <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                        style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%' }} />
                      Saving…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      Confirm & Save
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
