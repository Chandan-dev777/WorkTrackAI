import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
  title?: string
}

interface ToastState {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  clearAll: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    return id
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  clearAll: () => set({ toasts: [] }),
}))

/** Convenience hook */
export function useToast() {
  const { addToast, removeToast } = useToastStore()
  return {
    toast: (message: string, type: ToastType = 'info', title?: string) =>
      addToast({ message, type, title }),
    dismiss: removeToast,
  }
}
