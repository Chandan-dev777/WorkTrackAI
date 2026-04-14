import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Shell } from './Shell'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import type { User } from '@/types/models'

const user: User = {
  id: 'uuid-test-001', employee_id: 'EMP-001', email: 't@t.com',
  role: 'employee', full_name: 'Test User',
  team_name: null, department: null, is_active: true,
}

beforeEach(() => {
  useAuthStore.getState().login('tok', user)
})

describe('Shell', () => {
  it('renders children in the main content area', () => {
    render(
      <MemoryRouter>
        <Shell><p>Page content</p></Shell>
      </MemoryRouter>
    )
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('renders TopNavbar', () => {
    render(
      <MemoryRouter>
        <Shell><div /></Shell>
      </MemoryRouter>
    )
    expect(screen.getByText(/worktrack/i)).toBeInTheDocument()
  })

  it('renders Sidebar', () => {
    render(
      <MemoryRouter>
        <Shell><div /></Shell>
      </MemoryRouter>
    )
    // Check the nav landmark is present (sidebar renders a <nav>)
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('applies data-theme attribute matching themeStore', () => {
    useThemeStore.getState().setTheme('light')
    const { container } = render(
      <MemoryRouter>
        <Shell><div /></Shell>
      </MemoryRouter>
    )
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.getAttribute('data-theme')).toBe('light')
  })
})
