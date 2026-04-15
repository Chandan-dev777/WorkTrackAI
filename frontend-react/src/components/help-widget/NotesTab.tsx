import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { assistantApi } from '@/api/assistant'
import { NoteCard } from './NoteCard'
import type { NoteType, NoteStatus } from '@/types/models'

const TYPE_FILTERS: Array<{ label: string; value: NoteType | '' }> = [
  { label: 'All', value: '' },
  { label: '🐛 Bugs', value: 'bug' },
  { label: '✨ Reqs', value: 'requirement' },
  { label: '💬 Feedback', value: 'feedback' },
]

const STATUS_FILTERS: Array<{ label: string; value: NoteStatus | '' }> = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
]

export function NotesTab() {
  const [typeFilter, setTypeFilter] = useState<NoteType | ''>('')
  const [statusFilter, setStatusFilter] = useState<NoteStatus | ''>('')

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['assistant-notes', typeFilter, statusFilter],
    queryFn: () =>
      assistantApi.listNotes({
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      }),
  })

  const filterBtn = (active: boolean) => ({
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '10px',
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--color-brand-primary)' : 'var(--color-border-subtle)'}`,
    background: active ? 'var(--color-brand-subtle)' : 'transparent',
    color: active ? 'var(--color-brand-secondary)' : 'var(--color-text-secondary)',
    transition: 'all 0.15s',
  } as React.CSSProperties)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div
        className="px-3 py-2 flex flex-col gap-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
      >
        <div className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((f) => (
            <button key={f.value} style={filterBtn(typeFilter === f.value)} onClick={() => setTypeFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((f) => (
            <button key={f.value} style={filterBtn(statusFilter === f.value)} onClick={() => setStatusFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        {isLoading && (
          <p className="text-xs text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
            Loading…
          </p>
        )}
        {!isLoading && notes.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No notes yet.</p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Chat with me to file bugs or requirements.
            </p>
          </div>
        )}
        {notes.map((note) => (
          <NoteCard key={note.id} note={note} />
        ))}
      </div>
    </div>
  )
}
