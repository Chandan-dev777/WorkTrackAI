import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { useAuthStore } from '@/store/authStore'
import DashboardPage from './DashboardPage'
import type { User } from '@/types/models'

// ── Mock recharts to avoid ResizeObserver/canvas issues in jsdom ──────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Area: () => null, Bar: () => null, Pie: () => null, Cell: () => null,
  XAxis: () => null, YAxis: () => null, CartesianGrid: () => null,
  Tooltip: () => null, Legend: () => null,
}))

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
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useAuthStore.getState().login('mock-token', employeeUser)
})

// ── GREETING ──────────────────────────────────────────────────────────────────

describe('DashboardPage — greeting', () => {
  it("shows user's first name in the page heading", async () => {
    renderPage()
    expect(await screen.findByText(/alice/i)).toBeInTheDocument()
  })
})

// ── METRIC CARDS ──────────────────────────────────────────────────────────────

describe('DashboardPage — metric cards', () => {
  it('renders Total Hours label', async () => {
    renderPage()
    expect(await screen.findByText(/total hours/i)).toBeInTheDocument()
  })

  it('renders In Progress label', async () => {
    renderPage()
    const matches = await screen.findAllByText(/in progress/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders Blocked label', async () => {
    renderPage()
    expect(await screen.findByText(/^blocked$/i)).toBeInTheDocument()
  })

  it('displays total_hours value (42.5) from API', async () => {
    renderPage()
    expect(await screen.findByText('42.5')).toBeInTheDocument()
  })

  it('displays done count (12) from API', async () => {
    renderPage()
    await screen.findByText('42.5')
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})

// ── DATE FILTER ───────────────────────────────────────────────────────────────

describe('DashboardPage — date filter', () => {
  it('date range selector is present', async () => {
    renderPage()
    await screen.findByText(/total hours/i)
    expect(screen.getByRole('combobox', { name: /date range/i })).toBeInTheDocument()
  })

  it('default selection is last_30', async () => {
    renderPage()
    await screen.findByText(/total hours/i)
    expect(screen.getByRole('combobox', { name: /date range/i })).toHaveValue('last_30')
  })

  it('changing to last_7 updates the selector value', async () => {
    renderPage()
    await screen.findByText(/total hours/i)
    const select = screen.getByRole('combobox', { name: /date range/i })
    fireEvent.change(select, { target: { value: 'last_7' } })
    expect(select).toHaveValue('last_7')
  })
})

// ── CHARTS ────────────────────────────────────────────────────────────────────

describe('DashboardPage — charts', () => {
  it('renders Daily Hours Logged section heading', async () => {
    renderPage()
    expect(await screen.findByText(/daily hours logged/i)).toBeInTheDocument()
  })

  it('renders Hours by Category section heading', async () => {
    renderPage()
    expect(await screen.findByText(/hours by category/i)).toBeInTheDocument()
  })

  it('renders Tasks by Status section heading', async () => {
    renderPage()
    expect(await screen.findByText(/tasks by status/i)).toBeInTheDocument()
  })
})

// ── WORK ITEMS TABLE ──────────────────────────────────────────────────────────

describe('DashboardPage — work items table', () => {
  it('shows work item descriptions from API', async () => {
    renderPage()
    expect(await screen.findByText('Fixed auth bug')).toBeInTheDocument()
    expect(screen.getByText('Sprint planning meeting')).toBeInTheDocument()
    expect(screen.getByText('Code review session')).toBeInTheDocument()
  })

  it('search input filters rows by description', async () => {
    renderPage()
    await screen.findByText('Fixed auth bug')
    fireEvent.change(screen.getByRole('textbox', { name: /search/i }), { target: { value: 'sprint' } })
    await waitFor(() => {
      expect(screen.queryByText('Fixed auth bug')).not.toBeInTheDocument()
      expect(screen.getByText('Sprint planning meeting')).toBeInTheDocument()
    })
  })

  it('category filter hides non-matching rows', async () => {
    renderPage()
    await screen.findByText('Fixed auth bug')
    fireEvent.change(screen.getByRole('combobox', { name: /filter by category/i }), { target: { value: 'meeting' } })
    await waitFor(() => {
      expect(screen.queryByText('Fixed auth bug')).not.toBeInTheDocument()
      expect(screen.getByText('Sprint planning meeting')).toBeInTheDocument()
    })
  })

  it('status filter hides non-matching rows', async () => {
    renderPage()
    await screen.findByText('Fixed auth bug')
    fireEvent.change(screen.getByRole('combobox', { name: /filter by status/i }), { target: { value: 'in_progress' } })
    await waitFor(() => {
      expect(screen.queryByText('Fixed auth bug')).not.toBeInTheDocument()
      expect(screen.getByText('Code review session')).toBeInTheDocument()
    })
  })

  it('clicking edit button shows hours spinbutton for inline edit', async () => {
    renderPage()
    await screen.findByText('Fixed auth bug')
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])
    expect(screen.getByRole('spinbutton', { name: /hours/i })).toBeInTheDocument()
  })

  it('cancel button hides the inline edit input', async () => {
    renderPage()
    await screen.findByText('Fixed auth bug')
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])
    expect(screen.getByRole('spinbutton', { name: /hours/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('spinbutton', { name: /hours/i })).not.toBeInTheDocument()
  })

  it('save calls PUT /worklogs/{id} with updated hours', async () => {
    let capturedId: string | undefined
    server.use(
      http.put('/worklogs/:id', ({ params }) => {
        capturedId = params.id as string
        return HttpResponse.json({ id: params.id, hours_spent: 5 })
      })
    )
    renderPage()
    await screen.findByText('Fixed auth bug')
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])
    fireEvent.change(screen.getByRole('spinbutton', { name: /hours/i }), { target: { value: '5' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(capturedId).toBe('wi-001'))
  })

  it('save error shows inline error message', async () => {
    server.use(
      http.put('/worklogs/:id', () => HttpResponse.json({ detail: 'Server error' }, { status: 500 }))
    )
    renderPage()
    await screen.findByText('Fixed auth bug')
    fireEvent.click(screen.getAllByRole('button', { name: /edit/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))
    await waitFor(() => expect(screen.queryByText(/failed|error/i)).toBeInTheDocument())
  })
})

// ── EMPTY STATE ───────────────────────────────────────────────────────────────

describe('DashboardPage — empty state', () => {
  it('renders empty state message when no work items', async () => {
    server.use(http.get('/worklogs/my', () => HttpResponse.json([])))
    renderPage()
    await waitFor(() => {
      expect(screen.queryByText(/no work items|submit your first/i)).toBeInTheDocument()
    })
  })
})
