import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

// Mock API
vi.mock('@/api/worklogs', () => ({
  worklogsApi: {
    getMy: vi.fn().mockResolvedValue([
      {
        id: 'item-1', work_log_id: 'wl-1', employee_id: 'e1',
        work_date: '2026-05-15', task_description: 'CI/CD pipeline fix',
        work_category: 'ticket', hours_spent: 3, status: 'done',
        priority: null, blockers: null, next_steps: null,
        tags: null, links: null, project_name: 'Infra', ticket_id: null,
        confidence_score: 0.9, needs_review: false, clarification_needed: false,
        clarification_reason: null, is_user_corrected: false,
        logical_task_id: null, continuation_of: null,
        created_at: '2026-05-15T10:00:00Z', updated_at: '2026-05-15T10:00:00Z',
      },
    ]),
    getOpen: vi.fn().mockResolvedValue([]),
  },
}))

// Mock auth store
vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn((sel) => sel({ user: { id: 'u1', full_name: 'Chandan Test', role: 'employee', employee_id: '123', email: 'c@test.com', team_name: null, department: null, is_active: true } })),
}))

// Mock toast
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('TasksPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders page heading', async () => {
    const { default: TasksPage } = await import('./TasksPage')
    render(<TasksPage />, { wrapper })
    expect(screen.getByRole('heading', { name: /tasks/i })).toBeInTheDocument()
  })

  it('renders work items table', async () => {
    const { default: TasksPage } = await import('./TasksPage')
    render(<TasksPage />, { wrapper })
    const table = await screen.findByRole('table', { name: /work items/i })
    expect(table).toBeInTheDocument()
  })

  it('shows task description in table', async () => {
    const { default: TasksPage } = await import('./TasksPage')
    render(<TasksPage />, { wrapper })
    expect(await screen.findByText('CI/CD pipeline fix')).toBeInTheDocument()
  })

  it('renders search input', async () => {
    const { default: TasksPage } = await import('./TasksPage')
    render(<TasksPage />, { wrapper })
    expect(screen.getByRole('textbox', { name: /search/i })).toBeInTheDocument()
  })
})
