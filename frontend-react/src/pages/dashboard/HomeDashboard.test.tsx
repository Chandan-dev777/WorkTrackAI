import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { useAuthStore } from '@/store/authStore'
import HomeDashboard from './HomeDashboard'
import type { User } from '@/types/models'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null,
}))

const employeeUser: User = {
  id: 'uuid-alice', employee_id: 'EMP-001', full_name: 'Alice Smith',
  email: 'alice@example.com', role: 'employee',
  team_name: 'Engineering', department: 'Technology', is_active: true,
}

const managerUser: User = {
  id: 'uuid-mgr', employee_id: 'EMP-MGR', full_name: 'Bob Manager',
  email: 'bob@example.com', role: 'manager',
  team_name: 'Engineering', department: 'Technology', is_active: true,
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <HomeDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  useAuthStore.getState().login('mock-token', employeeUser)
})

// ── GREETING ──────────────────────────────────────────────────────────────────

describe('HomeDashboard — greeting', () => {
  it("shows user's first name", async () => {
    renderPage()
    expect(await screen.findByText(/alice/i)).toBeInTheDocument()
  })

  it('shows today\'s date', async () => {
    renderPage()
    await screen.findByText(/alice/i)
    // current month/year should be visible somewhere
    const year = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument()
  })
})

// ── QUICK STATS ───────────────────────────────────────────────────────────────

describe('HomeDashboard — quick stats', () => {
  it('shows hours this week stat', async () => {
    renderPage()
    expect(await screen.findByText(/hours.*week|this week/i)).toBeInTheDocument()
  })

  it('displays total hours value from API', async () => {
    renderPage()
    expect(await screen.findByText('42.5')).toBeInTheDocument()
  })

  it('shows done tasks count', async () => {
    renderPage()
    await screen.findByText('42.5')
    expect(screen.getByText('12')).toBeInTheDocument()
  })
})

// ── QUICK ACTIONS ─────────────────────────────────────────────────────────────

describe('HomeDashboard — quick actions', () => {
  it('renders Submit Update action', async () => {
    renderPage()
    await screen.findByText(/alice/i)
    expect(screen.getByRole('link', { name: /submit.*update/i })).toBeInTheDocument()
  })

  it('renders Chat Assistant action', async () => {
    renderPage()
    await screen.findByText(/alice/i)
    expect(screen.getByRole('link', { name: /chat.*assistant|ask ai/i })).toBeInTheDocument()
  })

  it('renders My Dashboard action', async () => {
    renderPage()
    await screen.findByText(/alice/i)
    expect(screen.getByRole('link', { name: /my dashboard/i })).toBeInTheDocument()
  })

  it('does NOT show Team Dashboard action for employees', async () => {
    renderPage()
    await screen.findByText(/alice/i)
    expect(screen.queryByRole('link', { name: /team dashboard/i })).not.toBeInTheDocument()
  })

  it('shows Team Dashboard action for managers', async () => {
    useAuthStore.getState().login('mock-token', managerUser)
    renderPage()
    await screen.findByText(/bob/i)
    expect(screen.getByRole('link', { name: /team dashboard/i })).toBeInTheDocument()
  })
})

// ── RECENT WORK ───────────────────────────────────────────────────────────────

describe('HomeDashboard — recent work items', () => {
  it('renders Recent Work section heading', async () => {
    renderPage()
    expect(await screen.findByText(/recent work/i)).toBeInTheDocument()
  })

  it('shows recent work item descriptions', async () => {
    renderPage()
    expect(await screen.findByText('Fixed auth bug')).toBeInTheDocument()
  })

  it('shows empty state when no work items exist', async () => {
    server.use(http.get('/worklogs/my', () => HttpResponse.json([])))
    renderPage()
    await waitFor(() => {
      expect(screen.queryByText(/no recent work items/i)).toBeInTheDocument()
    })
  })
})
