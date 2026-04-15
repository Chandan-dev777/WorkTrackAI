import { useState } from 'react'
import { ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { assistantApi } from '@/api/assistant'
import type { AssistantNote, NoteStatus } from '@/types/models'

const TYPE_ICON: Record<string, string> = {
  bug: '🐛',
  requirement: '✨',
  feedback: '💬',
}

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#f43f5e',
  high: '#f97316',
  medium: '#eab308',
  low: '#6b7280',
}

const STATUS_OPTIONS: NoteStatus[] = ['open', 'acknowledged', 'in_progress', 'resolved', 'wont_fix']
const STATUS_LABEL: Record<NoteStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  wont_fix: "Won't Fix",
}

interface NoteCardProps {
  note: AssistantNote
}

export function NoteCard({ note }: NoteCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const updateMutation = useMutation({
    mutationFn: (status: NoteStatus) => assistantApi.updateNote(note.id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['assistant-notes'] }),
  })

  const handleCopyId = () => {
    navigator.clipboard.writeText(note.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const priorityColor = PRIORITY_COLOR[note.priority] ?? '#6b7280'
  const isResolved = note.status === 'resolved' || note.status === 'wont_fix'

  return (
    <div
      className="rounded-lg overflow-hidden transition-all duration-200"
      style={{
        border: `1px solid var(--color-border-default)`,
        borderLeft: `3px solid ${priorityColor}`,
        background: 'var(--color-bg-elevated)',
        opacity: isResolved ? 0.6 : 1,
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2 px-3 py-2.5">
        <span className="text-sm flex-shrink-0 mt-0.5">{TYPE_ICON[note.type] ?? '📝'}</span>

        <div className="flex-1 min-w-0">
          <p
            className="text-xs font-medium leading-tight truncate"
            style={{ color: 'var(--color-text-primary)', textDecoration: isResolved ? 'line-through' : 'none' }}
          >
            {note.title}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {/* Priority badge */}
            <span
              className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full"
              style={{ background: `${priorityColor}20`, color: priorityColor }}
            >
              {note.priority}
            </span>
            {/* Status dropdown */}
            <select
              value={note.status}
              onChange={(e) => updateMutation.mutate(e.target.value as NoteStatus)}
              disabled={updateMutation.isPending}
              className="text-[9px] rounded px-1 py-0.5 outline-none cursor-pointer"
              style={{
                background: 'var(--color-bg-base)',
                border: '1px solid var(--color-border-subtle)',
                color: 'var(--color-text-secondary)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleCopyId}
            title="Copy note ID"
            className="p-1 rounded hover:bg-[var(--color-bg-overlay)] transition-colors"
          >
            {copied
              ? <Check size={11} style={{ color: '#34d399' }} />
              : <Copy size={11} style={{ color: 'var(--color-text-muted)' }} />
            }
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-[var(--color-bg-overlay)] transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded
              ? <ChevronUp size={12} style={{ color: 'var(--color-text-muted)' }} />
              : <ChevronDown size={12} style={{ color: 'var(--color-text-muted)' }} />
            }
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div
          className="px-3 pb-3"
          style={{ borderTop: '1px solid var(--color-border-subtle)' }}
        >
          <p
            className="text-[11px] leading-relaxed mt-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {note.body}
          </p>
          {note.affected_page && (
            <p className="text-[10px] mt-1.5" style={{ color: 'var(--color-text-muted)' }}>
              Page: {note.affected_page}
            </p>
          )}
          <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            ID: <code className="font-mono">{note.id.slice(0, 8)}…</code>
          </p>
        </div>
      )}
    </div>
  )
}
