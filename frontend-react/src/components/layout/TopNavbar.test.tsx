import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { TopNavbar } from './TopNavbar'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import type { User } from '@/types/models'

/** Renders TopNavbar inside a full router so navigate() calls update location */
function LocationDisplay() {
  const loc = useLocation()
  return <div data-testid="pathname">{loc.pathname}</div>
}

function renderNavbarWithRouter(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={<><TopNavbar /><LocationDisplay /></>} />
      </Routes>
    </MemoryRouter>
  )
}

const user: User = {
  id: 'uuid-alice-001', employee_id: 'EMP-001', email: 'alice@test.com',
  role: 'employee', full_name: 'Alice Smith',
  team_name: null, department: null, is_active: true,
}

function renderNavbar() {
  return render(
    <MemoryRouter>
      <TopNavbar />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useAuthStore.getState().login('tok', user)
})

describe('TopNavbar', () => {
  it('renders the WorkTrack AI logo/brand text', () => {
    renderNavbar()
    expect(screen.getByText(/worktrack/i)).toBeInTheDocument()
  })

  it('renders the user initials avatar', () => {
    renderNavbar()
    // "Alice Smith" → "AS"
    expect(screen.getByText('AS')).toBeInTheDocument()
  })

  it('renders theme toggle button', () => {
    renderNavbar()
    expect(screen.getByRole('button', { name: /theme|dark|light|toggle/i })).toBeInTheDocument()
  })

  it('clicking theme toggle calls toggleTheme', () => {
    useThemeStore.getState().setTheme('dark')
    renderNavbar()
    const btn = screen.getByRole('button', { name: /theme|dark|light|toggle/i })
    fireEvent.click(btn)
    expect(useThemeStore.getState().theme).toBe('light')
  })

  it('renders user menu button with user name', () => {
    renderNavbar()
    expect(screen.getByRole('button', { name: /alice smith|user menu|account/i })).toBeInTheDocument()
  })

  it('clicking Sign Out calls logout', () => {
    renderNavbar()
    // open user menu
    fireEvent.click(screen.getByRole('button', { name: /alice smith|user menu|account/i }))
    const signOut = screen.getByRole('button', { name: /sign out|logout/i })
    fireEvent.click(signOut)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('TopNavbar — navigation', () => {
  beforeEach(() => {
    useAuthStore.getState().login('tok', user)
  })

  it('clicking Profile navigates to /settings', () => {
    renderNavbarWithRouter('/dashboard')
    fireEvent.click(screen.getByRole('button', { name: /alice smith|user menu|account/i }))
    fireEvent.click(screen.getByRole('button', { name: /profile/i }))
    expect(screen.getByTestId('pathname')).toHaveTextContent('/settings')
  })

  it('clicking Sign Out navigates to /login', () => {
    renderNavbarWithRouter('/dashboard')
    fireEvent.click(screen.getByRole('button', { name: /alice smith|user menu|account/i }))
    fireEvent.click(screen.getByRole('button', { name: /sign out/i }))
    expect(screen.getByTestId('pathname')).toHaveTextContent('/login')
  })
})
