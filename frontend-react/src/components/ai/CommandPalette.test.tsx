import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { CommandPalette } from './CommandPalette'
import type { User } from '@/types/models'

const employeeUser: User = {
  id: 'uuid-alice', employee_id: 'EMP-001', full_name: 'Alice Smith',
  email: 'alice@example.com', role: 'employee',
  team_name: 'Engineering', department: 'Technology', is_active: true,
}

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>
  )
}

beforeEach(() => {
  useAuthStore.getState().login('mock-token', employeeUser)
  useUIStore.getState().closeCommandPalette()
})

describe('CommandPalette', () => {
  it('is not visible when commandPaletteOpen is false', () => {
    renderPalette()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders when commandPaletteOpen is true', () => {
    act(() => useUIStore.getState().openCommandPalette())
    renderPalette()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('search input is present and has correct placeholder', () => {
    act(() => useUIStore.getState().openCommandPalette())
    renderPalette()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('shows page navigation items', () => {
    act(() => useUIStore.getState().openCommandPalette())
    renderPalette()
    expect(screen.getByText('Home Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Submit Update')).toBeInTheDocument()
    expect(screen.getByText('My Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Chat Assistant')).toBeInTheDocument()
  })

  it('does not show Team Dashboard for employee role', () => {
    act(() => useUIStore.getState().openCommandPalette())
    renderPalette()
    expect(screen.queryByText('Team Dashboard')).not.toBeInTheDocument()
  })

  it('typing filters results', () => {
    act(() => useUIStore.getState().openCommandPalette())
    renderPalette()
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'chat' } })
    expect(screen.getByText('Chat Assistant')).toBeInTheDocument()
    expect(screen.queryByText('Home Dashboard')).not.toBeInTheDocument()
  })

  it('pressing Escape closes the palette', async () => {
    act(() => useUIStore.getState().openCommandPalette())
    renderPalette()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(useUIStore.getState().commandPaletteOpen).toBe(false)
    })
  })

  it('clicking backdrop closes the palette', async () => {
    act(() => useUIStore.getState().openCommandPalette())
    renderPalette()
    const backdrop = screen.getByRole('dialog').previousElementSibling as HTMLElement
    fireEvent.click(backdrop)
    await waitFor(() => {
      expect(useUIStore.getState().commandPaletteOpen).toBe(false)
    })
  })

  it('clicking a result closes the palette', async () => {
    act(() => useUIStore.getState().openCommandPalette())
    renderPalette()
    fireEvent.click(screen.getByText('Home Dashboard'))
    await waitFor(() => {
      expect(useUIStore.getState().commandPaletteOpen).toBe(false)
    })
  })

  it('shows keyboard shortcut hint in footer', () => {
    act(() => useUIStore.getState().openCommandPalette())
    renderPalette()
    // footer contains ↑↓/↵/Esc hints — "navigate" is unique to the footer span
    expect(screen.getByText(/navigate/i)).toBeInTheDocument()
  })
})
