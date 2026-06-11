import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Bug, Lightbulb, MessageSquare, Send, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { assistantApi } from '@/api/assistant'
import { useUIStore } from '@/store/uiStore'
import type { NoteType } from '@/types/models'

// ── Page label map ────────────────────────────────────────────────────────────

const PAGE_LABELS: Record<string, string> = {
  '/dashboard':    'Home Dashboard',
  '/my-dashboard': 'My Analytics',
  '/submit':       'Submit Update',
  '/tasks':        'Tasks & Projects',
  '/team':         'Team Dashboard',
  '/chat':         'Chat Assistant',
  '/admin':        'Admin Panel',
  '/settings':     'Settings',
  '/org':          'Org Chart',
}

function usePageLabel(): string {
  const { pathname } = useLocation()
  for (const [path, label] of Object.entries(PAGE_LABELS)) {
    if (pathname.startsWith(path)) return label
  }
  return 'App'
}

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_OPTIONS: Array<{
  value: NoteType
  label: string
  icon: React.ElementType
  color: string
  bg: string
  border: string
  placeholder: string
}> = [
  {
    value: 'feedback',
    label: 'General Feedback',
    icon: MessageSquare,
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.1)',
    border: 'rgba(99,102,241,0.35)',
    placeholder: "What's working well or could be improved?",
  },
  {
    value: 'bug',
    label: 'Bug Report',
    icon: Bug,
    color: '#F43F5E',
    bg: 'rgba(244,63,94,0.1)',
    border: 'rgba(244,63,94,0.35)',
    placeholder: 'What happened? What did you expect to happen?',
  },
  {
    value: 'requirement',
    label: 'Feature Request',
    icon: Lightbulb,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.1)',
    border: 'rgba(245,158,11,0.35)',
    placeholder: "Describe the feature or improvement you'd like to see.",
  },
]

// ── Modal ─────────────────────────────────────────────────────────────────────

export function FeedbackModal() {
  const { feedbackOpen, feedbackType, feedbackPrefill, closeFeedback } = useUIStore()
  const pageLabel = usePageLabel()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [type, setType]         = useState<NoteType>(feedbackType)
  const [body, setBody]         = useState(feedbackPrefill)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)

  // Sync type/prefill when modal opens
  useEffect(() => {
    if (feedbackOpen) {
      setType(feedbackType)
      setBody(feedbackPrefill)
      setSubmitted(false)
      setTimeout(() => textareaRef.current?.focus(), 120)
    }
  }, [feedbackOpen, feedbackType, feedbackPrefill])

  const selected = TYPE_OPTIONS.find(o => o.value === type) ?? TYPE_OPTIONS[0]

  async function handleSubmit() {
    if (!body.trim()) return
    setSubmitting(true)
    try {
      await assistantApi.createNote({
        type,
        title: `${selected.label} — ${pageLabel}`,
        body: body.trim(),
        priority: type === 'bug' ? 'medium' : 'low',
        affected_page: pageLabel,
      })
      setSubmitted(true)
      toast.success('Feedback saved — thank you!')
      setTimeout(closeFeedback, 1400)
    } catch {
      toast.error('Could not save feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') closeFeedback()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
  }

  return (
    <AnimatePresence>
      {feedbackOpen && (
        <motion.div
          key="feedback-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
          onClick={closeFeedback}
        >
          <motion.div
            key="feedback-panel"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            style={{
              width: '100%', maxWidth: 480,
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              borderRadius: 16,
              boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
              overflow: 'hidden',
            }}
            onClick={e => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border-subtle)',
            }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)', margin: 0 }}>
                  Share Feedback
                </p>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                  {pageLabel}
                </p>
              </div>
              <button
                onClick={closeFeedback}
                style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 0, padding: 4 }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            {submitted ? (
              /* ── Success state ── */
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <CheckCircle size={40} color="#10B981" style={{ margin: '0 auto 12px' }} />
                <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 6px' }}>
                  Thanks for the feedback!
                </p>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                  It's been saved and the team will review it.
                </p>
              </div>
            ) : (
              /* ── Form ── */
              <div style={{ padding: '20px' }}>

                {/* Type selector */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {TYPE_OPTIONS.map(opt => {
                    const Icon = opt.icon
                    const active = type === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setType(opt.value)}
                        style={{
                          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                          gap: 6, padding: '10px 8px', borderRadius: 10, cursor: 'pointer',
                          border: `1px solid ${active ? opt.border : 'var(--color-border-subtle)'}`,
                          background: active ? opt.bg : 'var(--color-bg-elevated)',
                          transition: 'all 0.12s',
                        }}
                      >
                        <Icon size={16} color={active ? opt.color : 'var(--color-text-muted)'} />
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: active ? opt.color : 'var(--color-text-muted)',
                          textAlign: 'center', lineHeight: 1.2,
                        }}>
                          {opt.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Description */}
                <textarea
                  ref={textareaRef}
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  placeholder={selected.placeholder}
                  rows={4}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    resize: 'vertical', minHeight: 100,
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--color-bg-elevated)',
                    border: `1px solid var(--color-border-default)`,
                    color: 'var(--color-text-primary)',
                    fontSize: 13, lineHeight: 1.6, outline: 'none',
                    fontFamily: 'inherit',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = selected.color)}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--color-border-default)')}
                />

                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '6px 0 16px', textAlign: 'right' }}>
                  ⌘↵ to submit
                </p>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={closeFeedback}
                    style={{
                      flex: 1, padding: '10px 0', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid var(--color-border-default)',
                      background: 'none', color: 'var(--color-text-secondary)', fontSize: 13, fontWeight: 500,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!body.trim() || submitting}
                    style={{
                      flex: 2, padding: '10px 0', borderRadius: 8, cursor: body.trim() ? 'pointer' : 'not-allowed',
                      border: 'none',
                      background: body.trim() && !submitting ? selected.color : 'var(--color-bg-elevated)',
                      color: body.trim() && !submitting ? '#fff' : 'var(--color-text-muted)',
                      fontSize: 13, fontWeight: 600,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 0.12s',
                      opacity: submitting ? 0.7 : 1,
                    }}
                  >
                    <Send size={13} />
                    {submitting ? 'Sending…' : 'Send Feedback'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
