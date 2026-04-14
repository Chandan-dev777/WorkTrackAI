import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { useAuthStore } from '@/store/authStore'
import ChatPage from './ChatPage'
import type { User } from '@/types/models'

const employeeUser: User = {
  id: 'uuid-alice', employee_id: 'EMP-001', full_name: 'Alice Smith',
  email: 'alice@example.com', role: 'employee',
  team_name: 'Engineering', department: 'Technology', is_active: true,
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <ChatPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useAuthStore.getState().login('mock-token', employeeUser)
})

// ── LAYOUT ────────────────────────────────────────────────────────────────────

describe('ChatPage — layout', () => {
  it('renders WorkTrack AI header title', async () => {
    renderPage()
    expect(await screen.findByText('WorkTrack AI')).toBeInTheDocument()
  })

  it('renders Online badge in header', async () => {
    renderPage()
    expect(await screen.findByText(/online/i)).toBeInTheDocument()
  })

  it('renders Clear History button', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: /clear history/i })).toBeInTheDocument()
  })

  it('renders the message input textarea', async () => {
    renderPage()
    expect(await screen.findByRole('textbox', { name: /ask|message/i })).toBeInTheDocument()
  })

  it('send button is disabled when input is empty', async () => {
    renderPage()
    await screen.findByRole('textbox', { name: /ask|message/i })
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled()
  })

  it('send button is enabled when input has text', async () => {
    renderPage()
    const input = await screen.findByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'Hello' } })
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled()
  })
})

// ── CHAT HISTORY ──────────────────────────────────────────────────────────────

describe('ChatPage — chat history', () => {
  it('loads and displays previous user question from history', async () => {
    renderPage()
    expect(await screen.findByText('How many hours did I log last week?')).toBeInTheDocument()
  })

  it('loads and displays previous AI answer from history', async () => {
    renderPage()
    expect(await screen.findByText('You logged 32.5 hours last week across 14 work items.')).toBeInTheDocument()
  })

  it('shows example question buttons when history is empty', async () => {
    server.use(http.get('/chat/history', () => HttpResponse.json([])))
    renderPage()
    // multiple example buttons may appear — check at least one exists
    const btns = await screen.findAllByRole('button', { name: /how many hours|what categories|blocked|summarize/i })
    expect(btns.length).toBeGreaterThan(0)
  })
})

// ── SENDING MESSAGES ──────────────────────────────────────────────────────────

describe('ChatPage — sending messages', () => {
  it('user message appears immediately after send (optimistic)', async () => {
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'What did I work on today?' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(screen.getByText('What did I work on today?')).toBeInTheDocument()
  })

  it('input is cleared after sending', async () => {
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'Test question' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(input).toHaveValue('')
  })

  it('AI response appears after send', async () => {
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'What did I work on today?' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText(/here is the answer to/i)).toBeInTheDocument()
  })

  it('pressing Enter sends the message', async () => {
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'Enter key test' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(screen.getByText('Enter key test')).toBeInTheDocument()
  })

  it('Shift+Enter does NOT send the message', async () => {
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'Shift enter test' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', shiftKey: true })
    // Input should still have the value (not sent)
    expect(input).toHaveValue('Shift enter test')
  })
})

// ── TYPING INDICATOR ──────────────────────────────────────────────────────────

describe('ChatPage — typing indicator', () => {
  it('typing indicator appears while waiting for AI response', async () => {
    server.use(
      http.post('/chat/query', async () => {
        await new Promise(resolve => setTimeout(resolve, 200))
        return HttpResponse.json({ answer: 'Delayed answer', query_source: 'sql', session_id: 'sess-001', sources: [] })
      })
    )
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'Will this show typing?' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByLabelText(/is typing/i)).toBeInTheDocument()
  })

  it('typing indicator disappears when AI response arrives', async () => {
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'Quick question' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    await screen.findByText(/here is the answer to/i)
    expect(screen.queryByLabelText(/is typing/i)).not.toBeInTheDocument()
  })
})

// ── SOURCE CHIPS ──────────────────────────────────────────────────────────────

describe('ChatPage — source chips', () => {
  it('source chips appear when API returns sources', async () => {
    server.use(
      http.post('/chat/query', () =>
        HttpResponse.json({
          answer: 'Based on your work logs...',
          query_source: 'vector',
          session_id: 'sess-001',
          sources: [
            { work_item_id: 'wi-001', work_date: '2026-04-13', task_description: 'Fixed auth bug', work_category: 'project', employee_id: 'EMP-001' },
          ],
        })
      )
    )
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'Show me sources' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByLabelText(/sources/i)).toBeInTheDocument()
  })
})

// ── ERROR STATE ───────────────────────────────────────────────────────────────

describe('ChatPage — error state', () => {
  it('shows error message when API call fails', async () => {
    server.use(
      http.post('/chat/query', () => HttpResponse.json({ detail: 'Error' }, { status: 500 }))
    )
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.change(input, { target: { value: 'This will fail' } })
    fireEvent.click(screen.getByRole('button', { name: /send/i }))
    expect(await screen.findByText(/error|sorry|failed/i)).toBeInTheDocument()
  })
})

// ── EXAMPLE QUESTIONS ─────────────────────────────────────────────────────────

describe('ChatPage — example questions', () => {
  it('clicking an example button fills the input', async () => {
    server.use(http.get('/chat/history', () => HttpResponse.json([])))
    renderPage()
    const btns = await screen.findAllByRole('button', { name: /how many hours|what categories|blocked|summarize/i })
    const input = screen.getByRole('textbox', { name: /ask|message/i })
    fireEvent.click(btns[0])
    expect(input).not.toHaveValue('')
  })
})

// ── CLEAR HISTORY ─────────────────────────────────────────────────────────────

describe('ChatPage — clear history', () => {
  it('clear history button removes all messages from view', async () => {
    renderPage()
    await screen.findByText('How many hours did I log last week?')
    fireEvent.click(screen.getByRole('button', { name: /clear history/i }))
    await waitFor(() => {
      expect(screen.queryByText('How many hours did I log last week?')).not.toBeInTheDocument()
    })
  })
})
