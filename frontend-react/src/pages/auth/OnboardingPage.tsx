import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Zap, ChevronRight, ChevronLeft, Users, User, Search } from 'lucide-react'
import { orgApi } from '@/api/org'
import type { UserSearchResult } from '@/api/org'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/utils/cn'

type Step = 1 | 2 | 3

export default function OnboardingPage() {
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)
  const setUser    = useAuthStore((s) => s.setUser)
  const theme      = useThemeStore((s) => s.theme)

  const [step, setStep]             = useState<Step>(1)
  const [fullName, setFullName]     = useState(user?.full_name ?? '')
  const [department, setDepartment] = useState(user?.department ?? '')
  const [teamName, setTeamName]     = useState(user?.team_name ?? '')
  const [role, setRole]             = useState<'employee' | 'manager'>('employee')
  const [managerId, setManagerId]   = useState<string | null>(null)
  const [managerName, setManagerName] = useState('')
  const [noManager, setNoManager]   = useState(false)
  const [searchQ, setSearchQ]       = useState('')
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Live search with debounce
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    if (searchQ.trim().length < 1) { setSearchResults([]); return }
    searchRef.current = setTimeout(() => {
      orgApi.searchUsers(searchQ).then(setSearchResults).catch(() => {})
    }, 300)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [searchQ])

  async function finish() {
    setSaving(true)
    setError(null)
    try {
      await orgApi.completeOnboarding({
        full_name: fullName.trim() || undefined,
        role,
        manager_id: noManager ? null : managerId,
        team_name: teamName.trim() || undefined,
        department: department.trim() || undefined,
      })
      if (user) {
        setUser({
          ...user,
          full_name: fullName.trim() || user.full_name,
          role,
          manager_id: noManager ? null : managerId,
          team_name: teamName.trim() || null,
          department: department.trim() || null,
          onboarding_complete: true,
        })
      }
      if (!user?.has_password) {
        navigate('/set-password', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch {
      setError('Failed to save. Please try again.')
      setSaving(false)
    }
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%', height: 42, padding: '0 12px', borderRadius: 8,
    border: '1px solid var(--color-border-default)',
    background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)',
    fontSize: 14, outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-base)' }} data-theme={theme}>
      <div style={{ width: '100%', maxWidth: 480, padding: '0 24px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ width: 52, height: 52, borderRadius: 13, background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
            <Zap size={26} color="#fff" strokeWidth={2} />
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 28 }}>
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} style={{ width: s === step ? 24 : 8, height: 8, borderRadius: 4, transition: 'all 300ms', background: s === step ? 'var(--color-brand-primary)' : s < step ? 'rgba(99,102,241,0.4)' : 'var(--color-border-default)' }} />
          ))}
        </div>

        {/* ── Step 1: Name & team ── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px', textAlign: 'center' }}>Welcome to DailyOps AI</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 28, textAlign: 'center' }}>Let's set up your profile. This takes 30 seconds.</p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Your name</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Full name" style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Department <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span></label>
              <input value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Data & AI" style={fieldStyle} />
            </div>
            <div style={{ marginBottom: 28 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>Team <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span></label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. GenMi" style={fieldStyle} />
            </div>

            <button onClick={() => setStep(2)} disabled={!fullName.trim()}
              style={{ width: '100%', height: 46, background: fullName.trim() ? 'var(--gradient-brand)' : 'var(--color-border-default)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600, cursor: fullName.trim() ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step 2: Role ── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px', textAlign: 'center' }}>What's your role?</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 28, textAlign: 'center' }}>This determines what you can see on the team dashboards.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
              {([
                { value: 'employee' as const, label: 'Individual Contributor', desc: 'I log my own work and report to a manager', icon: User },
                { value: 'manager'  as const, label: 'Team Manager', desc: 'I manage a team and want to see everyone\'s progress', icon: Users },
              ]).map(({ value, label, desc, icon: Icon }) => (
                <button key={value} onClick={() => setRole(value)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 18px', borderRadius: 10, border: `2px solid ${role === value ? 'var(--color-brand-primary)' : 'var(--color-border-default)'}`, background: role === value ? 'rgba(99,102,241,0.08)' : 'var(--color-bg-elevated)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 38, height: 38, borderRadius: 9, background: role === value ? 'rgba(99,102,241,0.15)' : 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={18} color={role === value ? 'var(--color-brand-primary)' : 'var(--color-text-muted)'} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</p>
                    <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>{desc}</p>
                  </div>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: '0 0 auto', height: 46, padding: '0 18px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 8, color: 'var(--color-text-secondary)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={() => setStep(3)} style={{ flex: 1, height: 46, background: 'var(--gradient-brand)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                Continue <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Manager ── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-text-primary)', margin: '0 0 6px', textAlign: 'center' }}>Who is your manager?</h2>
            <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 24, textAlign: 'center' }}>Search by name. This builds the org hierarchy.</p>

            {/* No manager toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, cursor: 'pointer' }}>
              <input type="checkbox" checked={noManager} onChange={e => { setNoManager(e.target.checked); if (e.target.checked) { setManagerId(null); setManagerName(''); setSearchQ('') } }}
                style={{ width: 16, height: 16, accentColor: 'var(--color-brand-primary)' }} />
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>I have no manager (I'm at the top level)</span>
            </label>

            {!noManager && (
              <div style={{ position: 'relative', marginBottom: 16 }}>
                <div style={{ position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                  <input value={managerId ? managerName : searchQ}
                    onChange={e => { setSearchQ(e.target.value); if (managerId) { setManagerId(null); setManagerName('') } }}
                    placeholder="Search by name…"
                    style={{ ...fieldStyle, paddingLeft: 34 }} />
                </div>

                {managerId && (
                  <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, color: 'var(--color-text-primary)', fontWeight: 500 }}>✓ {managerName}</span>
                    <button onClick={() => { setManagerId(null); setManagerName(''); setSearchQ('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)' }}>Change</button>
                  </div>
                )}

                {!managerId && searchResults.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, borderRadius: 8, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-surface)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                    {searchResults.map(u => (
                      <button key={u.id} onClick={() => { setManagerId(u.id); setManagerName(u.full_name); setSearchQ(''); setSearchResults([]) }}
                        style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2, borderBottom: '1px solid var(--color-border-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>{u.full_name}</span>
                        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{u.department ?? u.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && <p style={{ fontSize: 13, color: 'var(--color-status-danger)', marginBottom: 12 }}>{error}</p>}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setStep(2)} style={{ flex: '0 0 auto', height: 46, padding: '0 18px', background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border-default)', borderRadius: 8, color: 'var(--color-text-secondary)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChevronLeft size={16} /> Back
              </button>
              <button onClick={finish} disabled={saving || (!noManager && !managerId)}
                className={cn(!saving && (noManager || managerId) ? 'hover:opacity-90' : '')}
                style={{ flex: 1, height: 46, background: (!noManager && !managerId) ? 'var(--color-border-default)' : 'var(--gradient-brand)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 15, fontWeight: 600, cursor: (!noManager && !managerId) || saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Saving…' : 'Finish Setup →'}
              </button>
            </div>

            <p style={{ textAlign: 'center', marginTop: 14 }}>
              <button onClick={finish} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'underline', padding: 0 }}>
                Skip for now
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
