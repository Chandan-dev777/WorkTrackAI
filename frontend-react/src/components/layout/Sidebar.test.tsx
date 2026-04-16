import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import type { User } from '@/types/models'

const employeeUser: User = {
  id: 'uuid-emp-001', employee_id: 'EMP-001', email: 'emp@test.com',
  role: 'employee', full_name: 'Alice Employee',
  team_name: null, department: null, is_active: true,
}
const managerUser: User = {
  id: 'uuid-mgr-001', employee_id: 'EMP-002', email: 'mgr@test.com',
  role: 'manager', full_name: 'Bob Manager',
  team_name: null, department: null, is_active: true,
}
const adminUser: User = {
  id: 'uuid-adm-001', employee_id: 'EMP-003', email: 'adm@test.com',
  role: 'admin', full_name: 'Carol Admin',
  team_name: null, department: null, is_active: true,
}

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useUIStore.getState().setSidebarOpen(true)
})

describe('Sidebar — employee role', () => {
  beforeEach(() => useAuthStore.getState().login('tok', employeeUser))

  it('renders Dashboard nav item', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
  })

  it('renders Submit Update nav item', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Submit Update' })).toBeInTheDocument()
  })

  it('renders My Dashboard nav item', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'My Dashboard' })).toBeInTheDocument()
  })

  it('renders Chat Assistant nav item', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Chat Assistant' })).toBeInTheDocument()
  })

  it('does NOT render Team Dashboard for employee', () => {
    renderSidebar()
    expect(screen.queryByRole('link', { name: 'Team Dashboard' })).not.toBeInTheDocument()
  })

  it('does NOT render Admin for employee', () => {
    renderSidebar()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })
})

describe('Sidebar — manager role', () => {
  beforeEach(() => useAuthStore.getState().login('tok', managerUser))

  it('renders Team Dashboard for manager', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Team Dashboard' })).toBeInTheDocument()
  })

  it('does NOT render Admin for manager', () => {
    renderSidebar()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })
})

describe('Sidebar — admin role', () => {
  beforeEach(() => useAuthStore.getState().login('tok', adminUser))

  it('renders Admin for admin', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Admin' })).toBeInTheDocument()
  })

  it('renders Team Dashboard for admin', () => {
    renderSidebar()
    expect(screen.getByRole('link', { name: 'Team Dashboard' })).toBeInTheDocument()
  })
})

describe('Sidebar — collapse', () => {
  beforeEach(() => useAuthStore.getState().login('tok', employeeUser))

  it('shows nav labels when sidebar is open', () => {
    useUIStore.getState().setSidebarOpen(true)
    renderSidebar()
    expect(screen.getByText('Dashboard')).toBeVisible()
  })

  it('toggle button calls toggleSidebar', () => {
    renderSidebar()
    const toggle = screen.getByRole('button', { name: /collapse|expand|toggle/i })
    fireEvent.click(toggle)
    expect(useUIStore.getState().sidebarOpen).toBe(false)
  })

  it('nav links have title attribute when sidebar is collapsed', () => {
    useUIStore.getState().setSidebarOpen(false)
    renderSidebar()
    const dashLink = screen.getByRole('link', { name: 'Dashboard' })
    expect(dashLink).toHaveAttribute('title', 'Dashboard')
  })
})
