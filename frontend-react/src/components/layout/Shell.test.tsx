import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Shell } from './Shell'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import type { User } from '@/types/models'

function withProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

const user: User = {
  id: 'uuid-test-001', employee_id: 'EMP-001', email: 't@t.com',
  role: 'employee', full_name: 'Test User',
  team_name: null, department: null, is_active: true, has_password: true, onboarding_complete: true, manager_id: null,
}

beforeEach(() => {
  useAuthStore.getState().login('tok', user)
})

describe('Shell', () => {
  it('renders children in the main content area', () => {
    render(withProviders(<Shell><p>Page content</p></Shell>))
    expect(screen.getByText('Page content')).toBeInTheDocument()
  })

  it('renders TopNavbar', () => {
    render(withProviders(<Shell><div /></Shell>))
    expect(screen.getByText(/dailyops/i)).toBeInTheDocument()
  })

  it('renders Sidebar', () => {
    render(withProviders(<Shell><div /></Shell>))
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('applies data-theme attribute matching themeStore', () => {
    useThemeStore.getState().setTheme('light')
    const { container } = render(withProviders(<Shell><div /></Shell>))
    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.getAttribute('data-theme')).toBe('light')
  })
})
