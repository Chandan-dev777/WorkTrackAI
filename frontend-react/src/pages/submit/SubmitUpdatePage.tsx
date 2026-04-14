import { useState } from 'react'
import { Sparkles, Trash2, Plus, AlertTriangle, Info } from 'lucide-react'
import { apiClient } from '@/api/client'
import type { ExtractionResult, WorkItemExtracted, WorkCategory, StatusType } from '@/types/models'
import { cn } from '@/utils/cn'

// ── Options matching backend enums ────────────────────────────────────────────

const CATEGORIES: WorkCategory[] = [
  'project', 'ticket', 'polaris_classification', 'admin',
  'meeting', 'learning', 'support', 'documentation', 'review', 'other',
]

const STATUSES: StatusType[] = ['done', 'in_progress', 'blocked', 'planned']
const PRIORITIES = ['low', 'medium', 'high'] as const

// ── Preview row = full LLM schema + internal key ──────────────────────────────

interface PreviewRow extends WorkItemExtracted {
  _key: number
}

let _rowKey = 0
function newRow(): PreviewRow {
  return {
    _key: ++_rowKey,
    task_description: '', work_category: 'project', hours_spent: null, status: null,
    priority: null, blockers: null, next_steps: null, tags: null, links: null,
    project_name: null, ticket_id: null, confidence_score: null,
    clarification_needed: false, clarification_reason: null,
  }
}

// ── Shared input / select style ───────────────────────────────────────────────

const cellStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  color: 'var(--color-text-primary)',
}

