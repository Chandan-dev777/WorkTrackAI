import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Sparkles, Trash2, AlertTriangle } from 'lucide-react'
import { chatApi } from '@/api/chat'
import { ChatBubble } from '@/components/ai/ChatBubble'
import { TypingIndicator } from '@/components/ai/TypingIndicator'
import { useAuthStore } from '@/store/authStore'
import type { SourceReference } from '@/api/chat'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceReference[]
  isError?: boolean
  created_at: string
  suggestions?: string[]
}

// ── Role-based starter questions ──────────────────────────────────────────────

const QUESTIONS_BY_ROLE: Record<string, string[]> = {
  employee: [
    'Summarize my work this week',
    'What did I work on yesterday?',
    'Show my blocked items',
    'How many hours have I logged this month?',
  ],
  manager: [
    'Who is most blocked on the team?',
    'Team summary for this week',
    'Who hasn\'t submitted recently?',
    'Which employee logged the most hours this month?',
  ],
  admin: [
    'Show extraction error rate',
    'How many users submitted today?',
    'Which categories are most common this week?',
    'Show team workload summary',
  ],
}

// ── Contextual follow-up suggestions ─────────────────────────────────────────

function getSuggestions(question: string, answer: string): string[] {
  const q = question.toLowerCase()
  const a = answer.toLowerCase()

  if (q.includes('block') || a.includes('block'))
    return ['Which items are still unresolved?', 'Show all blocked items', 'Who is blocked longest?']
  if (q.includes('week') || q.includes('hour'))
    return ['Break it down by category', 'How does that compare to last week?', 'Show the daily trend']
  if (q.includes('category') || a.includes('project') || a.includes('meeting'))
    return ['Show hours for each category', 'What was the most common category?', 'Compare categories this month']
  if (q.includes('yesterday') || q.includes('today'))
    return ['What about this week overall?', 'Show items still in progress', 'What was done vs planned?']
  return ['Tell me more', 'Show by category', 'What changed since last week?']
}

// ── Date label helper ─────────────────────────────────────────────────────────

function dateSeparatorLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Confirm Clear dialog ──────────────────────────────────────────────────────

function ConfirmClearDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="rounded-xl p-6 flex flex-col gap-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', maxWidth: 360, width: '90%', boxShadow: '0 16px 48px rgba(0,0,0,0.4)' }}>
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} color="#F59E0B" />
          <p className="font-semibold text-sm" style={{ color: 'var(--color-text-primary)' }}>Clear all history?</p>
        </div>
        <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
          This will hide all previous messages. It cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="rounded-lg px-4 py-2 text-sm"
            style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
            Cancel
          </button>
          <button onClick={onConfirm}
            className="rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: '#F43F5E', color: '#fff' }}>
            Clear
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const user = useAuthStore(s => s.user)
  const role = user?.role ?? 'employee'

  const prefill = (location.state as { prefillQuestion?: string } | null)?.prefillQuestion ?? ''

  const [messages, setMessages]           = useState<Message[]>([])
  const [input, setInput]                 = useState(prefill)
  const [sessionId, setSessionId]         = useState<string | undefined>()
  const [isTyping, setIsTyping]           = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [streamingId, setStreamingId]     = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLTextAreaElement>(null)

  const historyQ = useQuery({
    queryKey: ['chat-history'],
    queryFn: () => chatApi.history(),
  })

  // Load history on mount
  useEffect(() => {
    if (historyQ.data !== undefined && !historyLoaded) {
      const clearedAt = localStorage.getItem('dailyops_chat_cleared_at')
      const visible   = clearedAt
        ? historyQ.data.filter(item => new Date(item.created_at) > new Date(clearedAt))
        : historyQ.data

      const msgs: Message[] = visible.flatMap(item => [
        { id: `${item.id}-q`, role: 'user' as const,      content: item.question, created_at: item.created_at },
        { id: `${item.id}-a`, role: 'assistant' as const, content: item.answer,   sources: [], created_at: item.created_at },
      ])
      setMessages(msgs)
      if (visible.length > 0) setSessionId(visible[visible.length - 1].session_id)
      setHistoryLoaded(true)
    }
  }, [historyQ.data, historyLoaded])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' })
  }, [messages, isTyping])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsTyping(true)

    try {
      const response = await chatApi.query({ question: trimmed, session_id: sessionId })
      setSessionId(response.session_id)
      const aiId = `a-${Date.now()}`
      const aiMsg: Message = {
        id: aiId,
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        created_at: new Date().toISOString(),
        suggestions: getSuggestions(trimmed, response.answer),
      }
      setMessages(prev => [...prev, aiMsg])
      setStreamingId(aiId) // stream the latest response
    } catch {
      const errMsg: Message = {
        id: `e-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        isError: true,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setIsTyping(false)
    }
  }, [sessionId])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function confirmClear() {
    localStorage.setItem('dailyops_chat_cleared_at', new Date().toISOString())
    setMessages([])
    setSessionId(undefined)
    setStreamingId(null)
    queryClient.setQueryData(['chat-history'], [])
    setShowClearDialog(false)
  }

  const starterQuestions = QUESTIONS_BY_ROLE[role] ?? QUESTIONS_BY_ROLE.employee
  const showExamples = historyLoaded && messages.length === 0

  // Group messages by date for separators
  let lastDate = ''

  return (
    <div className="flex flex-col items-center px-4 py-6"
      style={{ height: 'calc(100vh - 56px)', overflow: 'hidden', background: 'var(--color-bg-base)' }}>

      {showClearDialog && (
        <ConfirmClearDialog onConfirm={confirmClear} onCancel={() => setShowClearDialog(false)} />
      )}

      {/* Chat panel */}
      <div className="w-full flex flex-col" style={{ maxWidth: '800px', flex: 1, minHeight: 0 }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 rounded-t-xl flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(6,182,212,0.1))',
            border: '1px solid rgba(139,92,246,0.2)',
            borderBottom: 'none',
          }}>
          <div className="flex items-center gap-3">
            {/* Gradient AI avatar with pulse ring */}
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', color: '#fff', boxShadow: '0 0 0 2px rgba(139,92,246,0.3)' }}>
                <Sparkles size={14} />
              </div>
              {/* Pulsing online dot */}
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                style={{ background: '#10B981', borderColor: 'var(--color-bg-base)', animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>DailyOps AI</p>
              <span className="text-xs" style={{ color: '#10B981' }}>Online</span>
            </div>
          </div>
          <button onClick={() => setShowClearDialog(true)} aria-label="Clear history"
            className="inline-flex items-center gap-1.5 text-xs rounded-md px-3 py-1.5 transition-colors"
            style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)', background: 'var(--color-bg-elevated)', cursor: 'pointer' }}>
            <Trash2 size={12} /> Clear History
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-5 py-4"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid rgba(139,92,246,0.15)',
            borderTop: 'none',
            borderBottom: 'none',
            overscrollBehavior: 'contain',
          }}>

          {/* History loading skeleton */}
          {historyQ.isLoading && (
            <div className="space-y-4 py-2">
              {[1, 2].map(i => (
                <div key={i} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full animate-pulse" style={{ background: 'var(--color-bg-elevated)', flexShrink: 0 }} />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 rounded animate-pulse w-3/4" style={{ background: 'var(--color-bg-elevated)' }} />
                    <div className="h-3 rounded animate-pulse w-1/2" style={{ background: 'var(--color-bg-elevated)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state — role-aware starter questions */}
          {showExamples && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.15))' }}>
                  <Sparkles size={24} color="var(--color-brand-secondary)" />
                </div>
                <p className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>
                  Ask me about your work data
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                  I can answer questions about hours, tasks, trends and more.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                {starterQuestions.map(q => (
                  <button key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left text-xs rounded-lg px-3 py-2.5 transition-colors"
                    style={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                      color: 'var(--color-text-secondary)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand-primary)'; e.currentTarget.style.color = 'var(--color-text-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border-subtle)'; e.currentTarget.style.color = 'var(--color-text-secondary)' }}>
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages with sticky date separators */}
          {messages.map((msg, idx) => {
            const msgDate = dateSeparatorLabel(msg.created_at)
            const showSep = msgDate !== lastDate
            if (showSep) lastDate = msgDate

            const isLastAI = msg.role === 'assistant' && idx === messages.length - 1
            // Use slice up to current index — reliable regardless of ID format
            const lastUserMsg = messages.slice(0, idx).reverse().find(m => m.role === 'user')

            return (
              <div key={msg.id}>
                {/* Date separator */}
                {showSep && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)' }}>
                      {msgDate}
                    </span>
                    <div className="flex-1 h-px" style={{ background: 'var(--color-border-subtle)' }} />
                  </div>
                )}

                <ChatBubble
                  role={msg.role}
                  content={msg.content}
                  sources={msg.sources}
                  isError={msg.isError}
                  stream={isLastAI && msg.id === streamingId}
                  onRetry={msg.role === 'assistant' && lastUserMsg
                    ? () => sendMessage(lastUserMsg.content)
                    : undefined}
                />

                {/* Follow-up suggestion chips */}
                {msg.role === 'assistant' && !msg.isError && isLastAI && msg.suggestions && (
                  <div className="flex flex-wrap gap-2 mb-4 ml-10">
                    {msg.suggestions.map(s => (
                      <button key={s} onClick={() => sendMessage(s)}
                        className="text-xs rounded-full px-3 py-1 transition-all"
                        style={{
                          background: 'rgba(99,102,241,0.08)',
                          border: '1px solid rgba(99,102,241,0.2)',
                          color: 'var(--color-brand-primary)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.15)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}>
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* Typing indicator */}
          {isTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input zone — clear visual boundary from messages */}
        <div className="flex items-end gap-3 px-4 py-3 rounded-b-xl flex-shrink-0"
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid rgba(139,92,246,0.15)',
            borderTop: '1px solid var(--color-border-default)',
          }}>
          <textarea
            ref={inputRef}
            aria-label="Ask about your work"
            placeholder="Ask about your work data… (Enter to send, Shift+Enter for newline)"
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 resize-none rounded-lg px-3 py-2 text-sm"
            style={{
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border-default)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              maxHeight: '120px',
              lineHeight: '1.5',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
            className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all"
            style={{
              background: input.trim() && !isTyping
                ? 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))'
                : 'var(--color-bg-surface)',
              color: input.trim() && !isTyping ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border-default)',
              cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
              opacity: input.trim() && !isTyping ? 1 : 0.5,
            }}
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      {/* Cursor blink keyframe — injected once */}
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  )
}
