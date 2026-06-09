import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  Tooltip: () => null, Legend: () => null, ReferenceDot: () => null,
  Customized: () => null,
}))

const employeeUser: User = {
  id: 'uuid-alice', employee_id: 'EMP-001', full_name: 'Alice Smith',
  email: 'alice@example.com', role: 'employee',
  team_name: 'Engineering', department: 'Technology', is_active: true, has_password: true, onboarding_complete: true, manager_id: null,
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
    const blocked = await screen.findAllByText(/^blocked$/i)
    expect(blocked.length).toBeGreaterThan(0)
  })

  it('displays total_hours value (42.5) from API', async () => {
    renderPage()
    expect(await screen.findByText('42.5')).toBeInTheDocument()
  })

  it('displays done count (12) from API', async () => {
    renderPage()
    await screen.findByText('42.5')
    expect(screen.getAllByText('12').length).toBeGreaterThan(0)
  })
})

// ── DATE FILTER ───────────────────────────────────────────────────────────────

describe('DashboardPage — date filter', () => {
  it('preset pills are present', async () => {
    renderPage()
    await screen.findByText(/total hours/i)
    expect(screen.getByRole('button', { name: /last 7d/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /last 30d/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /last 90d/i })).toBeInTheDocument()
  })

  it('custom date inputs are present', async () => {
    renderPage()
    await screen.findByText(/total hours/i)
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
  })

  it('clicking last 7d pill changes start date input', async () => {
    renderPage()
    await screen.findByText(/total hours/i)
    fireEvent.click(screen.getByRole('button', { name: /last 7d/i }))
    const startInput = screen.getByLabelText(/start date/i) as HTMLInputElement
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    expect(startInput.value).toBe(sevenDaysAgo.toISOString().split('T')[0])
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

// ── NAVIGATION STRIP ─────────────────────────────────────────────────────────

describe('DashboardPage — navigation strip', () => {
  it('renders Manage Tasks link to /tasks', async () => {
    renderPage()
    await screen.findByText(/total hours/i)
    const link = screen.getByRole('link', { name: /manage tasks/i })
    expect(link).toHaveAttribute('href', '/tasks')
  })

  it('renders View Projects link to /projects', async () => {
    renderPage()
    await screen.findByText(/total hours/i)
    const link = screen.getByRole('link', { name: /view projects/i })
    expect(link).toHaveAttribute('href', '/projects')
  })

  it('no work items table present (moved to Tasks page)', async () => {
    renderPage()
    await screen.findByText(/total hours/i)
    expect(screen.queryByRole('table', { name: /work items/i })).not.toBeInTheDocument()
  })
})
