import React, { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Sparkles, Trash2, Plus, AlertTriangle, Info,
  GripVertical, CheckCircle2, Calendar,
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
import type { ExtractionResult, WorkItemExtracted, WorkCategory, StatusType } from '@/types/models'
import { cn } from '@/utils/cn'

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

const TEMPLATES = [
  { label: 'Meeting',     text: 'Attended [meeting] for [X] hours. Discussed [topics]. Action items: [list].' },
  { label: 'Development', text: 'Worked on [feature/bug] for [X] hours. [Progress]. Status: in_progress.' },
  { label: 'Research',    text: 'Researched [topic] for [X] hours. Key findings: [summary].' },
  { label: 'Support',     text: 'Handled [N] support tickets for [X] hours. Resolved [issue].' },
  { label: 'Code review', text: 'Reviewed [N] PRs for [X] hours. Gave feedback on [repos].' },
] as const

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
      {/* Card top row: drag handle + description + confidence + delete */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <button
          {...attributes} {...listeners}
          aria-label="Drag to reorder"
          style={{ cursor: 'grab', color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 3, touchAction: 'none' }}
        >
          <GripVertical size={14} />
        </button>

        <input
          type="text"
          value={row.task_description}
          onChange={e => onUpdate(row._key, 'task_description', e.target.value)}
          placeholder="Task description"
          style={{ ...inputStyle, flex: 1, fontWeight: 500 }}
        />

        <ConfidenceBadge score={row.confidence_score} />

        <button onClick={() => onDelete(row._key)} aria-label="Delete row"
          style={{ color: 'var(--color-status-danger)', flexShrink: 0, marginTop: 2 }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Second row: hours + category + status + priority */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 22 }}>
        <input type="number" min="0" step="0.5"
          value={row.hours_spent ?? ''}
          onChange={e => onUpdate(row._key, 'hours_spent', parseFloat(e.target.value) || 0)}
          placeholder="Hours"
          style={{ ...inputStyle, width: 70 }}
        />
        <select value={row.work_category}
          onChange={e => onUpdate(row._key, 'work_category', e.target.value as WorkCategory)}
          style={{ ...inputStyle, width: 120 }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={row.status ?? ''}
          onChange={e => onUpdate(row._key, 'status', (e.target.value as StatusType) || null)}
          style={{ ...inputStyle, width: 110 }}>
          <option value="">Status…</option>
          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={row.priority ?? ''}
          onChange={e => onUpdate(row._key, 'priority', e.target.value || null)}
          style={{ ...inputStyle, width: 90 }}>
          <option value="">Priority…</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Quick-fix chips for needs_review */}
      {row.needs_review && !row.clarification_needed && (
        <div style={{ paddingLeft: 22, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          <span style={{ fontSize: 10, color: '#F59E0B', marginRight: 4, alignSelf: 'center' }}>Quick fix:</span>
          {QUICK_CATEGORIES.map(cat => (
            <button key={cat} onClick={() => onUpdate(row._key, 'work_category', cat)}
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
          <button onClick={() => onUpdate(row._key, 'status', 'done')}
            style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(16,185,129,0.4)', background: 'rgba(16,185,129,0.08)', color: '#10B981', cursor: 'pointer' }}>
            Mark done
          </button>
        </div>
      )}

      {/* Clarification quick-pick */}
      {row.clarification_needed && (
        <div style={{ paddingLeft: 22 }}>
          <div className="flex items-start gap-2 rounded px-3 py-2 text-xs mb-2"
            style={{ background: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}>
            <Info size={11} className="mt-0.5 shrink-0" />
            <span>{row.clarification_reason ?? 'Needs clarification'}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', alignSelf: 'center' }}>This is a:</span>
            {QUICK_CATEGORIES.map(cat => (
              <button key={cat} onClick={() => { onUpdate(row._key, 'work_category', cat); onUpdate(row._key, 'clarification_needed', false) }}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-surface)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubmitUpdatePage() {
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

      setRawText('')
      setWorkDate(today)
      setExtraction(null)
      setRows([])
      setAiStage(-1)
    } catch {
      toast.error('Failed to save. Please try again.')
      setConfirmError('Failed to save. Please try again.')
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

      {/* Split-pane workspace */}
      <div className="flex gap-5" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── LEFT: Input zone ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 rounded-xl p-5"
          style={{ flex: '1 1 380px', minWidth: 320, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>

          {/* Template chips */}
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
              Quick templates:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEMPLATES.map(t => (
                <button key={t.label}
                  onClick={() => setRawText(prev => prev ? `${prev}\n${t.text}` : t.text)}
                  className="rounded-full px-3 py-1 text-xs transition-all"
                  style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)', background: 'var(--color-bg-elevated)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-brand-primary)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}>
                  {t.label}
                </button>
              ))}
            </div>
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

            {/* Live stats bar */}
            <div className="flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
              <span>
                {rawText.length > 0 && (
                  <span style={{ color: 'var(--color-text-secondary)' }}>
                    ~{taskEstimate} task{taskEstimate !== 1 ? 's' : ''} detected
                  </span>
                )}
              </span>
              <span>{rawText.length} chars</span>
            </div>
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
        </div>

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
              <div className="px-5 pt-5 flex items-start justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}>
                    <Sparkles size={15} color="var(--color-brand-secondary)" />
                    AI Extracted Items
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    Review and edit before saving — drag to reorder
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium"
                  style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
                  {rows.length} item{rows.length !== 1 ? 's' : ''} · {totalHours.toFixed(1)}h
                </span>
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
