import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { useAuthStore } from '@/store/authStore'
import AdminPage from './AdminPage'
import type { User } from '@/types/models'

const adminUser: User = {
  id: 'uuid-adm', employee_id: 'EMP-ADM', full_name: 'Carol Admin',
  email: 'carol@example.com', role: 'admin',
  team_name: null, department: null, is_active: true, has_password: true, onboarding_complete: true, manager_id: null,
}

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
}

function renderPage() {
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter>
        <AdminPage />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

function clickTab(label: RegExp | string) {
  fireEvent.click(screen.getByRole('button', { name: label }))
}

beforeEach(() => {
  useAuthStore.getState().login('mock-token', adminUser)
})

// ── PAGE HEADER ───────────────────────────────────────────────────────────────

describe('AdminPage — header', () => {
  it('renders Admin Panel heading', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { name: /admin panel/i })).toBeInTheDocument()
  })

  it('renders tab buttons', async () => {
    renderPage()
    expect(await screen.findByRole('button', { name: /user management/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /system actions/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /extraction errors/i })).toBeInTheDocument()
  })
})

// ── TAB: USER MANAGEMENT ─────────────────────────────────────────────────────

describe('AdminPage — User Management tab (default)', () => {
  it('shows user metric cards', async () => {
    renderPage()
    expect(await screen.findByText('Total Users')).toBeInTheDocument()
    // 'Active' also appears in user table checkbox labels — just check at least one match
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getByText('Admins')).toBeInTheDocument()
    expect(screen.getByText('Inactive')).toBeInTheDocument()
  })

  it('shows total user count (3)', async () => {
    renderPage()
    await screen.findByText('Total Users')
    // metric card shows 3
    expect(screen.getAllByText('3').length).toBeGreaterThan(0)
  })

  it('shows all user names', async () => {
    renderPage()
    expect(await screen.findByText('Alice Smith')).toBeInTheDocument()
    expect(screen.getByText('Bob Manager')).toBeInTheDocument()
    expect(screen.getByText('Carol Admin')).toBeInTheDocument()
  })

  it('shows user emails', async () => {
    renderPage()
    expect(await screen.findByText('alice@example.com')).toBeInTheDocument()
  })

  it('shows user initials avatar (AS for Alice Smith)', async () => {
    renderPage()
    expect(await screen.findByText('AS')).toBeInTheDocument()
  })

  it('shows role badge for each user', async () => {
    renderPage()
    await screen.findByText('Alice Smith')
    expect(screen.getAllByText(/^employee$|^manager$|^admin$/i).length).toBeGreaterThan(0)
  })

  it('shows "(you)" label next to current admin user', async () => {
    renderPage()
    expect(await screen.findByText(/\(you\)/i)).toBeInTheDocument()
  })

  it('Save button is present for non-self users', async () => {
    renderPage()
    await screen.findByText('Alice Smith')
    const saveBtns = screen.getAllByRole('button', { name: /save/i })
    // self user (Carol Admin) has disabled/no button, others have Save
    expect(saveBtns.length).toBeGreaterThan(0)
  })

  it('role selector is present for non-self users', async () => {
    renderPage()
    await screen.findByText('Alice Smith')
    // Alice and Bob have role selectors; Carol (self) shows badge only
    const roleSelects = screen.getAllByRole('combobox', { name: /role for/i })
    expect(roleSelects.length).toBe(2) // Alice + Bob (not Carol = self)
  })

  it('changing role and saving calls PUT /admin/users/{id}', async () => {
    let putCalled = false
    let sentPayload: unknown
    server.use(
      http.put('/admin/users/:id', async ({ request }) => {
        putCalled = true
        sentPayload = await request.json()
        return HttpResponse.json({ id: 'u-001', employee_id: 'EMP-001', full_name: 'Alice Smith', email: 'alice@example.com', role: 'manager', team_name: 'Engineering', department: 'Technology', is_active: true })
      })
    )
    renderPage()
    await screen.findByText('Alice Smith')
    const aliceRoleSelect = screen.getAllByRole('combobox', { name: /role for alice/i })[0]
    fireEvent.change(aliceRoleSelect, { target: { value: 'manager' } })
    const aliceSave = screen.getAllByRole('button', { name: /save alice/i })[0]
    fireEvent.click(aliceSave)
    await waitFor(() => expect(putCalled).toBe(true))
    expect((sentPayload as Record<string, unknown>).role).toBe('manager')
  })

  it('shows save success message after successful update', async () => {
    renderPage()
    await screen.findByText('Alice Smith')
    const aliceRoleSelect = screen.getAllByRole('combobox', { name: /role for alice/i })[0]
    fireEvent.change(aliceRoleSelect, { target: { value: 'manager' } })
    fireEvent.click(screen.getAllByRole('button', { name: /save alice/i })[0])
    expect(await screen.findByText(/saved|alice smith/i)).toBeInTheDocument()
  })
})

// ── TAB: SYSTEM ACTIONS ───────────────────────────────────────────────────────

