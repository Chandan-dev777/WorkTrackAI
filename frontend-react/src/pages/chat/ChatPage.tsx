import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import { chatApi } from '@/api/chat'
import { ChatBubble } from '@/components/ai/ChatBubble'
import { TypingIndicator } from '@/components/ai/TypingIndicator'
import type { SourceReference } from '@/api/chat'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: SourceReference[]
  isError?: boolean
  created_at: string
}

const EXAMPLE_QUESTIONS = [
  'How many hours did I log last week?',
  'What categories did I work on this month?',
  'Were there any blocked tasks this week?',
  'Summarize my work from yesterday',
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const queryClient = useQueryClient()
  const location = useLocation()

  // Support pre-filled question from AskAiButton navigation
  const prefill = (location.state as { prefillQuestion?: string } | null)?.prefillQuestion ?? ''

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState(prefill)
  const [sessionId, setSessionId] = useState<string | undefined>()
  const [isTyping, setIsTyping] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load history on mount
  const historyQ = useQuery({
    queryKey: ['chat-history'],
    queryFn: () => chatApi.history(),
  })

  useEffect(() => {
    if (historyQ.data !== undefined && !historyLoaded) {
      // Filter out items created before the last clear (persists across refreshes)
      const clearedAt = localStorage.getItem('worktrack_chat_cleared_at')
      const visible = clearedAt
        ? historyQ.data.filter(item => new Date(item.created_at) > new Date(clearedAt))
        : historyQ.data

      const msgs: Message[] = visible.flatMap(item => [
        { id: `${item.id}-q`, role: 'user' as const, content: item.question, created_at: item.created_at },
        { id: `${item.id}-a`, role: 'assistant' as const, content: item.answer, sources: [], created_at: item.created_at },
      ])
      setMessages(msgs)
      if (visible.length > 0) {
        setSessionId(visible[visible.length - 1].session_id)
      }
      setHistoryLoaded(true)
    }
  }, [historyQ.data, historyLoaded])

  // Auto-scroll to bottom
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
      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev, aiMsg])
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

  function clearHistory() {
    // Persist cleared_at so filtering survives full page refreshes
    localStorage.setItem('worktrack_chat_cleared_at', new Date().toISOString())
    setMessages([])
    setSessionId(undefined)
    queryClient.setQueryData(['chat-history'], [])
  }

  const showExamples = historyLoaded && messages.length === 0

  return (
    <div className="flex flex-col items-center px-4 py-6"
      style={{ minHeight: 'calc(100vh - 56px)', background: 'var(--color-bg-base)' }}>

      {/* Chat Panel */}
      <div className="w-full flex flex-col" style={{ maxWidth: '800px', height: 'calc(100vh - 100px)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 rounded-t-xl flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(6,182,212,0.1))',
            border: '1px solid rgba(139,92,246,0.2)',
            borderBottom: 'none',
          }}>
          <div className="flex items-center gap-3">
            {/* Animated AI avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #8B5CF6, #06B6D4)',
                color: '#fff',
                boxShadow: '0 0 0 2px rgba(139,92,246,0.3)',
              }}>
              <Sparkles size={14} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                WorkTrack AI
              </p>
              <span className="inline-flex items-center gap-1 text-xs"
                style={{ color: '#10B981' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                Online
              </span>
            </div>
          </div>
          <button onClick={clearHistory} aria-label="Clear history"
            className="inline-flex items-center gap-1.5 text-xs rounded-md px-3 py-1.5 transition-colors"
            style={{ color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-default)' }}>
            <Trash2 size={12} />
            Clear History
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-5 py-4"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid rgba(139,92,246,0.15)',
            borderTop: 'none',
            borderBottom: 'none',
          }}>

          {/* Loading skeleton */}
          {historyQ.isLoading && (
            <div className="space-y-4 py-2">
              {[1, 2].map(i => (
                <div key={i} className="flex gap-3">
                  <div className="w-6 h-6 rounded-full animate-pulse" style={{ background: 'var(--color-bg-elevated)', flexShrink: 0 }} />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 rounded animate-pulse w-3/4" style={{ background: 'var(--color-bg-elevated)' }} />
                    <div className="h-3 rounded animate-pulse w-1/2" style={{ background: 'var(--color-bg-elevated)' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state with example questions */}
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
                {EXAMPLE_QUESTIONS.map(q => (
                  <button key={q} onClick={() => { setInput(q); inputRef.current?.focus() }}
                    className="text-left text-xs rounded-lg px-3 py-2.5 transition-colors"
                    style={{
                      background: 'var(--color-bg-elevated)',
                      border: '1px solid var(--color-border-subtle)',
                      color: 'var(--color-text-secondary)',
                    }}>
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map(msg => (
            <ChatBubble
              key={msg.id}
              role={msg.role}
              content={msg.content}
              sources={msg.sources}
              isError={msg.isError}
            />
          ))}

          {/* Typing indicator */}
          {isTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input zone */}
        <div className="flex items-end gap-3 px-4 py-3 rounded-b-xl flex-shrink-0"
          style={{
            background: 'var(--color-bg-surface)',
            border: '1px solid rgba(139,92,246,0.15)',
            borderTop: '1px solid var(--color-border-subtle)',
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
              background: 'var(--color-bg-elevated)',
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
                : 'var(--color-bg-elevated)',
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
    </div>
  )
}
