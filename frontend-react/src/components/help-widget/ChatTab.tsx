import { useState, useRef, useEffect, useCallback, useId } from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { streamAssistantChat } from '@/api/assistant'
import { Message } from './Message'
import { QuickActions } from './QuickActions'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from '@/components/ai/TypingIndicator'
import type { HelpMessage } from '@/types/models'

const PAGE_NAMES: Record<string, string> = {
  '/dashboard': 'My Dashboard',
  '/submit': 'Submit Work Update',
  '/team': 'Team Dashboard',
  '/chat': 'Chat Assistant',
  '/admin': 'Admin Panel',
  '/settings': 'Settings',
}

function usePageContext(): string {
  const { pathname } = useLocation()
  for (const [path, name] of Object.entries(PAGE_NAMES)) {
    if (pathname.startsWith(path)) return name
  }
  return ''
}

interface ChatTabProps {
  messages: HelpMessage[]
  setMessages: React.Dispatch<React.SetStateAction<HelpMessage[]>>
}

export function ChatTab({ messages, setMessages }: ChatTabProps) {
  // sessionId is stable for the widget's lifetime — persists across open/close
  const sessionId = useId().replace(/:/g, '')
  const pageContext = usePageContext()
  const queryClient = useQueryClient()

  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    setInput('')

    const userMsg: HelpMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    }

    // Capture history snapshot BEFORE adding the new user message
    const historySnapshot = [...messages]

    setMessages((prev) => [...prev, userMsg])
    setIsStreaming(true)

    const assistantId = `assistant-${Date.now()}`
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    try {
      for await (const chunk of streamAssistantChat(trimmed, sessionId, historySnapshot, pageContext)) {
        if (chunk.done) break

        if (chunk.tool_call) {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, toolCall: chunk.tool_call } : m)
          )
          queryClient.invalidateQueries({ queryKey: ['assistant-notes'] })
        }

        if (chunk.text) {
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + chunk.text } : m)
          )
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.', isError: true }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }, [isStreaming, messages, sessionId, pageContext, queryClient, setMessages])

  const handleQuickAction = (msg: string, send: boolean) => {
    if (send) sendMessage(msg)
    else setInput(msg)
  }

  const showQuickActions = messages.length <= 1 && !isStreaming

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.map((msg) =>
          msg.content || msg.toolCall ? <Message key={msg.id} message={msg} /> : null
        )}
        {isStreaming && !messages[messages.length - 1]?.content && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {showQuickActions && (
        <div style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
          <QuickActions onAction={handleQuickAction} />
        </div>
      )}

      <MessageInput
        value={input}
        onChange={setInput}
        onSend={() => sendMessage(input)}
        disabled={isStreaming}
      />
    </div>
  )
}
