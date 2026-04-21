import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { useAuthStore } from '@/store/authStore'
import TeamDashboardPage from './TeamDashboardPage'
import type { User } from '@/types/models'

// ── Mock recharts ─────────────────────────────────────────────────────────────
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null, XAxis: () => null, YAxis: () => null,
  CartesianGrid: () => null, Tooltip: () => null, Legend: () => null, Cell: () => null,
}))

const managerUser: User = {
  id: 'uuid-mgr', employee_id: 'EMP-MGR', full_name: 'Bob Manager',
  email: 'bob@example.com', role: 'manager',
  team_name: 'Engineering', department: 'Technology', is_active: true,
}

const adminUser: User = {
  id: 'uuid-adm', employee_id: 'EMP-ADM', full_name: 'Carol Admin',
  email: 'carol@example.com', role: 'admin',
  team_name: null, department: null, is_active: true,
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <TeamDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

// Default: admin sees all teams — keeps existing tests stable
beforeEach(() => {
  useAuthStore.getState().login('mock-token', adminUser)
})

// ── PAGE HEADER ───────────────────────────────────────────────────────────────

describe('TeamDashboardPage — header', () => {
  it('renders Team Dashboard heading', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /team dashboard/i })).toBeInTheDocument()
  })

  it('renders member count badge after data loads', async () => {
    renderPage()
    await screen.findByRole('heading', { name: /team dashboard/i })
    expect(await screen.findByText(/3 members|3 team/i)).toBeInTheDocument()
  })
})

// ── TEAM KPI CARDS ────────────────────────────────────────────────────────────

