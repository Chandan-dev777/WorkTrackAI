import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PlusCircle, BarChart3, Users,
  MessageSquare, Shield, Settings, Search, Command,
} from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { canAccess } from '@/utils/roleGuard'
import type { Role } from '@/utils/roleGuard'

// ── Command items ─────────────────────────────────────────────────────────────

interface CommandItem {
  id: string
  label: string
  icon: React.ElementType
  path: string
  minRole: Role
  category: string
  shortcut?: string
}

const COMMANDS: CommandItem[] = [
  { id: 'dashboard',    label: 'Dashboard',       icon: LayoutDashboard, path: '/dashboard',    minRole: 'employee', category: 'Pages' },
  { id: 'submit',       label: 'Submit Update',   icon: PlusCircle,      path: '/submit',       minRole: 'employee', category: 'Pages' },
  { id: 'my-dashboard', label: 'My Dashboard',    icon: BarChart3,       path: '/my-dashboard', minRole: 'employee', category: 'Pages' },
  { id: 'team',         label: 'Team Dashboard',  icon: Users,           path: '/team',         minRole: 'manager',  category: 'Pages' },
  { id: 'chat',         label: 'Chat Assistant',  icon: MessageSquare,   path: '/chat',         minRole: 'employee', category: 'Pages' },
  { id: 'admin',        label: 'Admin',           icon: Shield,          path: '/admin',        minRole: 'admin',    category: 'Pages' },
  { id: 'settings',     label: 'Settings',        icon: Settings,        path: '/settings',     minRole: 'employee', category: 'Pages' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const open        = useUIStore(s => s.commandPaletteOpen)
  const close       = useUIStore(s => s.closeCommandPalette)
  const userRole    = (useAuthStore(s => s.user?.role) ?? 'employee') as Role
  const navigate    = useNavigate()
  const [query, setQuery]       = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  const visibleCommands = COMMANDS.filter(cmd =>
    canAccess(userRole, cmd.minRole) &&
    (query === '' || cmd.label.toLowerCase().includes(query.toLowerCase()))
  )

  function handleSelect(cmd: CommandItem) {
    navigate(cmd.path)
    close()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, visibleCommands.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && visibleCommands[activeIdx]) {
      handleSelect(visibleCommands[activeIdx])
    }
  }

  // Group by category
  const categories = [...new Set(visibleCommands.map(c => c.category))]

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
        }}
      />

      {/* Palette container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        style={{
          position: 'fixed', top: '20%', left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1001, width: '100%', maxWidth: 640,
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          animation: 'scale-in 180ms cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', height: 56,
          borderBottom: '1px solid var(--color-border-subtle)',
        }}>
          <Search size={16} color="var(--color-text-muted)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and actions…"
            style={{
              flex: 1, background: 'none', border: 'none', outline: 'none',
              fontSize: 15, color: 'var(--color-text-primary)',
            }}
          />
          <kbd style={{
            padding: '2px 6px', borderRadius: 4, fontSize: 11,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-default)',
            color: 'var(--color-text-muted)',
          }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px 4px' }}>
          {visibleCommands.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No results for "{query}"
            </p>
          ) : categories.map(cat => {
            const items = visibleCommands.filter(c => c.category === cat)
            return (
              <div key={cat}>
                <p style={{
                  padding: '6px 12px 4px', fontSize: 11, fontWeight: 500,
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: 'var(--color-text-muted)',
                }}>
                  {cat}
                </p>
                {items.map((cmd) => {
                  const globalIdx = visibleCommands.indexOf(cmd)
                  const isActive  = globalIdx === activeIdx
                  const Icon = cmd.icon
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '8px 12px',
                        borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                        color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-primary)',
                        fontSize: 13, textAlign: 'left',
                        transition: 'background 100ms',
                      }}
                    >
                      <Icon size={15} color={isActive ? 'var(--color-brand-primary)' : 'var(--color-text-muted)'} />
                      {cmd.label}
                      {cmd.shortcut && (
                        <kbd style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {cmd.shortcut}
                        </kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 16px', height: 40,
          borderTop: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-elevated)',
        }}>
          <Command size={11} color="var(--color-text-muted)" />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            <kbd>↑↓</kbd> navigate &nbsp;·&nbsp; <kbd>↵</kbd> open &nbsp;·&nbsp; <kbd>Esc</kbd> close
          </span>
        </div>
      </div>
    </>
  )
}
