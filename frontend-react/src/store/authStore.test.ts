import { describe, it, expect, beforeEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
})

const mockUser = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  role: 'employee' as const,
  full_name: 'Test User',
}

describe('authStore', () => {
  it('initial state has no user and no token', async () => {
    const { useAuthStore } = await import('./authStore')
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('login sets user, token, and isAuthenticated', async () => {
    const { useAuthStore } = await import('./authStore')
    useAuthStore.getState().login('test-token-123', mockUser)
    const state = useAuthStore.getState()
    expect(state.token).toBe('test-token-123')
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
  })

  it('logout clears user, token, and isAuthenticated', async () => {
    const { useAuthStore } = await import('./authStore')
    useAuthStore.getState().login('test-token-123', mockUser)
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('isAuthenticated is true when token is present', async () => {
    const { useAuthStore } = await import('./authStore')
    useAuthStore.getState().login('any-token', mockUser)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('setUser updates user without changing token', async () => {
    const { useAuthStore } = await import('./authStore')
    useAuthStore.getState().login('my-token', mockUser)
    const updatedUser = { ...mockUser, full_name: 'Updated Name' }
    useAuthStore.getState().setUser(updatedUser)
    expect(useAuthStore.getState().user?.full_name).toBe('Updated Name')
    expect(useAuthStore.getState().token).toBe('my-token')
  })
})
