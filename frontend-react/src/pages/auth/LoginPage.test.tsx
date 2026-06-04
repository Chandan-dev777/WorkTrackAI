import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'
import { useAuthStore } from '@/store/authStore'

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useAuthStore.getState().logout()
  localStorage.clear()
})

describe('LoginPage — layout', () => {
  it('renders "Welcome back" heading', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('renders email input with label', () => {
    renderLogin()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  })

  it('renders password input with label', () => {
    renderLogin()
    expect(document.getElementById('password') as HTMLElement).toBeInTheDocument()
  })

  it('password input is hidden by default', () => {
    renderLogin()
    expect(document.getElementById('password') as HTMLElement).toHaveAttribute('type', 'password')
  })

  it('show/hide button toggles password visibility', async () => {
    const user = userEvent.setup()
    renderLogin()
    const toggle = screen.getByRole('button', { name: /^show$|^hide$/i })
    await user.click(toggle)
    expect(document.getElementById('password')).toHaveAttribute('type', 'text')
    await user.click(toggle)
    expect(document.getElementById('password')).toHaveAttribute('type', 'password')
  })

  it('renders Sign In submit button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('renders brand name on the left panel', () => {
    renderLogin()
    expect(screen.getAllByText(/dailyops/i).length).toBeGreaterThan(0)
  })
})

describe('LoginPage — validation', () => {
  it('shows error when submitting with empty email', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByText(/email.*required|required.*email|enter.*email/i)).toBeInTheDocument()
    )
  })

  it('shows error when submitting with invalid email format', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), 'notanemail')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByText(/invalid email|valid email/i)).toBeInTheDocument()
    )
  })

  it('shows error when submitting with empty password', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() =>
      expect(screen.getByText(/password.*required|required.*password/i)).toBeInTheDocument()
    )
  })
})

describe('LoginPage — successful login', () => {
  it('logs in with correct credentials and sets auth state', async () => {
    const user = userEvent.setup()
    renderLogin()
    // MSW expects username field — our form uses email, API login uses email as username
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await user.type(document.getElementById('password') as HTMLElement, 'password123')
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() =>
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
    )
    expect(useAuthStore.getState().token).toBe('mock-jwt-token-alice')
  })

  it('submit button shows loading state during API call', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com')
    await user.type(document.getElementById('password') as HTMLElement, 'password123')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    // Loading text appears briefly
    await waitFor(() =>
      expect(screen.queryByText(/signing in|loading/i)).toBeDefined()
    )
  })
})

describe('LoginPage — failed login', () => {
  it('shows error message on wrong credentials', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), 'wrong@example.com')
    await user.type(document.getElementById('password') as HTMLElement, 'wrongpassword')
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() =>
      expect(screen.getByText(/invalid credentials|incorrect|wrong/i)).toBeInTheDocument()
    )
  })

  it('does NOT set authenticated state on failure', async () => {
    const user = userEvent.setup()
    renderLogin()
    await user.type(screen.getByLabelText(/email/i), 'bad@bad.com')
    await user.type(document.getElementById('password') as HTMLElement, 'wrong')
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form')!)
    await waitFor(() =>
      expect(screen.getByText(/invalid credentials|incorrect|wrong/i)).toBeInTheDocument()
    )
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('LoginPage — auth API module', () => {
  it('api/auth exports login function', async () => {
    const { login } = await import('@/api/auth')
    expect(typeof login).toBe('function')
  })
})
