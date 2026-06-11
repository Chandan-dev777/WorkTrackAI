import { type ReactNode, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { TopNavbar } from './TopNavbar'
import { Sidebar } from './Sidebar'
import { PageTransition } from './PageTransition'
import { useThemeStore } from '@/store/themeStore'
import { useUIStore } from '@/store/uiStore'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcuts'
import { CommandPalette } from '@/components/ai/CommandPalette'
import { HelpWidget } from '@/components/help-widget/HelpWidget'
import { FeedbackModal } from '@/components/common/FeedbackModal'

interface ShellProps { children: ReactNode }

// ── Keyboard shortcuts reference overlay ─────────────────────────────────────

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    items: [
      { keys: ['⌘K', 'Ctrl+K'], desc: 'Open command palette' },
      { keys: ['N'],             desc: 'Submit a work update' },
      { keys: ['G', 'D'],        desc: 'Go to Home Dashboard' },
      { keys: ['G', 'C'],        desc: 'Go to Chat Assistant' },
      { keys: ['G', 'M'],        desc: 'Go to My Dashboard' },
      { keys: ['G', 'T'],        desc: 'Go to Team Dashboard (managers)' },
    ],
  },
  {
    title: 'General',
    items: [
      { keys: ['F'],    desc: 'Open feedback / report an issue' },
      { keys: ['?'],    desc: 'Show / hide this keyboard reference' },
      { keys: ['Esc'],  desc: 'Close overlay / command palette' },
    ],
  },
]

function ShortcutsOverlay({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 900, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}>
      <motion.div
        initial={{ scale: 0.95, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 8 }}
        transition={{ duration: 0.18 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--color-border-subtle)' }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--color-text-primary)' }}>Keyboard Shortcuts</p>
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)', lineHeight: 0 }}><X size={16} /></button>
        </div>
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title}>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: 8 }}>{group.title}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {group.items.map(item => (
                  <div key={item.desc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{item.desc}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {item.keys.map(k => (
                        <kbd key={k} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 5, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-elevated)' }}>
          <p style={{ fontSize: 11, color: 'var(--color-text-muted)', textAlign: 'center' }}>Press <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-surface)' }}>?</kbd> or <kbd style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-surface)' }}>Esc</kbd> to close</p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Stable shortcut option objects (prevent listener re-registration) ─────────

const SC_CTRL_K  = { key: 'k', ctrl: true }
const SC_META_K  = { key: 'k', meta: true }
const SC_N       = { key: 'n' }
const SC_QMARK   = { key: '?' }
const SC_F       = { key: 'f' }

// ── Shell ─────────────────────────────────────────────────────────────────────

export function Shell({ children }: ShellProps) {
  const theme        = useThemeStore(s => s.theme)
  const openPalette  = useUIStore(s => s.openCommandPalette)
  const openFeedback = useUIStore(s => s.openFeedback)
  const location     = useLocation()
  const navigate     = useNavigate()

  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  // ⌘K / Ctrl+K → command palette
  useKeyboardShortcut(SC_CTRL_K, openPalette)
  useKeyboardShortcut(SC_META_K, openPalette)

  // N → submit update (skip when user is typing in an input/textarea)
  useKeyboardShortcut(SC_N, () => navigate('/submit'))

  // F → feedback modal
  useKeyboardShortcut(SC_F, () => openFeedback())

  // ? → keyboard reference overlay
  useKeyboardShortcut(SC_QMARK, () => setShortcutsOpen(o => !o))

  return (
    <div
      data-theme={theme}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: 'var(--color-bg-base)', color: 'var(--color-text-primary)', position: 'relative' }}>

      {/* Ambient gradient mesh */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '-5%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      </div>

      <TopNavbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '32px', backgroundColor: 'var(--color-bg-base)', position: 'relative' }}>
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              {children}
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>

      <CommandPalette />
      <HelpWidget />
      <FeedbackModal />

      <AnimatePresence>
        {shortcutsOpen && <ShortcutsOverlay onClose={() => setShortcutsOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