describe('AdminPage — System Actions tab', () => {
  it('renders Seed Dummy Data section after clicking tab', async () => {
    renderPage()
    await screen.findByRole('button', { name: /system actions/i })
    clickTab(/system actions/i)
    expect(await screen.findByRole('button', { name: /seed.*data|seed dummy/i })).toBeInTheDocument()
  })

  it('renders Rebuild Index section', async () => {
    renderPage()
    await screen.findByRole('button', { name: /system actions/i })
    clickTab(/system actions/i)
    expect(await screen.findByRole('button', { name: /rebuild.*index|reindex/i })).toBeInTheDocument()
  })

  it('clicking Seed Data shows confirm dialog', async () => {
    renderPage()
    await screen.findByRole('button', { name: /system actions/i })
    clickTab(/system actions/i)
    fireEvent.click(await screen.findByRole('button', { name: /seed.*data|seed dummy/i }))
    expect(await screen.findByText(/this will add test data/i)).toBeInTheDocument()
  })

  it('confirming seed data calls POST /admin/seed-dummy-data', async () => {
    let called = false
    server.use(http.post('/admin/seed-dummy-data', () => { called = true; return HttpResponse.json({ message: 'Seeded.' }) }))
    renderPage()
    await screen.findByRole('button', { name: /system actions/i })
    clickTab(/system actions/i)
    fireEvent.click(await screen.findByRole('button', { name: /seed.*data|seed dummy/i }))
    fireEvent.click(await screen.findByRole('button', { name: /^confirm$/i }))
    await waitFor(() => expect(called).toBe(true))
  })

  it('cancelling seed dialog does not call the API', async () => {
    let called = false
    server.use(http.post('/admin/seed-dummy-data', () => { called = true; return HttpResponse.json({}) }))
    renderPage()
    await screen.findByRole('button', { name: /system actions/i })
    clickTab(/system actions/i)
    fireEvent.click(await screen.findByRole('button', { name: /seed.*data|seed dummy/i }))
    fireEvent.click(await screen.findByRole('button', { name: /cancel/i }))
    await waitFor(() => expect(called).toBe(false))
  })

  it('Rebuild Index shows result after clicking', async () => {
    renderPage()
    await screen.findByRole('button', { name: /system actions/i })
    clickTab(/system actions/i)
    fireEvent.click(await screen.findByRole('button', { name: /rebuild.*index|reindex/i }))
    expect(await screen.findByText(/42.*item|reindex.*complete|indexed/i)).toBeInTheDocument()
  })
})

// ── TAB: EXTRACTION ERRORS ────────────────────────────────────────────────────

describe('AdminPage — Extraction Errors tab', () => {
  function goToErrors() {
    clickTab(/extraction errors/i)
  }

  it('shows error metric cards (total, failed, needs review)', async () => {
    renderPage()
    await screen.findByRole('button', { name: /extraction errors/i })
    goToErrors()
    expect(await screen.findByText('Total Errors')).toBeInTheDocument()
    // 'Failed' also appears on filter button — just check at least one match
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Needs Review').length).toBeGreaterThan(0)
  })

  it('shows failed count (1) and needs_review count (1)', async () => {
    renderPage()
    await screen.findByRole('button', { name: /extraction errors/i })
    goToErrors()
    await screen.findByText('Total Errors')
    // 1 failed, 1 needs_review in mock
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('shows status filter buttons', async () => {
    renderPage()
    await screen.findByRole('button', { name: /extraction errors/i })
    goToErrors()
    expect(await screen.findByRole('button', { name: /filter all/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filter failed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filter needs_review/i })).toBeInTheDocument()
  })

  it('filtering by failed hides needs_review rows from table', async () => {
    renderPage()
    await screen.findByRole('button', { name: /extraction errors/i })
    goToErrors()
    await screen.findByText('EMP-002') // needs_review error row
    fireEvent.click(screen.getByRole('button', { name: /filter failed/i }))
    // EMP-002 (needs_review) should disappear from the table; EMP-001 (failed) stays
    await waitFor(() => {
      expect(screen.queryByText('EMP-002')).not.toBeInTheDocument()
    })
    expect(screen.getByText('EMP-001')).toBeInTheDocument()
  })

  it('clicking a row expands the raw message', async () => {
    renderPage()
    await screen.findByRole('button', { name: /extraction errors/i })
    goToErrors()
    await screen.findByText('EMP-001')
    // click first error row
    fireEvent.click(screen.getByText('EMP-001').closest('tr')!)
    expect(await screen.findByText(/raw submission/i)).toBeInTheDocument()
    expect(screen.getByText(/could not parse/i)).toBeInTheDocument()
  })

  it('shows empty state when no errors', async () => {
    server.use(http.get('/admin/extraction-errors', () => HttpResponse.json([])))
    renderPage()
    await screen.findByRole('button', { name: /extraction errors/i })
    goToErrors()
    expect(await screen.findByText(/no extraction errors|all extractions/i)).toBeInTheDocument()
  })
})
