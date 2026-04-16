import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { TopNavbar } from './TopNavbar'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { useThemeStore } from '@/store/themeStore'
import { useUIStore } from '@/store/uiStore'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts'
import { CommandPalette } from '@/components/ai/CommandPalette'
import { HelpWidget } from '@/components/help-widget/HelpWidget'

interface ShellProps {
  children: ReactNode
}

// Stable option objects — defined outside component to prevent listener re-registration on every render
const SHORTCUT_CTRL_K = { key: 'k', ctrl: true  }
const SHORTCUT_META_K = { key: 'k', meta: true  }

export function Shell({ children }: ShellProps) {
  const theme = useThemeStore((s) => s.theme)
  const openPalette = useUIStore((s) => s.openCommandPalette)
  const location = useLocation()

  // ⌘K / Ctrl+K → open command palette
  useKeyboardShortcut(SHORTCUT_CTRL_K, openPalette)
  useKeyboardShortcut(SHORTCUT_META_K, openPalette)

  return (
    <div
      data-theme={theme}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        backgroundColor: 'var(--color-bg-base)',
        color: 'var(--color-text-primary)',
        position: 'relative',
      }}
    >
      {/* Ambient gradient mesh — fixed, decorative only */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', top: '-15%', left: '-10%',
          width: 480, height: 480, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '-5%',
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }} />
      </div>
      <TopNavbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '32px',
            backgroundColor: 'var(--color-bg-base)',
            position: 'relative',
          }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              {children}
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette />
      <HelpWidget />
    </div>
  )
}