const cellCls = 'w-full rounded px-2 py-1 text-xs'

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SubmitUpdatePage() {
  const today = new Date().toISOString().split('T')[0]

  const [rawText, setRawText]       = useState('')
  const [workDate, setWorkDate]     = useState(today)
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null)
  const [rows, setRows]             = useState<PreviewRow[]>([])
  const [submitError, setSubmitError]   = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [confirmed, setConfirmed]   = useState(false)

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    setConfirmed(false)
    try {
      const res = await apiClient.post<ExtractionResult>('/updates/submit', {
        raw_message: rawText,
        work_date: workDate,
      })
      const data = res.data
      setExtraction(data)
      setRows(data.items.map(item => ({ ...item, _key: ++_rowKey })))
    } catch {
      setSubmitError('Extraction failed. Please try again.')
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
      setConfirmed(true)
      setRawText('')
      setWorkDate(today)
      setExtraction(null)
      setRows([])
    } catch {
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
  }

  function updateRow(key: number, field: keyof WorkItemExtracted, value: string | number | boolean | null) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r))
  }

  function deleteRow(key: number) {
    setRows(prev => prev.filter(r => r._key !== key))
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1200px' }}>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Submit Work Update
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Describe what you worked on today in plain language
        </p>
      </div>

      {/* Success banner */}
      {confirmed && (
        <div className="rounded-lg px-4 py-3 text-sm font-medium flex items-center gap-2"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid #10B981', color: '#34D399' }}>
          Work log saved successfully!
        </div>
      )}

      {/* Input card */}
      {!extraction && (
        <div className="rounded-lg p-6 flex flex-col gap-4"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>

          <div className="flex flex-col gap-1">
            <label htmlFor="work-date" className="text-xs font-medium"
              style={{ color: 'var(--color-text-secondary)' }}>
              For date:
            </label>
            <input id="work-date" type="date" value={workDate}
              onChange={e => setWorkDate(e.target.value)}
              className="rounded-md px-3 py-2 text-sm w-48" style={cellStyle} />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="work-description" className="text-sm font-medium"
              style={{ color: 'var(--color-text-primary)' }}>
              Describe your work today
            </label>
            <textarea id="work-description" rows={6} value={rawText}
              onChange={e => setRawText(e.target.value)}
              placeholder="e.g. Spent 3 hours fixing the authentication bug, then attended sprint planning for 1 hour, and reviewed 2 PRs..."
              className="rounded-md px-3 py-2 text-sm resize-none" style={cellStyle} />
            <span className="text-xs self-end" style={{ color: 'var(--color-text-muted)' }}>
              {rawText.length} chars
            </span>
          </div>

          {submitError && (
            <p className="text-sm" style={{ color: 'var(--color-status-danger)' }}>{submitError}</p>
          )}

          <button onClick={handleSubmit} disabled={!rawText.trim() || submitting}
            aria-label="Submit with AI"
            className={cn(
              'flex items-center justify-center gap-2 w-full rounded-md px-4 py-3 text-sm font-semibold transition-all',
              (!rawText.trim() || submitting) && 'opacity-50 cursor-not-allowed',
            )}
            style={{ background: 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))', color: '#fff' }}>
            <Sparkles size={16} />
            {submitting ? 'Extracting with AI...' : 'Submit with AI'}
          </button>
        </div>
      )}

      {/* Extraction preview */}
      {extraction && (
        <div className="rounded-lg overflow-hidden"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderTop: '3px solid var(--color-brand-primary)' }}>

          {/* Preview header */}
          <div className="px-6 pt-5 pb-3 flex items-start justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold"
                style={{ color: 'var(--color-text-primary)' }}>
                <Sparkles size={16} color="var(--color-brand-secondary)" />
                AI Extracted Items
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                Review and edit before saving
              </p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full font-medium"
              style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)' }}>
              {rows.length} item{rows.length !== 1 ? 's' : ''} · {rows.reduce((s, r) => s + (r.hours_spent ?? 0), 0).toFixed(1)}h total
            </span>
          </div>

          {/* Warning banners */}
          {extraction.total_hours_warning && (
            <div className="mx-6 mb-3 rounded-md px-3 py-2 text-xs flex items-center gap-2"
              style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid #F59E0B', color: '#F59E0B' }}>
              <AlertTriangle size={13} />
              Total hours exceed 12 — please check hours are correct
            </div>
          )}
          {extraction.has_clarification_needed && (
            <div className="mx-6 mb-3 rounded-md px-3 py-2 text-xs flex items-center gap-2"
              style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid var(--color-brand-primary)', color: 'var(--color-brand-primary)' }}>
              <Info size={13} />
              Some items need clarification — review flagged rows below
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto px-6">
            <table className="w-full text-sm border-collapse"
              aria-label="Extracted work items — review and edit before saving">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  {[
                    { label: 'Description', width: '' },
                    { label: 'Hours',       width: 'w-16' },
                    { label: 'Category',    width: 'w-36' },
                    { label: 'Status',      width: 'w-28' },
                    { label: 'Priority',    width: 'w-24' },
                    { label: 'Ticket ID',   width: 'w-24' },
                    { label: 'Project',     width: 'w-28' },
                    { label: 'Confidence',  width: 'w-24' },
                    { label: 'Review?',     width: 'w-16' },
                    { label: '',            width: 'w-10' },
                  ].map(({ label, width }) => (
                    <th key={label} className={cn('py-2 px-2 text-left text-xs font-medium', width)}
                      style={{ color: 'var(--color-text-secondary)' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <>
                    <tr key={row._key}
                      style={{ borderBottom: row.clarification_reason ? 'none' : '1px solid var(--color-border-subtle)' }}>

                      {/* task_description */}
                      <td className="py-2 px-2">
                        <input type="text" value={row.task_description}
                          onChange={e => updateRow(row._key, 'task_description', e.target.value)}
                          className={cellCls} style={cellStyle} />
                      </td>

                      {/* hours_spent */}
                      <td className="py-2 px-2">
                        <input type="number" min="0" step="0.5" value={row.hours_spent ?? ''}
                          onChange={e => updateRow(row._key, 'hours_spent', parseFloat(e.target.value) || 0)}
                          className={cellCls} style={cellStyle} />
                      </td>

                      {/* work_category */}
                      <td className="py-2 px-2">
                        <select value={row.work_category}
                          onChange={e => updateRow(row._key, 'work_category', e.target.value as WorkCategory)}
                          className={cellCls} style={cellStyle}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </td>

                      {/* status */}
                      <td className="py-2 px-2">
                        <select value={row.status ?? ''}
                          onChange={e => updateRow(row._key, 'status', e.target.value as StatusType)}
                          className={cellCls} style={cellStyle}>
                          <option value="">—</option>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* priority */}
                      <td className="py-2 px-2">
                        <select value={row.priority ?? ''}
                          onChange={e => updateRow(row._key, 'priority', e.target.value || null)}
                          className={cellCls} style={cellStyle}>
                          <option value="">—</option>
                          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>

                      {/* ticket_id */}
                      <td className="py-2 px-2">
                        <input type="text" value={row.ticket_id ?? ''}
                          onChange={e => updateRow(row._key, 'ticket_id', e.target.value || null)}
                          placeholder="e.g. JIRA-123"
                          className={cellCls} style={cellStyle} />
                      </td>

                      {/* project_name */}
                      <td className="py-2 px-2">
                        <input type="text" value={row.project_name ?? ''}
                          onChange={e => updateRow(row._key, 'project_name', e.target.value || null)}
                          placeholder="Project"
                          className={cellCls} style={cellStyle} />
                      </td>

                      {/* confidence_score — read-only */}
                      <td className="py-2 px-2 text-center">
                        {row.confidence_score != null ? (
                          <span className="inline-flex items-center gap-1 text-xs font-mono rounded px-1.5 py-0.5"
                            style={{
                              background: row.confidence_score >= 0.8
                                ? 'rgba(16,185,129,0.15)' : row.confidence_score >= 0.5
                                ? 'rgba(245,158,11,0.15)' : 'rgba(244,63,94,0.15)',
                              color: row.confidence_score >= 0.8
                                ? '#10B981' : row.confidence_score >= 0.5
                                ? '#F59E0B' : '#F43F5E',
                            }}>
                            {Math.round(row.confidence_score * 100)}%
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                        )}
                      </td>

                      {/* clarification_needed — read-only */}
                      <td className="py-2 px-2 text-center">
                        {row.clarification_needed ? (
                          <span title={row.clarification_reason ?? undefined}>
                            <AlertTriangle size={13} color="#F59E0B" />
                          </span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>✓</span>
                        )}
                      </td>

                      {/* delete */}
                      <td className="py-2 px-2 text-center">
                        <button onClick={() => deleteRow(row._key)} aria-label="Delete row"
                          className="rounded p-1 transition-colors"
                          style={{ color: 'var(--color-status-danger)' }}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>

                    {/* clarification_reason sub-row */}
                    {row.clarification_needed && row.clarification_reason && (
                      <tr key={`${row._key}-clarify`}
                        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td colSpan={10} className="px-3 pb-2">
                          <div className="rounded px-3 py-1.5 text-xs flex items-start gap-2"
                            style={{ background: 'rgba(245,158,11,0.08)', color: '#F59E0B' }}>
                            <Info size={12} className="mt-0.5 shrink-0" />
                            <span><strong>Needs clarification:</strong> {row.clarification_reason}</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add row */}
          <div className="px-6 py-3">
            <button onClick={() => setRows(prev => [...prev, newRow()])}
              aria-label="Add item"
              className="flex items-center gap-1 text-xs font-medium rounded px-3 py-1.5"
              style={{ color: 'var(--color-brand-primary)', border: '1px dashed var(--color-border-default)' }}>
              <Plus size={12} /> Add Item
            </button>
          </div>

          {confirmError && (
            <div className="px-6 pb-2">
              <p className="text-sm" style={{ color: 'var(--color-status-danger)' }}>{confirmError}</p>
            </div>
          )}

          {/* Footer actions */}
          <div className="px-6 py-4 flex justify-end gap-3"
            style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
            <button onClick={handleCancel}
              className="rounded-md px-4 py-2 text-sm font-medium"
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
              Cancel
            </button>
            <button onClick={handleConfirm} disabled={confirming}
              className={cn('rounded-md px-4 py-2 text-sm font-semibold', confirming && 'opacity-50 cursor-not-allowed')}
              style={{ background: 'var(--color-brand-primary)', color: '#fff' }}>
              {confirming ? 'Saving...' : 'Confirm & Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
