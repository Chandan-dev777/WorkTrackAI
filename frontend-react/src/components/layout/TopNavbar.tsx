import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, User, Bell, X, CheckCircle2 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '@/api/dashboard'
import { worklogsApi } from '@/api/worklogs'
import { cn } from '@/utils/cn'

function getInitials(fullName: string): string {
  return fullName.split(' ').filter(Boolean).slice(0, 2).map(n => n[0].toUpperCase()).join('')
}

// ── Notification types ────────────────────────────────────────────────────────

interface Notification { id: string; icon: string; message: string; type: 'info' | 'warning' | 'success' }

function useNotifications() {
  const DISMISSED_KEY = 'dailyops_dismissed_notifs'
  const [dismissed, setDismissed] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') } catch { return [] }
  })

  const weekParams = (() => {
    const end = new Date().toISOString().split('T')[0]
    const start = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    return { start_date: start, end_date: end }
  })()

  const summaryQ = useQuery({ queryKey: ['notif-summary'], queryFn: () => dashboardApi.getSummary(weekParams), staleTime: 120_000 })
  const itemsQ   = useQuery({ queryKey: ['notif-items'],   queryFn: () => worklogsApi.getMy(weekParams),        staleTime: 120_000 })

  const notifications: Notification[] = []

  const needsReview = (itemsQ.data ?? []).filter(i => i.needs_review).length
  if (needsReview > 0) notifications.push({ id: 'needs-review', icon: '⚠️', message: `${needsReview} item${needsReview !== 1 ? 's' : ''} need your review`, type: 'warning' })

  const blocked = summaryQ.data?.blocked_count ?? 0
  if (blocked > 0) notifications.push({ id: 'blocked', icon: '🚫', message: `${blocked} item${blocked !== 1 ? 's' : ''} blocked this week`, type: 'warning' })

  const totalHours = summaryQ.data?.total_hours ?? 0
  const goal = (() => { const v = localStorage.getItem('dailyops_weekly_goal'); return v ? Number(v) : 40 })()
  if (totalHours >= goal && goal > 0) notifications.push({ id: 'goal-reached', icon: '🎯', message: `Weekly goal reached — ${totalHours.toFixed(1)}h logged!`, type: 'success' })

  const streak = (() => {
    const days = [...new Set((itemsQ.data ?? []).map(i => i.work_date))].sort().reverse()
    if (!days.length) return 0
    let s = 1
    for (let i = 1; i < days.length; i++) {
      const diff = (new Date(days[i-1]).getTime() - new Date(days[i]).getTime()) / 86400000
      if (diff <= 1) s++; else break
    }
    return s
  })()
  if (streak >= 5) notifications.push({ id: `streak-${streak}`, icon: '🔥', message: `${streak}-day submission streak!`, type: 'success' })

  const visible = notifications.filter(n => !dismissed.includes(n.id))

  function dismiss(id: string) {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  }
  function dismissAll() {
    const next = notifications.map(n => n.id)
    setDismissed(prev => [...new Set([...prev, ...next])])
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...new Set([...dismissed, ...next])]))
  }

  return { notifications: visible, dismiss, dismissAll }
}

// ── TopNavbar ─────────────────────────────────────────────────────────────────

export function TopNavbar() {
  const user        = useAuthStore(s => s.user)
  const logout      = useAuthStore(s => s.logout)
  const theme       = useThemeStore(s => s.theme)
  const toggleTheme = useThemeStore(s => s.toggleTheme)
  const navigate    = useNavigate()

  const [menuOpen, setMenuOpen]   = useState(false)
  const [bellOpen, setBellOpen]   = useState(false)
  const { notifications, dismiss, dismissAll } = useNotifications()
  const unread = notifications.length

  const initials = user ? getInitials(user.full_name) : '?'

  return (
    <header style={{ height: 56, backgroundColor: 'var(--color-bg-surface)', borderBottom: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 16, position: 'sticky', top: 0, zIndex: 50, flexShrink: 0 }}>
      {/* Brand */}
      <span style={{ fontWeight: 700, fontSize: 18, background: 'var(--gradient-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', userSelect: 'none', minWidth: 140 }}>
        DailyOps AI
      </span>

      <div style={{ flex: 1 }} />

      {/* Theme toggle */}
      <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className={cn('relative flex items-center rounded-full transition-colors duration-200', theme === 'dark' ? 'bg-indigo-900/40' : 'bg-amber-100')}
        style={{ width: 44, height: 24, padding: '0 3px', flexShrink: 0 }}>
        <motion.div layout transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px]"
          style={{ background: theme === 'dark' ? '#818cf8' : '#f59e0b', marginLeft: theme === 'dark' ? 'auto' : '0' }}>
          {theme === 'dark' ? '🌙' : '☀️'}
        </motion.div>
      </button>

      {/* Bell / Notification center */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setBellOpen(v => !v)} aria-label="Notifications"
          className="relative flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
          style={{ background: bellOpen ? 'var(--color-bg-elevated)' : 'transparent' }}>
          <Bell size={17} color="var(--color-text-secondary)" />
          {unread > 0 && (
            <span style={{ position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', background: '#F43F5E', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {unread}
            </span>
          )}
        </button>

        <AnimatePresence>
          {bellOpen && (
            <>
              <div onClick={() => setBellOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', overflow: 'hidden', zIndex: 100 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>Notifications</span>
                  {unread > 0 && (
                    <button onClick={dismissAll} style={{ fontSize: 11, color: 'var(--color-brand-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 14px', textAlign: 'center' }}>
                    <CheckCircle2 size={20} color="#10B981" style={{ margin: '0 auto 8px' }} />
                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>All caught up!</p>
                  </div>
                ) : (
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifications.map(n => (
                      <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>{n.icon}</span>
                        <p style={{ flex: 1, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.4 }}>{n.message}</p>
                        <button onClick={() => dismiss(n.id)} style={{ color: 'var(--color-text-muted)', lineHeight: 0, flexShrink: 0 }}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* User menu */}
      <div style={{ position: 'relative' }}>
        <button onClick={() => setMenuOpen(v => !v)} aria-label={user ? user.full_name : 'User menu'} aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-100">
          <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
            {initials}
          </span>
          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.full_name ?? 'User'}
          </span>
        </button>

        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99 }} />
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 180, backgroundColor: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', padding: 4, zIndex: 100, animation: 'scale-in 150ms cubic-bezier(0.16,1,0.3,1)' }}>
              <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{user?.email}</div>
              </div>
              <button onClick={() => { setMenuOpen(false); navigate('/settings') }}
                className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-colors">
                <User size={15} strokeWidth={1.5} /> Profile & Settings
              </button>
              <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '4px 0' }} />
              <button onClick={() => { setMenuOpen(false); logout(); navigate('/login', { replace: true }) }}
                aria-label="Sign out"
                className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--color-status-danger)' }}>
                <LogOut size={15} strokeWidth={1.5} /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
