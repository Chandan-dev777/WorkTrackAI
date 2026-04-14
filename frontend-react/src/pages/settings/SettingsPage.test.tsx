import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import SettingsPage from './SettingsPage'
import type { User } from '@/types/models'

const employeeUser: User = {
  id: 'uuid-alice', employee_id: 'EMP-001', full_name: 'Alice Smith',
  email: 'alice@example.com', role: 'employee',
  team_name: 'Engineering', department: 'Technology', is_active: true,
}

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useAuthStore.getState().login('mock-token', employeeUser)
  useThemeStore.setState({ theme: 'dark' })
})

// ── LAYOUT ────────────────────────────────────────────────────────────────────

describe('SettingsPage — layout', () => {
  it('renders Settings heading', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
  })

  it('renders section navigation links', () => {
    renderPage()
    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /appearance/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /account/i })).toBeInTheDocument()
  })
})

// ── PROFILE SECTION ───────────────────────────────────────────────────────────

describe('SettingsPage — Profile section (default)', () => {
  it('shows the users full name', () => {
    renderPage()
    expect(screen.getByText('Alice Smith')).toBeInTheDocument()
  })

  it('shows the users email', () => {
    renderPage()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
  })

  it('shows the users employee ID', () => {
    renderPage()
    expect(screen.getByText('EMP-001')).toBeInTheDocument()
  })

  it('shows the users role', () => {
    renderPage()
    // role is displayed as "Employee" (capitalized) — exact match avoids "Employee ID" label
    expect(screen.getByText('Employee')).toBeInTheDocument()
  })

  it('shows the users team name', () => {
    renderPage()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
  })

  it('shows read-only notice since there is no update endpoint', () => {
    renderPage()
    expect(screen.getByText(/contact.*admin|read.only|managed by/i)).toBeInTheDocument()
  })
})

// ── APPEARANCE SECTION ────────────────────────────────────────────────────────

describe('SettingsPage — Appearance section', () => {
  it('navigates to Appearance section on click', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /appearance/i }))
    expect(screen.getByText(/theme/i)).toBeInTheDocument()
  })

  it('shows Dark option in theme selector', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /appearance/i }))
    expect(screen.getByText(/dark/i)).toBeInTheDocument()
  })

  it('shows Light option in theme selector', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /appearance/i }))
    expect(screen.getByText(/light/i)).toBeInTheDocument()
  })

  it('clicking Light switches theme store to light', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /appearance/i }))
    const lightBtn = screen.getByRole('button', { name: /^light$/i })
    fireEvent.click(lightBtn)
    expect(useThemeStore.getState().theme).toBe('light')
  })

  it('clicking Dark switches theme store to dark', () => {
    useThemeStore.setState({ theme: 'light' })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /appearance/i }))
    const darkBtn = screen.getByRole('button', { name: /^dark$/i })
    fireEvent.click(darkBtn)
    expect(useThemeStore.getState().theme).toBe('dark')
  })
})

// ── ACCOUNT SECTION ───────────────────────────────────────────────────────────

describe('SettingsPage — Account section', () => {
  it('navigates to Account section on click', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /account/i }))
    expect(screen.getByRole('button', { name: /sign out|log out/i })).toBeInTheDocument()
  })

  it('clicking Sign Out clears auth state', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /account/i }))
    fireEvent.click(screen.getByRole('button', { name: /sign out|log out/i }))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
