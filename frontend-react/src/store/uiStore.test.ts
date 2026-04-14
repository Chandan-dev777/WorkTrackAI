import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
})

describe('uiStore', () => {
  it('sidebarOpen initial state is true', async () => {
    const { useUIStore } = await import('./uiStore')
    expect(useUIStore.getState().sidebarOpen).toBe(true)
  })

  it('toggleSidebar flips the state', async () => {
    const { useUIStore } = await import('./uiStore')
    useUIStore.getState().setSidebarOpen(true)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarOpen).toBe(false)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarOpen).toBe(true)
  })

  it('commandPaletteOpen initial state is false', async () => {
    const { useUIStore } = await import('./uiStore')
    expect(useUIStore.getState().commandPaletteOpen).toBe(false)
  })

  it('openCommandPalette sets commandPaletteOpen to true', async () => {
    const { useUIStore } = await import('./uiStore')
    useUIStore.getState().openCommandPalette()
    expect(useUIStore.getState().commandPaletteOpen).toBe(true)
  })

  it('closeCommandPalette sets commandPaletteOpen to false', async () => {
    const { useUIStore } = await import('./uiStore')
    useUIStore.getState().openCommandPalette()
    useUIStore.getState().closeCommandPalette()
    expect(useUIStore.getState().commandPaletteOpen).toBe(false)
  })
})
