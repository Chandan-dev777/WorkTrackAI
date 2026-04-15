import { apiClient } from './client'
import { useAuthStore } from '@/store/authStore'
import type { AssistantNote, HelpMessage, NoteCreate, NoteUpdate } from '@/types/models'

// ── Note CRUD ─────────────────────────────────────────────────────────────────

export const assistantApi = {
  createNote: async (payload: NoteCreate): Promise<AssistantNote> => {
    const { data } = await apiClient.post<AssistantNote>('/assistant/notes', payload)
    return data
  },

  listNotes: async (params?: { type?: string; status?: string }): Promise<AssistantNote[]> => {
    const { data } = await apiClient.get<AssistantNote[]>('/assistant/notes', { params })
    return data
  },

  updateNote: async (id: string, payload: NoteUpdate): Promise<AssistantNote> => {
    const { data } = await apiClient.patch<AssistantNote>(`/assistant/notes/${id}`, payload)
    return data
  },

  deleteNote: async (id: string): Promise<void> => {
    await apiClient.delete(`/assistant/notes/${id}`)
  },
}

// ── SSE streaming chat ────────────────────────────────────────────────────────
// Uses POST so conversation history can be sent in the body.
// Can't use EventSource (no custom headers) — use fetch + ReadableStream.

export interface StreamChunk {
  text?: string
  tool_call?: string
  done?: boolean
}

// Only user/assistant turns (no toolCall or welcome) serialised for the backend
function toHistoryEntries(messages: HelpMessage[]) {
  return messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && m.content && m.id !== 'welcome')
    .map((m) => ({ role: m.role, content: m.content }))
}

export async function* streamAssistantChat(
  message: string,
  sessionId: string,
  history: HelpMessage[],
  pageContext?: string
): AsyncGenerator<StreamChunk> {
  const token = useAuthStore.getState().token

  const body = {
    message,
    session_id: sessionId,
    page_context: pageContext ?? null,
    history: toHistoryEntries(history),
  }

  const response = await fetch('/assistant/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok || !response.body) {
    yield { text: 'Sorry, I could not connect to the assistant. Please try again.', done: true }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw) continue
        try {
          const chunk: StreamChunk = JSON.parse(raw)
          yield chunk
          if (chunk.done) return
        } catch {
          // malformed chunk — skip
        }
      }
    }
  } finally {
    reader.cancel()
  }
}
