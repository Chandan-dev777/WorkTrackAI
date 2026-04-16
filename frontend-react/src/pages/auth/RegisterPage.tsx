import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Zap } from 'lucide-react'
import { register as registerUser } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'

// ── Validation schema ─────────────────────────────────────────────────────────

const schema = z.object({
  employee_id: z.string().min(1, 'Employee ID is required'),
  full_name:   z.string().min(1, 'Full name is required'),
  email:       z.string().min(1, 'Email is required').email('Invalid email address'),
  password:    z.string().min(8, 'Password must be at least 8 characters'),
  role:        z.enum(['employee']),
  team_name:   z.string().optional(),
})
type FormData = z.infer<typeof schema>

// ── Shared input style ────────────────────────────────────────────────────────

const inputBase: React.CSSProperties = {
  width: '100%', height: 42, padding: '0 12px',
  borderRadius: 8,
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-text-primary)',
  fontSize: 14, outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 150ms, box-shadow 150ms',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const navigate   = useNavigate()
  const authLogin  = useAuthStore((s) => s.login)
  const [showPwd, setShowPwd]     = useState(false)
  const [serverErr, setServerErr] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { role: 'employee' } })

  async function onSubmit(data: FormData) {
    setServerErr(null)
    try {
      const result = await registerUser({
        employee_id: data.employee_id,
        full_name:   data.full_name,
        email:       data.email,
        password:    data.password,
        role:        data.role,
        team_name:   data.team_name || undefined,
      })
      authLogin(result.token, result.user)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setServerErr(detail ?? 'Registration failed. Please try again.')
    }
  }

  function fieldStyle(hasError: boolean): React.CSSProperties {
    return { ...inputBase, border: `1px solid ${hasError ? 'var(--color-status-danger)' : 'var(--color-border-default)'}` }
  }

  function onFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
    e.target.style.borderColor = 'var(--color-brand-primary)'
    e.target.style.boxShadow   = '0 0 0 3px rgba(99,102,241,0.15)'
  }

  function onBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>, hasError: boolean) {
    e.target.style.borderColor = hasError ? 'var(--color-status-danger)' : 'var(--color-border-default)'
    e.target.style.boxShadow   = 'none'
  }

  const errText = (msg?: string) => msg
    ? <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-status-danger)' }}>{msg}</p>
    : null

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--color-bg-base)' }} data-theme="dark">

      {/* ── Left panel — Brand ─────────────────────────────────────────────── */}
      <div style={{
        flex: '0 0 45%', backgroundColor: 'var(--color-bg-base)',
        background: 'var(--gradient-glow-indigo)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: '48px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '20%', left: '20%',
          width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{ maxWidth: 360, position: 'relative', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'var(--gradient-brand)', margin: '0 auto 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          }}>
            <Zap size={32} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{
            fontSize: 40, fontWeight: 700, letterSpacing: '-0.02em',
            lineHeight: 1.15, margin: '0 0 12px',
            background: 'var(--gradient-brand)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            WorkTrack AI
          </h1>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            AI-powered work intelligence for modern teams.
            Join your organisation and start tracking your work.
          </p>
        </div>
      </div>

      {/* ── Right panel — Register form ────────────────────────────────────── */}
      <div style={{
        flex: '0 0 55%', backgroundColor: 'var(--color-bg-surface)',
        borderLeft: '1px solid var(--color-border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 40px', overflowY: 'auto',
      }}>
        <div style={{ width: '100%', maxWidth: 440 }}>
          <h2 style={{
            fontSize: 28, fontWeight: 700, letterSpacing: '-0.015em',
            color: 'var(--color-text-primary)', margin: '0 0 6px',
          }}>
            Create an account
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 28 }}>
            Set up your WorkTrack AI profile
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>

            {/* Server error */}
            {serverErr && (
              <div style={{
                padding: '12px 14px', borderRadius: 8, marginBottom: 20,
                background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
                color: 'var(--color-status-danger)', fontSize: 13,
              }}>
                {serverErr}
              </div>
            )}

            {/* Row 1: Employee ID + Full Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div>
                <label htmlFor="employee_id" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                  Employee ID <span style={{ color: 'var(--color-status-danger)' }}>*</span>
                </label>
                <input id="employee_id" type="text" placeholder="EMP-001"
                  {...register('employee_id')}
                  style={fieldStyle(!!errors.employee_id)}
                  onFocus={onFocus}
                  onBlur={e => onBlur(e, !!errors.employee_id)}
                />
                {errText(errors.employee_id?.message)}
              </div>
              <div>
                <label htmlFor="full_name" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                  Full Name <span style={{ color: 'var(--color-status-danger)' }}>*</span>
                </label>
                <input id="full_name" type="text" placeholder="Jane Smith"
                  {...register('full_name')}
                  style={fieldStyle(!!errors.full_name)}
                  onFocus={onFocus}
                  onBlur={e => onBlur(e, !!errors.full_name)}
                />
                {errText(errors.full_name?.message)}
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="email" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Email address <span style={{ color: 'var(--color-status-danger)' }}>*</span>
              </label>
              <input id="email" type="email" placeholder="you@company.com"
                autoComplete="email"
                {...register('email')}
                style={fieldStyle(!!errors.email)}
                onFocus={onFocus}
                onBlur={e => onBlur(e, !!errors.email)}
              />
              {errText(errors.email?.message)}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="password" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                Password <span style={{ color: 'var(--color-status-danger)' }}>*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input id="password"
                  type={showPwd ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  {...register('password')}
                  style={{ ...fieldStyle(!!errors.password), padding: '0 44px 0 12px' }}
                  onFocus={onFocus}
                  onBlur={e => onBlur(e, !!errors.password)}
                />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center',
                  }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errText(errors.password?.message)}
            </div>

            {/* Row 2: Role + Team Name */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              <div>
                <label htmlFor="role" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                  Role
                </label>
                <select id="role"
                  {...register('role')}
                  style={{ ...fieldStyle(false), padding: '0 12px', cursor: 'pointer' }}
                  onFocus={onFocus}
                  onBlur={e => onBlur(e, false)}>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div>
                <label htmlFor="team_name" style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                  Team Name
                </label>
                <input id="team_name" type="text" placeholder="e.g. Engineering"
                  {...register('team_name')}
                  style={fieldStyle(false)}
                  onFocus={onFocus}
                  onBlur={e => onBlur(e, false)}
                />
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={isSubmitting}
              className={cn(
                'w-full flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-150',
                isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.97]'
              )}
              style={{
                height: 48, width: '100%',
                background: isSubmitting ? 'var(--color-brand-primary)' : 'var(--gradient-brand)',
                border: 'none', color: '#fff', fontSize: 15,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: isSubmitting ? 'none' : '0 4px 15px rgba(99,102,241,0.3)',
              }}>
              {isSubmitting ? (
                <>
                  <span style={{
                    width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Creating account…
                </>
              ) : 'Create Account'}
            </button>
          </form>

          {/* Sign in link */}
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', marginTop: 24 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--color-brand-primary)', textDecoration: 'none', fontWeight: 500 }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
