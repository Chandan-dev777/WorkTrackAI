import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/mocks/server'
import { useAuthStore } from '@/store/authStore'
import RegisterPage from './RegisterPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  )
}

// ── LAYOUT ────────────────────────────────────────────────────────────────────

describe('RegisterPage — layout', () => {
  it('renders Create Account heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /create.*account/i })).toBeInTheDocument()
  })

  it('renders Employee ID input', () => {
    renderPage()
    expect(screen.getByLabelText(/employee id/i)).toBeInTheDocument()
  })

  it('renders Full Name input', () => {
    renderPage()
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  })

  it('renders Email input', () => {
    renderPage()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('renders Password input', () => {
    renderPage()
    // password input identified by placeholder since label has a * child span
    expect(screen.getByPlaceholderText(/min.*8|8.*char/i)).toBeInTheDocument()
  })

  it('renders Role selector', () => {
    renderPage()
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument()
  })

  it('renders Sign In link back to /login', () => {
    renderPage()
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument()
  })

  it('register button is present', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /create account|register|sign up/i })).toBeInTheDocument()
  })
})

// ── VALIDATION ────────────────────────────────────────────────────────────────

describe('RegisterPage — validation', () => {
  it('shows error when submitting with empty Employee ID', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /create account|register|sign up/i }))
    expect(await screen.findByText(/employee id is required/i)).toBeInTheDocument()
  })

  it('shows error when password is less than 8 characters', async () => {
    renderPage()
    fireEvent.change(screen.getByPlaceholderText(/min.*8|8.*char/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /create account|register|sign up/i }))
    expect(await screen.findByText(/8 char|too short|minimum/i)).toBeInTheDocument()
  })

  it('shows error for invalid email format', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: /create account|register|sign up/i }))
    expect(await screen.findByText(/invalid email|valid email/i)).toBeInTheDocument()
  })
})

// ── SUCCESSFUL REGISTRATION ───────────────────────────────────────────────────

describe('RegisterPage — successful registration', () => {
  it('calls POST /auth/register with form data', async () => {
    let sentPayload: unknown
    server.use(
      http.post('/auth/register', async ({ request }) => {
        sentPayload = await request.json()
        return HttpResponse.json({ access_token: 'mock-token-new', token_type: 'bearer' }, { status: 201 })
      })
    )
    renderPage()
    fireEvent.change(screen.getByLabelText(/employee id/i), { target: { value: 'EMP-NEW' } })
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New User' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/min.*8|8.*char/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account|register|sign up/i }))
    await waitFor(() => {
      expect((sentPayload as Record<string, unknown>).employee_id).toBe('EMP-NEW')
      expect((sentPayload as Record<string, unknown>).email).toBe('new@example.com')
    })
  })

  it('sets auth state after successful registration', async () => {
    renderPage()
    fireEvent.change(screen.getByLabelText(/employee id/i), { target: { value: 'EMP-NEW' } })
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New User' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/min.*8|8.*char/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account|register|sign up/i }))
    await waitFor(() => {
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    })
  })
})

// ── SECURITY — role selector ─────────────────────────────────────────────────

describe('RegisterPage — role security', () => {
  it('role selector does NOT offer admin option', () => {
    renderPage()
    const select = screen.getByLabelText(/role/i) as HTMLSelectElement
    const options = Array.from(select.options).map(o => o.value)
    expect(options).not.toContain('admin')
  })

  it('role selector does NOT offer manager option', () => {
    renderPage()
    const select = screen.getByLabelText(/role/i) as HTMLSelectElement
    const options = Array.from(select.options).map(o => o.value)
    expect(options).not.toContain('manager')
  })

  it('role selector only offers employee option', () => {
    renderPage()
    const select = screen.getByLabelText(/role/i) as HTMLSelectElement
    const options = Array.from(select.options).map(o => o.value)
    expect(options).toEqual(['employee'])
  })
})

// ── ERROR STATE ───────────────────────────────────────────────────────────────

describe('RegisterPage — error state', () => {
  it('shows server error when registration fails (409 conflict)', async () => {
    server.use(
      http.post('/auth/register', () =>
        HttpResponse.json({ detail: 'Email already registered' }, { status: 409 })
      )
    )
    renderPage()
    fireEvent.change(screen.getByLabelText(/employee id/i), { target: { value: 'EMP-DUP' } })
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Dup User' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'dup@example.com' } })
    fireEvent.change(screen.getByPlaceholderText(/min.*8|8.*char/i), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /create account|register|sign up/i }))
    expect(await screen.findByText(/already.*registered|already.*exists|failed/i)).toBeInTheDocument()
  })
})
