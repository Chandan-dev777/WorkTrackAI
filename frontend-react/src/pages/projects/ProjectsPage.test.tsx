import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/api/worklogs', () => ({
  worklogsApi: {
    getMy: vi.fn().mockResolvedValue([
      {
        id: 'item-1', work_log_id: 'wl-1', employee_id: 'e1',
        work_date: '2026-05-15', task_description: 'CI/CD fix',
        work_category: 'ticket', hours_spent: 3, status: 'done',
        priority: null, blockers: null, next_steps: null,
        tags: null, links: null, project_name: 'Infra', ticket_id: null,
        confidence_score: 0.9, needs_review: false, clarification_needed: false,
        clarification_reason: null, is_user_corrected: false,
        logical_task_id: null, continuation_of: null,
        created_at: '2026-05-15T10:00:00Z', updated_at: '2026-05-15T10:00:00Z',
      },
      {
        id: 'item-2', work_log_id: 'wl-2', employee_id: 'e1',
        work_date: '2026-05-16', task_description: 'Planning doc',
        work_category: 'documentation', hours_spent: 2, status: 'in_progress',
        priority: null, blockers: null, next_steps: null,
        tags: null, links: null, project_name: null, ticket_id: null,
        confidence_score: 0.8, needs_review: false, clarification_needed: false,
        clarification_reason: null, is_user_corrected: false,
        logical_task_id: null, continuation_of: null,
        created_at: '2026-05-16T10:00:00Z', updated_at: '2026-05-16T10:00:00Z',
      },
      {
        id: 'item-3', work_log_id: 'wl-3', employee_id: 'e1',
        work_date: '2026-05-17', task_description: 'Deploy script',
        work_category: 'ticket', hours_spent: 1, status: 'done',
        priority: null, blockers: null, next_steps: null,
        tags: null, links: null, project_name: 'Infra', ticket_id: null,
        confidence_score: 0.9, needs_review: false, clarification_needed: false,
        clarification_reason: null, is_user_corrected: false,
        logical_task_id: null, continuation_of: null,
        created_at: '2026-05-17T10:00:00Z', updated_at: '2026-05-17T10:00:00Z',
      },
    ]),
  },
}))

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((sel) => sel({ user: { id: 'u1', full_name: 'Test User', role: 'employee', employee_id: '123', email: 'c@test.com', team_name: null, department: null, is_active: true } })),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ProjectsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders page heading', async () => {
    const { default: ProjectsPage } = await import('./ProjectsPage')
    render(<ProjectsPage />, { wrapper })
    expect(screen.getByRole('heading', { name: /projects/i })).toBeInTheDocument()
  })

  it('groups items by project_name — shows Infra project card', async () => {
    const { default: ProjectsPage } = await import('./ProjectsPage')
    render(<ProjectsPage />, { wrapper })
    expect(await screen.findByText('Infra')).toBeInTheDocument()
  })

  it('shows Unassigned bucket for items with no project_name', async () => {
    const { default: ProjectsPage } = await import('./ProjectsPage')
    render(<ProjectsPage />, { wrapper })
    expect(await screen.findByText('Unassigned')).toBeInTheDocument()
  })

  it('shows correct total hours per project — Infra has 4h', async () => {
    const { default: ProjectsPage } = await import('./ProjectsPage')
    render(<ProjectsPage />, { wrapper })
    // Infra has item-1 (3h) + item-3 (1h) = 4h
    expect(await screen.findByText('4h')).toBeInTheDocument()
  })

  it('shows task count per project', async () => {
    const { default: ProjectsPage } = await import('./ProjectsPage')
    render(<ProjectsPage />, { wrapper })
    // Infra has 2 tasks
    expect(await screen.findByText('2 tasks')).toBeInTheDocument()
  })
})