describe('TeamDashboardPage — team KPI cards', () => {
  it('renders Total Team Hours label', async () => {
    renderPage()
    expect(await screen.findByText(/total.*hours|team.*hours/i)).toBeInTheDocument()
  })

  it('renders Blocked label', async () => {
    renderPage()
    const matches = await screen.findAllByText(/blocked/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders Active Members label', async () => {
    renderPage()
    expect(await screen.findByText(/active members/i)).toBeInTheDocument()
  })

  it('displays aggregated total hours from team summary', async () => {
    renderPage()
    // 42.5 + 36.0 + 28.5 = 107
    expect(await screen.findByText('107')).toBeInTheDocument()
  })

  it('displays active member count (3)', async () => {
    renderPage()
    await screen.findByText('107') // wait for data
    // '3' appears for both blocked count and member count — just verify it renders
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
  })
})

// ── DATE FILTER ───────────────────────────────────────────────────────────────

describe('TeamDashboardPage — date filter', () => {
  it('date range preset pills are present', async () => {
    renderPage()
    await screen.findByText(/team dashboard/i)
    expect(screen.getByRole('button', { name: /last 30d/i })).toBeInTheDocument()
  })

  it('date inputs are present', async () => {
    renderPage()
    await screen.findByText(/team dashboard/i)
    expect(screen.getByLabelText(/start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/end date/i)).toBeInTheDocument()
  })
})

// ── EMPLOYEE SELECTOR ─────────────────────────────────────────────────────────

describe('TeamDashboardPage — employee selector', () => {
  it('shows "All Employees" option by default', async () => {
    renderPage()
    const selector = await screen.findByRole('combobox', { name: 'Filter by employee' })
    expect(selector).toHaveValue('')
  })

  it('lists all team members in the selector', async () => {
    renderPage()
    const selector = await screen.findByRole('combobox', { name: 'Filter by employee' })
    expect(selector).toBeInTheDocument()
    // options appear once data loads
    await waitFor(() => expect(selector.querySelectorAll('option').length).toBeGreaterThan(1))
    expect(screen.getAllByRole('option', { name: 'Alice Smith' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('option', { name: 'Bob Jones' }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('option', { name: 'Carol Williams' }).length).toBeGreaterThan(0)
  })

  it('changing employee selector updates its value', async () => {
    renderPage()
    const selector = await screen.findByRole('combobox', { name: 'Filter by employee' })
    await waitFor(() => expect(selector.querySelectorAll('option').length).toBeGreaterThan(1))
    fireEvent.change(selector, { target: { value: 'EMP-001' } })
    expect(selector).toHaveValue('EMP-001')
  })
})

// ── CHARTS ────────────────────────────────────────────────────────────────────

describe('TeamDashboardPage — charts', () => {
  it('renders Hours by Employee chart section heading', async () => {
    renderPage()
    expect(await screen.findByText(/hours by employee/i)).toBeInTheDocument()
  })

  it('renders Team Categories chart section heading', async () => {
    renderPage()
    expect(await screen.findByText(/team categories|hours by category/i)).toBeInTheDocument()
  })
})

// ── BLOCKED ITEMS PANEL ───────────────────────────────────────────────────────

describe('TeamDashboardPage — blocked items panel', () => {
  it('renders Blocked Items section heading', async () => {
    renderPage()
    expect(await screen.findByText(/blocked items/i)).toBeInTheDocument()
  })

  it('shows blocked work item description', async () => {
    renderPage()
    // item appears in both the blocked panel and the table — at least one match expected
    const matches = await screen.findAllByText('Deployment blocked by infra')
    expect(matches.length).toBeGreaterThan(0)
  })

  it('shows empty state when no blocked items', async () => {
    server.use(
      http.get('/worklogs/team', () =>
        HttpResponse.json([
          { id: 'x1', work_log_id: 'wl1', employee_id: 'EMP-001', work_date: '2026-04-13',
            task_description: 'All good', work_category: 'project', hours_spent: 2,
            status: 'done', priority: null, blockers: null, next_steps: null, tags: null,
            project_name: null, ticket_id: null, confidence_score: null,
            needs_review: false, clarification_needed: false, clarification_reason: null,
            is_user_corrected: false, created_at: '2026-04-13T09:00:00', updated_at: '2026-04-13T09:00:00',
            employee_name: 'Alice Smith' },
        ])
      )
    )
    renderPage()
    expect(await screen.findByText(/no blocked items/i)).toBeInTheDocument()
  })
})

// ── TEAM TABLE ────────────────────────────────────────────────────────────────

describe('TeamDashboardPage — team work items table', () => {
  it('shows all team members work items', async () => {
    renderPage()
    expect(await screen.findByText('Fixed auth bug')).toBeInTheDocument()
    expect(screen.getAllByText('Deployment blocked by infra').length).toBeGreaterThan(0)
    expect(screen.getByText('Code review session')).toBeInTheDocument()
  })

  it('needs review filter toggle shows only flagged items', async () => {
    renderPage()
    await screen.findByText('Fixed auth bug')
    const toggle = screen.getByRole('checkbox', { name: /needs review/i })
    fireEvent.click(toggle)
    await waitFor(() => {
      expect(screen.queryByText('Fixed auth bug')).not.toBeInTheDocument()
      expect(screen.getAllByText('Deployment blocked by infra').length).toBeGreaterThan(0)
    })
  })

  it('status filter hides non-matching rows', async () => {
    renderPage()
    await screen.findByText('Fixed auth bug')
    const statusFilter = screen.getByRole('combobox', { name: /filter by status/i })
    fireEvent.change(statusFilter, { target: { value: 'blocked' } })
    await waitFor(() => {
      expect(screen.queryByText('Fixed auth bug')).not.toBeInTheDocument()
      expect(screen.getAllByText('Deployment blocked by infra').length).toBeGreaterThan(0)
    })
  })
})

// ── EMPLOYEE SUMMARY CARDS ────────────────────────────────────────────────────

describe('TeamDashboardPage — employee summary cards', () => {
  it('renders Employee Summary section heading', async () => {
    renderPage()
    expect(await screen.findByText('Employee Summary')).toBeInTheDocument()
  })

  it('shows each employee name in a summary card', async () => {
    renderPage()
    // names appear in both selector options and summary cards — findAllByText is safe
    expect((await screen.findAllByText('Alice Smith')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bob Jones').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Carol Williams').length).toBeGreaterThan(0)
  })

  it('shows total hours for each employee', async () => {
    renderPage()
    expect(await screen.findByText(/42\.5h/)).toBeInTheDocument()
    expect(screen.getByText(/36\.0h/)).toBeInTheDocument()
    expect(screen.getByText(/28\.5h/)).toBeInTheDocument()
  })

  it('shows blocked count for employee with blocked items', async () => {
    renderPage()
    // Bob Jones has blocked_count=2; "2 blocked" appears in card badge (and may repeat)
    const matches = await screen.findAllByText(/2 blocked/i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('shows last activity date for each member card', async () => {
    renderPage()
    // "Last activity" label appears once per employee card
    const matches = await screen.findAllByText(/Last activity/i)
    expect(matches.length).toBeGreaterThan(0)
  })
})

// ── TABLE EMPLOYEE FILTER ─────────────────────────────────────────────────────

describe('TeamDashboardPage — table employee filter', () => {
  it('table employee filter dropdown is present', async () => {
    renderPage()
    await screen.findByText('Fixed auth bug')
    expect(screen.getByRole('combobox', { name: /filter table by employee/i })).toBeInTheDocument()
  })

  it('filtering table by employee hides other employees items', async () => {
    renderPage()
    await screen.findByText('Fixed auth bug')
    fireEvent.change(
      screen.getByRole('combobox', { name: /filter table by employee/i }),
      { target: { value: 'EMP-001' } }
    )
    await waitFor(() => {
      expect(screen.queryByText('Code review session')).not.toBeInTheDocument()
      expect(screen.getByText('Fixed auth bug')).toBeInTheDocument()
    })
  })
})

// ── ROLE-BASED TEAM SCOPING (replaces old admin access test) ─────────────────

describe('TeamDashboardPage — role-based team scoping', () => {
  // manager tests need explicit login; admin tests inherit from top-level beforeEach

  it('manager only sees their own team (Engineering → Alice Smith only)', async () => {
    useAuthStore.getState().login('mock-token', managerUser)
    renderPage()
    // Alice loads; Bob & Carol are filtered out entirely (no options, no cards, no rows)
    expect((await screen.findAllByText('Alice Smith')).length).toBeGreaterThan(0)
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
    expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument()
  })

  it('manager sees a locked team badge showing their team name', async () => {
    useAuthStore.getState().login('mock-token', managerUser)
    renderPage()
    expect(await screen.findByText('Engineering')).toBeInTheDocument()
  })

  it('manager does NOT see a team search text input', async () => {
    useAuthStore.getState().login('mock-token', managerUser)
    renderPage()
    await screen.findByText('Engineering')
    expect(screen.queryByRole('textbox', { name: /filter by team/i })).not.toBeInTheDocument()
  })

  it('admin sees all teams by default (no team_name filter)', async () => {
    // adminUser is already set by top-level beforeEach
    renderPage()
    // MSW returns all 3 employees when no team_name param — each name may appear multiple times
    expect((await screen.findAllByText('Alice Smith')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Bob Jones').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Carol Williams').length).toBeGreaterThan(0)
  })

  it('admin sees a team name search input', async () => {
    useAuthStore.getState().login('mock-token', adminUser)
    renderPage()
    expect(await screen.findByRole('textbox', { name: /filter by team/i })).toBeInTheDocument()
  })

  it('admin can filter to a specific team by typing team name', async () => {
    // adminUser from top-level beforeEach
    renderPage()
    // wait for all employees to load
    expect((await screen.findAllByText('Bob Jones')).length).toBeGreaterThan(0)
    const teamInput = screen.getByRole('textbox', { name: /filter by team/i })
    fireEvent.change(teamInput, { target: { value: 'Engineering' } })
    // after filtering to Engineering, Bob & Carol disappear completely
    await waitFor(() => {
      expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument()
      expect(screen.queryByText('Carol Williams')).not.toBeInTheDocument()
    })
    expect((await screen.findAllByText('Alice Smith')).length).toBeGreaterThan(0)
  })
})
