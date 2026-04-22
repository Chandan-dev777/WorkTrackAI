import { useState, useLayoutEffect, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, PlusCircle, BarChart3, Users,
  MessageSquare, Shield, Settings, Search, Command,
  Sparkles, Database, RefreshCw, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { useUIStore } from '@/store/uiStore'
import { useAuthStore } from '@/store/authStore'
import { adminApi } from '@/api/admin'
import { canAccess } from '@/utils/roleGuard'
import type { Role } from '@/utils/roleGuard'

// ── Command item types ────────────────────────────────────────────────────────

type CommandAction =
  | { type: 'navigate'; path: string }
  | { type: 'navigate-state'; path: string; state: Record<string, unknown> }
  | { type: 'api'; fn: () => Promise<unknown>; successMsg: string }

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  minRole: Role
  category: string
  shortcut?: string
  action: CommandAction
}

// ── Command registry ──────────────────────────────────────────────────────────

const COMMANDS: CommandItem[] = [
  // Pages
  { id: 'dashboard',    label: 'Home Dashboard',   icon: LayoutDashboard, path: undefined, minRole: 'employee', category: 'Pages',  shortcut: 'G D', action: { type: 'navigate', path: '/dashboard' } },
  { id: 'submit',       label: 'Submit Update',    icon: PlusCircle,      path: undefined, minRole: 'employee', category: 'Pages',  shortcut: 'N',   action: { type: 'navigate', path: '/submit' } },
  { id: 'my-dashboard', label: 'My Dashboard',     icon: BarChart3,       path: undefined, minRole: 'employee', category: 'Pages',  shortcut: 'G M', action: { type: 'navigate', path: '/my-dashboard' } },
  { id: 'team',         label: 'Team Dashboard',   icon: Users,           path: undefined, minRole: 'manager',  category: 'Pages',  shortcut: 'G T', action: { type: 'navigate', path: '/team' } },
  { id: 'chat',         label: 'Chat Assistant',   icon: MessageSquare,   path: undefined, minRole: 'employee', category: 'Pages',  shortcut: 'G C', action: { type: 'navigate', path: '/chat' } },
  { id: 'admin',        label: 'Admin Panel',      icon: Shield,          path: undefined, minRole: 'admin',    category: 'Pages',          action: { type: 'navigate', path: '/admin' } },
  { id: 'settings',     label: 'Settings',         icon: Settings,        path: undefined, minRole: 'employee', category: 'Pages',          action: { type: 'navigate', path: '/settings' } },

  // AI Actions
  { id: 'ai-week',      label: 'Summarize my week',       description: 'Ask AI for a weekly summary', icon: Sparkles, minRole: 'employee', category: 'AI',
    action: { type: 'navigate-state', path: '/chat', state: { prefillQuestion: 'Summarize my work this week with hours, categories, and any blocked items.' } } },
  { id: 'ai-blocked',   label: 'Show my blocked items',   description: 'Ask AI about blockers',       icon: Sparkles, minRole: 'employee', category: 'AI',
    action: { type: 'navigate-state', path: '/chat', state: { prefillQuestion: 'What are my currently blocked tasks? List them with details.' } } },
  { id: 'ai-yesterday', label: 'What did I work on yesterday?', description: 'Yesterday\'s activity', icon: Sparkles, minRole: 'employee', category: 'AI',
    action: { type: 'navigate-state', path: '/chat', state: { prefillQuestion: 'What did I work on yesterday? Summarise tasks, hours, and status.' } } },
  { id: 'ai-hours',     label: 'How many hours this week?', description: 'Hours logged',              icon: Sparkles, minRole: 'employee', category: 'AI',
    action: { type: 'navigate-state', path: '/chat', state: { prefillQuestion: 'How many hours have I logged this week? Break it down by category.' } } },

  // Admin Actions
  { id: 'admin-seed',    label: 'Seed Demo Data',    description: 'Insert test data into the system', icon: Database,   minRole: 'admin', category: 'Admin',
    action: { type: 'api', fn: () => adminApi.seedDummyData(), successMsg: 'Demo data seeded successfully.' } },
  { id: 'admin-reindex', label: 'Rebuild ChromaDB',  description: 'Reindex vector store',             icon: RefreshCw,  minRole: 'admin', category: 'Admin',
    action: { type: 'api', fn: () => adminApi.reindex(),       successMsg: 'ChromaDB reindex complete.' } },
  { id: 'admin-export',  label: 'Export My Data',    description: 'Download work items as CSV',       icon: Download,   minRole: 'employee', category: 'Admin',
    action: { type: 'navigate', path: '/my-dashboard?export=1' } },
] as unknown as CommandItem[]

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPalette() {
  const open     = useUIStore(s => s.commandPaletteOpen)
  const close    = useUIStore(s => s.closeCommandPalette)
  const userRole = (useAuthStore(s => s.user?.role) ?? 'employee') as Role
  const navigate = useNavigate()

  const [query, setQuery]         = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const [running, setRunning]     = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus immediately when opened — useLayoutEffect avoids the 10ms setTimeout hack
  useLayoutEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      inputRef.current?.focus()
    }
  }, [open])

  // Escape on document closes from anywhere (not just when input is focused)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape' && open) close() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) return null

  const visibleCommands = COMMANDS.filter(cmd =>
    canAccess(userRole, cmd.minRole) &&
    (query === '' ||
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description?.toLowerCase().includes(query.toLowerCase()) ||
      cmd.category.toLowerCase().includes(query.toLowerCase()))
  )

  async function handleSelect(cmd: CommandItem) {
    if (cmd.action.type === 'navigate') {
      navigate(cmd.action.path)
      close()
    } else if (cmd.action.type === 'navigate-state') {
      navigate(cmd.action.path, { state: cmd.action.state })
      close()
    } else if (cmd.action.type === 'api') {
      setRunning(cmd.id)
      try {
        await cmd.action.fn()
        toast.success(cmd.action.successMsg)
      } catch {
        toast.error(`${cmd.label} failed.`)
      } finally {
        setRunning(null)
        close()
      }
    }
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
    } else if (e.key === 'Escape') {
      close()
    }
  }

  const categories = [...new Set(visibleCommands.map(c => c.category))]

  return (
    <>
      <div onClick={close} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />

      <div role="dialog" aria-modal="true" aria-label="Command palette"
        style={{
          position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 1001, width: '100%', maxWidth: 640,
          background: 'var(--color-bg-overlay)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          border: '1px solid var(--color-border-default)',
          borderRadius: 16,
          boxShadow: '0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
          overflow: 'hidden',
          animation: 'scale-in 180ms cubic-bezier(0.16,1,0.3,1)',
        }}>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', height: 56, borderBottom: '1px solid var(--color-border-subtle)' }}>
          <Search size={16} color="var(--color-text-muted)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions, AI shortcuts…"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--color-text-primary)' }}
          />
          <kbd style={{ padding: '2px 6px', borderRadius: 4, fontSize: 11, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-muted)' }}>
            esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '8px 4px' }}>
          {visibleCommands.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '24px', color: 'var(--color-text-muted)', fontSize: 13 }}>
              No results for "{query}"
            </p>
          ) : categories.map(cat => {
            const items = visibleCommands.filter(c => c.category === cat)
            return (
              <div key={cat}>
                <p style={{ padding: '6px 12px 4px', fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
                  {cat}
                </p>
                {items.map(cmd => {
                  const globalIdx = visibleCommands.indexOf(cmd)
                  const isActive  = globalIdx === activeIdx
                  const isRunning = running === cmd.id
                  const Icon      = cmd.icon
                  return (
                    <button key={cmd.id} onClick={() => handleSelect(cmd)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '8px 12px',
                        borderRadius: 8, border: 'none', cursor: 'pointer',
                        background: isActive ? 'var(--color-bg-elevated)' : 'transparent',
                        color: isActive ? 'var(--color-brand-primary)' : 'var(--color-text-primary)',
                        fontSize: 13, textAlign: 'left', transition: 'background 100ms',
                      }}>
                      <Icon size={15} color={isActive ? 'var(--color-brand-primary)' : 'var(--color-text-muted)'} />
                      <span style={{ flex: 1 }}>
                        <span>{cmd.label}</span>
                        {cmd.description && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-text-muted)' }}>{cmd.description}</span>
                        )}
                      </span>
                      {isRunning && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Running…</span>}
                      {cmd.shortcut && !isRunning && (
                        <kbd style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)', background: 'var(--color-bg-elevated)', padding: '1px 5px', borderRadius: 3, border: '1px solid var(--color-border-default)' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', height: 40, borderTop: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-elevated)' }}>
          <Command size={11} color="var(--color-text-muted)" />
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            <kbd>↑↓</kbd> navigate &nbsp;·&nbsp; <kbd>↵</kbd> select &nbsp;·&nbsp; <kbd>Esc</kbd> close &nbsp;·&nbsp; <kbd>?</kbd> shortcuts
          </span>
        </div>
      </div>
    </>
  )
}
