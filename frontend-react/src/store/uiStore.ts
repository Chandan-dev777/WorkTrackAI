import { create } from 'zustand'
import type { NoteType } from '@/types/models'

interface UIState {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  feedbackOpen: boolean
  feedbackType: NoteType
  feedbackPrefill: string
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
  openFeedback: (type?: NoteType, prefill?: string) => void
  closeFeedback: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  feedbackOpen: false,
  feedbackType: 'feedback',
  feedbackPrefill: '',
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
  openFeedback: (type = 'feedback', prefill = '') =>
    set({ feedbackOpen: true, feedbackType: type, feedbackPrefill: prefill }),
  closeFeedback: () => set({ feedbackOpen: false, feedbackPrefill: '' }),
}))
