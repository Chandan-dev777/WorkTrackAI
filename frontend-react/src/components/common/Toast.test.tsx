import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ToastContainer } from './Toast'
import { useToastStore } from '@/store/toastStore'

beforeEach(() => {
  useToastStore.getState().clearAll()
})

describe('Toast — variants', () => {
  it('success toast shows message', () => {
    act(() => useToastStore.getState().addToast({ message: 'Saved!', type: 'success' }))
    render(<ToastContainer />)
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('error toast shows message', () => {
    act(() => useToastStore.getState().addToast({ message: 'Failed!', type: 'error' }))
    render(<ToastContainer />)
    expect(screen.getByText('Failed!')).toBeInTheDocument()
  })

  it('warning toast shows message', () => {
    act(() => useToastStore.getState().addToast({ message: 'Watch out!', type: 'warning' }))
    render(<ToastContainer />)
    expect(screen.getByText('Watch out!')).toBeInTheDocument()
  })

  it('info toast shows message', () => {
    act(() => useToastStore.getState().addToast({ message: 'Note:', type: 'info' }))
    render(<ToastContainer />)
    expect(screen.getByText('Note:')).toBeInTheDocument()
  })
})

describe('Toast — dismiss', () => {
  it('dismiss button removes the toast', () => {
    act(() => useToastStore.getState().addToast({ message: 'Dismiss me', type: 'success' }))
    render(<ToastContainer />)
    const dismiss = screen.getByRole('button', { name: /dismiss|close|×|✕/i })
    fireEvent.click(dismiss)
    expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument()
  })
})

describe('Toast — stacking', () => {
  it('multiple toasts are all rendered', () => {
    act(() => {
      useToastStore.getState().addToast({ message: 'Toast 1', type: 'success' })
      useToastStore.getState().addToast({ message: 'Toast 2', type: 'info' })
      useToastStore.getState().addToast({ message: 'Toast 3', type: 'warning' })
    })
    render(<ToastContainer />)
    expect(screen.getByText('Toast 1')).toBeInTheDocument()
    expect(screen.getByText('Toast 2')).toBeInTheDocument()
    expect(screen.getByText('Toast 3')).toBeInTheDocument()
  })
})

describe('useToastStore', () => {
  it('addToast adds a toast with unique id', () => {
    act(() => useToastStore.getState().addToast({ message: 'Hello', type: 'success' }))
    const toasts = useToastStore.getState().toasts
    expect(toasts).toHaveLength(1)
    expect(toasts[0].message).toBe('Hello')
    expect(toasts[0].id).toBeTruthy()
  })

  it('removeToast removes by id', () => {
    act(() => useToastStore.getState().addToast({ message: 'Hello', type: 'success' }))
    const { id } = useToastStore.getState().toasts[0]
    act(() => useToastStore.getState().removeToast(id))
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('clearAll removes all toasts', () => {
    act(() => {
      useToastStore.getState().addToast({ message: 'A', type: 'success' })
      useToastStore.getState().addToast({ message: 'B', type: 'error' })
    })
    act(() => useToastStore.getState().clearAll())
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })
})
