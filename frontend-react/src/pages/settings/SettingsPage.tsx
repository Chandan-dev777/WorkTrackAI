import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Palette, LogOut, Shield, Info } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/utils/cn'

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = 'profile' | 'appearance' | 'account'

interface NavItem { id: Section; label: string; icon: React.ElementType }

const NAV: NavItem[] = [
  { id: 'profile',    label: 'Profile',    icon: User    },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'account',    label: 'Account',    icon: Shield  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const sectionCard: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '12px',
  padding: '24px',
  marginBottom: '16px',
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', padding: '14px 0', borderBottom: '1px solid var(--color-border-subtle)' }}
      className="last:border-b-0">
      <span style={{ width: 160, fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', flexShrink: 0 }}>
        {label}
      </span>
      <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{value}</span>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const navigate   = useNavigate()
  const user       = useAuthStore(s => s.user)
  const logout     = useAuthStore(s => s.logout)
  const theme      = useThemeStore(s => s.theme)
  const setTheme   = useThemeStore(s => s.setTheme)

  const [activeSection, setActiveSection] = useState<Section>('profile')

  function handleSignOut() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto p-6" style={{ maxWidth: '1100px' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          Manage your account preferences
        </p>
      </div>

      <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

        {/* Left nav */}
        <nav style={{
          width: 200, flexShrink: 0,
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 12, padding: 8,
        }}>
          {NAV.map(item => {
            const Icon = item.icon
            const active = activeSection === item.id
            return (
              <button key={item.id}
                onClick={() => setActiveSection(item.id)}
                aria-label={item.label}
                className={cn('w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors')}
                style={{
                  background: active ? 'rgba(99,102,241,0.1)' : 'transparent',
                  color: active ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  marginBottom: 2,
                }}>
                <Icon size={15} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* Right content */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ── PROFILE ── */}
          {activeSection === 'profile' && (
            <>
              <div style={sectionCard}>
                <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Profile
                </h2>
                <p className="text-xs mb-5" style={{ color: 'var(--color-text-secondary)' }}>
                  Your account information as registered in WorkTrack AI.
                </p>

                {user && (
                  <div>
                    <Row label="Full Name"    value={user.full_name} />
                    <Row label="Email"        value={user.email} />
                    <Row label="Employee ID"  value={user.employee_id} />
                    <Row label="Role"         value={user.role.charAt(0).toUpperCase() + user.role.slice(1)} />
                    <Row label="Team"         value={user.team_name ?? '—'} />
                    <Row label="Department"   value={user.department ?? '—'} />
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 px-4 py-3 rounded-lg text-xs"
                style={{ background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)', color: '#38BDF8' }}>
                <Info size={13} className="mt-0.5 shrink-0" />
                <span>
                  Profile details are managed by your administrator. Contact your admin to update your name, email, or team assignment.
                </span>
              </div>
            </>
          )}

          {/* ── APPEARANCE ── */}
          {activeSection === 'appearance' && (
            <div style={sectionCard}>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Appearance
              </h2>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                Choose how WorkTrack AI looks for you.
              </p>

              {/* Theme selector */}
              <div style={{ paddingBottom: 20, borderBottom: '1px solid var(--color-border-subtle)' }}>
                <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>
                  Theme
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  {(['dark', 'light'] as const).map(t => (
                    <button key={t}
                      onClick={() => setTheme(t)}
                      aria-label={t.charAt(0).toUpperCase() + t.slice(1)}
                      className="flex flex-col items-center gap-2 rounded-xl p-3 transition-all"
                      style={{
                        width: 120, cursor: 'pointer',
                        border: `2px solid ${theme === t ? 'var(--color-brand-primary)' : 'var(--color-border-default)'}`,
                        background: theme === t ? 'rgba(99,102,241,0.08)' : 'var(--color-bg-elevated)',
                      }}>
                      {/* Theme preview swatch */}
                      <div style={{
                        width: 80, height: 48, borderRadius: 8, overflow: 'hidden',
                        background: t === 'dark' ? '#0A0F1A' : '#F9FAFB',
                        border: '1px solid var(--color-border-subtle)',
                        display: 'flex', flexDirection: 'column',
                      }}>
                        <div style={{ height: 12, background: t === 'dark' ? '#111827' : '#FFFFFF', borderBottom: `1px solid ${t === 'dark' ? '#1F2937' : '#E5E7EB'}` }} />
                        <div style={{ flex: 1, display: 'flex', gap: 4, padding: '4px 6px' }}>
                          <div style={{ width: 16, background: t === 'dark' ? '#1F2937' : '#F3F4F6', borderRadius: 2 }} />
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <div style={{ height: 4, background: t === 'dark' ? '#374151' : '#E5E7EB', borderRadius: 2 }} />
                            <div style={{ height: 4, width: '70%', background: t === 'dark' ? '#374151' : '#E5E7EB', borderRadius: 2 }} />
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-medium" style={{
                        color: theme === t ? 'var(--color-brand-primary)' : 'var(--color-text-secondary)',
                      }}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── ACCOUNT ── */}
          {activeSection === 'account' && (
            <div style={sectionCard}>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Account
              </h2>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                Manage your session.
              </p>

              <div style={{ paddingTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Sign out</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      You will be returned to the login page.
                    </p>
                  </div>
                  <button onClick={handleSignOut}
                    aria-label="Sign out"
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                    style={{
                      background: 'rgba(244,63,94,0.1)',
                      border: '1px solid rgba(244,63,94,0.25)',
                      color: '#FB7185', cursor: 'pointer',
                    }}>
                    <LogOut size={14} />
                    Sign Out
                  </button>
                </div>

                <div style={{ paddingTop: 16 }}>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    Signed in as <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>{user?.email}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
