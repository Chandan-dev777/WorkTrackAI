import type { ReactNode } from 'react'
import { TopNavbar } from './TopNavbar'
import { Sidebar } from './Sidebar'
import { useThemeStore } from '@/store/themeStore'
import { useUIStore } from '@/store/uiStore'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts'
import { CommandPalette } from '@/components/ai/CommandPalette'
import { HelpWidget } from '@/components/help-widget/HelpWidget'

interface ShellProps {
  children: ReactNode
}

export function Shell({ children }: ShellProps) {
  const theme = useThemeStore((s) => s.theme)
  const openPalette = useUIStore((s) => s.openCommandPalette)

  // ⌘K / Ctrl+K → open command palette
  useKeyboardShortcut({ key: 'k', ctrl: true  }, openPalette)
  useKeyboardShortcut({ key: 'k', meta: true  }, openPalette)

  return (
    <div
      data-theme={theme}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--color-bg-base)',
        color: 'var(--color-text-primary)',
      }}
    >
      <TopNavbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '32px',
            backgroundColor: 'var(--color-bg-base)',
          }}
        >
          {children}
        </main>
      </div>
      <CommandPalette />
      <HelpWidget />
    </div>
  )
}
