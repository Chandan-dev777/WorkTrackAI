import { describe, it, expect, beforeEach } from 'vitest'

// Reset store state between tests
beforeEach(() => {
  // Clear localStorage to reset persist state
  localStorage.clear()
})

describe('themeStore', () => {
  it('initial state is dark', async () => {
    // Fresh import after clearing storage
    const { useThemeStore } = await import('./themeStore')
    const state = useThemeStore.getState()
    expect(state.theme).toBe('dark')
  })

  it('toggleTheme switches from dark to light', async () => {
    const { useThemeStore } = await import('./themeStore')
    useThemeStore.getState().setTheme('dark')
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('light')
  })

  it('toggleTheme switches from light back to dark', async () => {
    const { useThemeStore } = await import('./themeStore')
    useThemeStore.getState().setTheme('light')
    useThemeStore.getState().toggleTheme()
    expect(useThemeStore.getState().theme).toBe('dark')
  })

  it('setTheme directly sets a theme', async () => {
    const { useThemeStore } = await import('./themeStore')
    useThemeStore.getState().setTheme('light')
    expect(useThemeStore.getState().theme).toBe('light')
  })
})
