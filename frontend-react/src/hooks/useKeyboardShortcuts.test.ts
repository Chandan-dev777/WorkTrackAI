import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { useKeyboardShortcut } from './useKeyboardShortcuts'

afterEach(() => vi.restoreAllMocks())

describe('useKeyboardShortcut', () => {
  it('fires callback on Ctrl+K', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'k', ctrl: true }, cb))
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(cb).toHaveBeenCalledOnce()
  })

  it('fires callback on Cmd+K (metaKey)', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'k', meta: true }, cb))
    fireEvent.keyDown(document, { key: 'k', metaKey: true })
    expect(cb).toHaveBeenCalledOnce()
  })

  it('does NOT fire when only the key is pressed (no modifier)', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'k', ctrl: true }, cb))
    fireEvent.keyDown(document, { key: 'k' })
    expect(cb).not.toHaveBeenCalled()
  })

  it('does NOT fire when typing inside an input element', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'k', ctrl: true }, cb))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    fireEvent.keyDown(input, { key: 'k', ctrlKey: true })
    expect(cb).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })

  it('does NOT fire when typing inside a textarea', () => {
    const cb = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'k', ctrl: true }, cb))
    const ta = document.createElement('textarea')
    document.body.appendChild(ta)
    ta.focus()
    fireEvent.keyDown(ta, { key: 'k', ctrlKey: true })
    expect(cb).not.toHaveBeenCalled()
    document.body.removeChild(ta)
  })

  it('removes listener on unmount', () => {
    const cb = vi.fn()
    const { unmount } = renderHook(() => useKeyboardShortcut({ key: 'k', ctrl: true }, cb))
    unmount()
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true })
    expect(cb).not.toHaveBeenCalled()
  })
})
