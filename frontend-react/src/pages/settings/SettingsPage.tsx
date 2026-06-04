import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Palette, LogOut, Shield, Info, Target, Lock, Bell, Globe } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { GoalRing } from '@/components/charts/GoalRing'
import { adminApi } from '@/api/admin'
import { cn } from '@/utils/cn'

const WEEKLY_GOAL_KEY = 'dailyops_weekly_goal'
function loadGoal(): number {
  const v = localStorage.getItem(WEEKLY_GOAL_KEY)
  return v ? Math.max(10, Math.min(80, Number(v))) : 40
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = 'profile' | 'appearance' | 'goals' | 'notifications' | 'preferences' | 'security' | 'account'

interface NavItem { id: Section; label: string; icon: React.ElementType }

const NAV: NavItem[] = [
  { id: 'profile',       label: 'Profile',       icon: User    },
  { id: 'appearance',    label: 'Appearance',    icon: Palette },
  { id: 'goals',         label: 'Goals',         icon: Target  },
  { id: 'notifications', label: 'Notifications', icon: Bell    },
  { id: 'preferences',   label: 'Preferences',   icon: Globe   },
  { id: 'security',      label: 'Security',      icon: Lock    },
  { id: 'account',       label: 'Account',       icon: Shield  },
]

// ── Notification + timezone helpers ───────────────────────────────────────────

const NOTIF_KEY = 'dailyops_notif_prefs'
const TZ_KEY    = 'dailyops_timezone'

function loadNotifPrefs() {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY) ?? '{}') } catch { return {} }
}

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto',  'America/Vancouver', 'America/Sao_Paulo', 'America/Mexico_City',
  'Europe/London',    'Europe/Paris',    'Europe/Berlin',    'Europe/Amsterdam',
  'Europe/Rome',      'Europe/Madrid',   'Europe/Stockholm', 'Europe/Warsaw',
  'Europe/Istanbul',  'Europe/Moscow',
  'Asia/Dubai',       'Asia/Kolkata',    'Asia/Bangkok',     'Asia/Singapore',
  'Asia/Shanghai',    'Asia/Tokyo',      'Asia/Seoul',       'Asia/Jakarta',
  'Australia/Sydney', 'Australia/Melbourne', 'Pacific/Auckland',
  'Africa/Cairo',     'Africa/Johannesburg', 'Africa/Lagos',
] as const

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
  const [weeklyGoal, setWeeklyGoal]       = useState(loadGoal)
  const [currentPw, setCurrentPw]         = useState('')
  const [newPw, setNewPw]                 = useState('')
  const [confirmPw, setConfirmPw]         = useState('')
  const [changingPw, setChangingPw]       = useState(false)

  // Notification preferences (localStorage-backed)
  const [emailDigest,   setEmailDigest]   = useState<'off' | 'daily' | 'weekly'>(() => loadNotifPrefs().emailDigest   ?? 'off')
  const [reminderTime,  setReminderTime]  = useState<string>(() => loadNotifPrefs().reminderTime  ?? '09:00')
  const [browserNotifs, setBrowserNotifs] = useState<boolean>(() => loadNotifPrefs().browserNotifs ?? false)

  // Timezone preference (localStorage-backed)
  const [timezone, setTimezone] = useState<string>(
    () => localStorage.getItem(TZ_KEY) ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  )

  function saveNotifPrefs(patch: Partial<{ emailDigest: string; reminderTime: string; browserNotifs: boolean }>) {
    const next = { emailDigest, reminderTime, browserNotifs, ...patch }
    localStorage.setItem(NOTIF_KEY, JSON.stringify(next))
  }

  async function handleChangePassword() {
    if (newPw.length < 8) { toast.error('New password must be at least 8 characters'); return }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return }
    setChangingPw(true)
    try {
      await adminApi.changePassword(currentPw, newPw)
      toast.success('Password changed successfully')
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to change password'
      toast.error(msg)
    } finally { setChangingPw(false) }
  }

  const pwStrength = (() => {
    if (!newPw) return 0
    let s = 0
    if (newPw.length >= 8)  s++
    if (newPw.length >= 12) s++
    if (/[A-Z]/.test(newPw) && /[a-z]/.test(newPw)) s++
    if (/[0-9]/.test(newPw)) s++
    if (/[^A-Za-z0-9]/.test(newPw)) s++
    return Math.min(s, 4)
  })()
  const pwStrengthLabel = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'][pwStrength]
  const pwStrengthColor = ['', '#F43F5E', '#F59E0B', '#10B981', '#6366F1'][pwStrength]

  function handleGoalChange(val: number) {
    setWeeklyGoal(val)
    localStorage.setItem(WEEKLY_GOAL_KEY, String(val))
  }

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
                  Your account information as registered in DailyOps AI.
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
                Choose how DailyOps AI looks for you.
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

          {/* ── GOALS ── */}
          {activeSection === 'goals' && (
            <div style={sectionCard}>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Goals</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                Set your weekly hours target. This drives the Goal Ring on your Home Dashboard.
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
                {/* Slider */}
                <div style={{ flex: 1 }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                      Weekly hours goal
                    </span>
                    <span className="text-lg font-bold font-mono" style={{ color: 'var(--color-brand-primary)' }}>
                      {weeklyGoal}h
                    </span>
                  </div>
                  <input
                    type="range"
                    min={10} max={80} step={5}
                    value={weeklyGoal}
                    onChange={e => handleGoalChange(Number(e.target.value))}
                    aria-label="Weekly hours goal"
                    style={{ width: '100%', accentColor: 'var(--color-brand-primary)', cursor: 'pointer' }}
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    <span>10h</span><span>40h</span><span>80h</span>
                  </div>
                  <p className="text-xs mt-4" style={{ color: 'var(--color-text-muted)' }}>
                    Saved automatically to your browser. Changes apply immediately on the dashboard.
                  </p>
                </div>

                {/* Live preview ring */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <GoalRing current={Math.round(weeklyGoal * 0.65)} target={weeklyGoal} label="Preview" size={100} />
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Live preview</span>
                </div>
              </div>
            </div>
          )}

          {/* ── NOTIFICATIONS ── */}
          {activeSection === 'notifications' && (
            <div style={sectionCard}>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Notifications</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                Control how and when DailyOps AI notifies you about your work activity.
              </p>

              {/* Email digest */}
              <div style={{ paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid var(--color-border-subtle)' }}>
                <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text-primary)' }}>Email Digest</p>
                <div className="flex flex-col gap-2">
                  {(['off', 'daily', 'weekly'] as const).map(opt => (
                    <label key={opt} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="emailDigest"
                        value={opt}
                        checked={emailDigest === opt}
                        onChange={() => { setEmailDigest(opt); saveNotifPrefs({ emailDigest: opt }) }}
                        style={{ accentColor: 'var(--color-brand-primary)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                        {opt === 'off' ? 'Off — no email digest' : opt === 'daily' ? 'Daily — sent each morning' : 'Weekly — sent every Monday'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Daily reminder time */}
              <div style={{ paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid var(--color-border-subtle)' }}>
                <label htmlFor="reminder-time" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Daily Reminder Time
                </label>
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                  A reminder to submit your daily work update.
                </p>
                <input
                  id="reminder-time"
                  type="time"
                  value={reminderTime}
                  onChange={e => { setReminderTime(e.target.value); saveNotifPrefs({ reminderTime: e.target.value }) }}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', outline: 'none' }}
                />
              </div>

              {/* Browser notifications */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-primary)' }}>Browser Notifications</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={browserNotifs}
                    onChange={e => { setBrowserNotifs(e.target.checked); saveNotifPrefs({ browserNotifs: e.target.checked }) }}
                    style={{ accentColor: 'var(--color-brand-primary)', width: 16, height: 16 }}
                  />
                  <div>
                    <span className="text-sm" style={{ color: 'var(--color-text-primary)' }}>Enable browser notifications</span>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      Requires browser permission. For future Web Push support.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ── PREFERENCES ── */}
          {activeSection === 'preferences' && (
            <div style={sectionCard}>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Preferences</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                Regional and display preferences for your DailyOps AI workspace.
              </p>

              {/* Timezone */}
              <div>
                <label htmlFor="timezone-select" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--color-text-primary)' }}>
                  Timezone
                </label>
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                  Used to display work dates and times in your local time.
                </p>
                <select
                  id="timezone-select"
                  aria-label="Timezone"
                  value={timezone}
                  onChange={e => { setTimezone(e.target.value); localStorage.setItem(TZ_KEY, e.target.value); toast.success('Timezone saved') }}
                  className="rounded-lg px-3 py-2 text-sm"
                  style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', outline: 'none', minWidth: 280 }}
                >
                  {COMMON_TIMEZONES.map(tz => (
                    <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <p className="text-xs mt-3" style={{ color: 'var(--color-text-muted)' }}>
                  Detected: {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </p>
              </div>
            </div>
          )}

          {/* ── SECURITY ── */}
          {activeSection === 'security' && (
            <div style={sectionCard}>
              <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>Security</h2>
              <p className="text-xs mb-6" style={{ color: 'var(--color-text-secondary)' }}>
                Change your password. Use a strong, unique password you don't use elsewhere.
              </p>

              <div className="flex flex-col gap-4" style={{ maxWidth: 400 }}>
                {[
                  { label: 'Current password', value: currentPw, onChange: setCurrentPw, id: 'cur-pw' },
                  { label: 'New password',      value: newPw,     onChange: setNewPw,     id: 'new-pw' },
                  { label: 'Confirm new password', value: confirmPw, onChange: setConfirmPw, id: 'conf-pw' },
                ].map(f => (
                  <div key={f.id}>
                    <label htmlFor={f.id} className="block text-xs font-medium mb-1.5"
                      style={{ color: 'var(--color-text-secondary)' }}>{f.label}</label>
                    <input id={f.id} type="password" value={f.value} onChange={e => f.onChange(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', color: 'var(--color-text-primary)', outline: 'none' }} />
                  </div>
                ))}

                {/* Strength meter */}
                {newPw.length > 0 && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: 'var(--color-text-muted)' }}>Password strength</span>
                      <span style={{ color: pwStrengthColor, fontWeight: 600 }}>{pwStrengthLabel}</span>
                    </div>
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className="flex-1 h-1.5 rounded-full transition-all"
                          style={{ background: i <= pwStrength ? pwStrengthColor : 'var(--color-border-default)' }} />
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleChangePassword} disabled={changingPw || !currentPw || !newPw || !confirmPw}
                  className="rounded-lg px-4 py-2 text-sm font-semibold transition-all"
                  style={{
                    background: 'var(--color-brand-primary)', color: '#fff',
                    opacity: changingPw || !currentPw || !newPw || !confirmPw ? 0.5 : 1,
                    cursor: changingPw || !currentPw || !newPw || !confirmPw ? 'not-allowed' : 'pointer',
                  }}>
                  {changingPw ? 'Changing…' : 'Change Password'}
                </button>
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

              {/* Account info */}
              <div className="rounded-lg p-4 mb-4" style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-subtle)' }}>
                {[
                  { label: 'Employee ID', value: user?.employee_id ?? '—' },
                  { label: 'Role',        value: user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : '—' },
                  { label: 'Team',        value: user?.team_name ?? '—' },
                  { label: 'Connected via', value: 'DailyOps AI' },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid var(--color-border-subtle)' }}
                    className="last:border-b-0">
                    <span style={{ width: 140, fontSize: 12, color: 'var(--color-text-muted)', flexShrink: 0 }}>{r.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-primary)', fontWeight: 500 }}>{r.value}</span>
                  </div>
                ))}
              </div>

              <div style={{ paddingTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Sign out</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                      You will be returned to the login page.
                    </p>
                  </div>
                  <button onClick={handleSignOut} aria-label="Sign out"
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                    style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: '#FB7185', cursor: 'pointer' }}>
                    <LogOut size={14} /> Sign Out
                  </button>
                </div>
                <div style={{ paddingTop: 12 }}>
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
