import { create } from 'zustand'

interface UIState {
  sidebarOpen: boolean
  commandPaletteOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  openCommandPalette: () => void
  closeCommandPalette: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  openCommandPalette: () => set({ commandPaletteOpen: true }),
  closeCommandPalette: () => set({ commandPaletteOpen: false }),
}))
