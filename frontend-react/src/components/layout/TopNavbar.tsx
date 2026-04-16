import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LogOut, User } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/utils/cn'

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('')
}

export function TopNavbar() {
  const user        = useAuthStore((s) => s.user)
  const logout      = useAuthStore((s) => s.logout)
  const theme       = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const navigate    = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const initials = user ? getInitials(user.full_name) : '?'

  return (
    <header
      style={{
        height: 56,
        backgroundColor: 'var(--color-bg-surface)',
        borderBottom: '1px solid var(--color-border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Brand */}
      <span
        style={{
          fontWeight: 700,
          fontSize: 18,
          background: 'var(--gradient-brand)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          userSelect: 'none',
          minWidth: 140,
        }}
      >
        WorkTrack AI
      </span>

      <div style={{ flex: 1 }} />

      {/* Animated theme toggle — spring pill */}
      <button
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        className={cn('relative flex items-center rounded-full transition-colors duration-200', theme === 'dark' ? 'bg-indigo-900/40' : 'bg-amber-100')}
        style={{ width: 44, height: 24, padding: '0 3px', flexShrink: 0 }}
      >
        <motion.div
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px]"
          style={{
            background: theme === 'dark' ? '#818cf8' : '#f59e0b',
            marginLeft: theme === 'dark' ? 'auto' : '0',
          }}
        >
          {theme === 'dark' ? '🌙' : '☀️'}
        </motion.div>
      </button>

      {/* User menu */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={user ? user.full_name : 'User menu'}
          aria-expanded={menuOpen}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-100"
        >
          {/* Avatar circle */}
          <span
            style={{
              width: 32, height: 32,
              borderRadius: '50%',
              background: 'var(--gradient-brand)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </span>
          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.full_name ?? 'User'}
          </span>
        </button>

        {/* Dropdown menu */}
        {menuOpen && (
          <>
            {/* Backdrop to close */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
            />
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                minWidth: 180,
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-default)',
                borderRadius: 12,
                boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
                padding: 4,
                zIndex: 100,
                animation: 'scale-in 150ms cubic-bezier(0.16,1,0.3,1)',
              }}
            >
              <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--color-border-subtle)', marginBottom: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>{user?.full_name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{user?.email}</div>
              </div>

              <button
                onClick={() => { setMenuOpen(false); navigate('/settings') }}
                className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-overlay hover:text-text-primary transition-colors"
              >
                <User size={15} strokeWidth={1.5} />
                Profile
              </button>

              <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '4px 0' }} />

              <button
                onClick={() => { setMenuOpen(false); logout(); navigate('/login', { replace: true }) }}
                aria-label="Sign out"
                className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm transition-colors"
                style={{ color: 'var(--color-status-danger)' }}
              >
                <LogOut size={15} strokeWidth={1.5} />
                Sign Out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
