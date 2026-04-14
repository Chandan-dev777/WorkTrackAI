import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, BrainCircuit, CheckCircle, Zap, BarChart3, MessageSquare } from 'lucide-react'
import { login } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils/cn'

const schema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

const FEATURES = [
  { icon: BrainCircuit, text: 'AI extracts structured data from plain English updates' },
  { icon: BarChart3,    text: 'Real-time dashboards for your team\'s work progress' },
  { icon: MessageSquare,text: 'Ask your data questions in natural language' },
  { icon: CheckCircle,  text: 'Role-aware views for employees, managers, and admins' },
]

export default function LoginPage() {
  const navigate     = useNavigate()
  const authLogin    = useAuthStore((s) => s.login)
  const [showPwd, setShowPwd]   = useState(false)
  const [serverErr, setServerErr] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerErr(null)
    try {
      const result = await login(data.email, data.password)
      authLogin(result.token, result.user)
      navigate('/dashboard', { replace: true })
    } catch {
      setServerErr('Invalid credentials. Please check your email and password.')
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-base)',
      }}
      data-theme="dark"
    >
      {/* ── Left panel — Brand ─────────────────────────────────────────── */}
      <div
        style={{
          flex: '0 0 55%',
          background: 'var(--gradient-glow-indigo)',
          backgroundColor: 'var(--color-bg-base)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative glow blob */}
        <div style={{
          position: 'absolute',
          top: '20%', left: '20%',
          width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 480, position: 'relative' }}>
          {/* Logo mark */}
          <div style={{
            width: 64, height: 64,
            borderRadius: 16,
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 24,
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          }}>
            <Zap size={32} color="#fff" strokeWidth={2} />
          </div>

          {/* Product name */}
          <h1 style={{
            fontSize: 48,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            margin: '0 0 12px',
            background: 'var(--gradient-brand)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            WorkTrack AI
          </h1>

          <p style={{
            fontSize: 18,
            color: 'var(--color-text-secondary)',
            marginBottom: 48,
            lineHeight: 1.6,
          }}>
            AI-powered work intelligence for modern teams
          </p>

          {/* Feature list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={16} color="var(--color-brand-primary)" strokeWidth={1.5} />
                </div>
                <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6, paddingTop: 8 }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel — Form ─────────────────────────────────────────── */}
      <div
        style={{
          flex: '0 0 45%',
          backgroundColor: 'var(--color-bg-surface)',
          borderLeft: '1px solid var(--color-border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 40px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.015em',
            color: 'var(--color-text-primary)',
            margin: '0 0 8px',
          }}>
            Welcome back
          </h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 32 }}>
            Sign in to your workspace
          </p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Server error */}
            {serverErr && (
              <div style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: 'rgba(244,63,94,0.1)',
                border: '1px solid rgba(244,63,94,0.3)',
                color: 'var(--color-status-danger)',
                fontSize: 13,
                marginBottom: 20,
              }}>
                {serverErr}
              </div>
            )}

            {/* Email */}
            <div style={{ marginBottom: 20 }}>
              <label
                htmlFor="email"
                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                {...register('email')}
                style={{
                  width: '100%',
                  height: 42,
                  padding: '0 12px',
                  borderRadius: 8,
                  border: `1px solid ${errors.email ? 'var(--color-status-danger)' : 'var(--color-border-default)'}`,
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  fontSize: 14,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 150ms, box-shadow 150ms',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = 'var(--color-brand-primary)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = errors.email ? 'var(--color-status-danger)' : 'var(--color-border-default)'
                  e.target.style.boxShadow = 'none'
                }}
              />
              {errors.email && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-status-danger)' }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div style={{ marginBottom: 24 }}>
              <label
                htmlFor="password"
                style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  style={{
                    width: '100%',
                    height: 42,
                    padding: '0 44px 0 12px',
                    borderRadius: 8,
                    border: `1px solid ${errors.password ? 'var(--color-status-danger)' : 'var(--color-border-default)'}`,
                    background: 'var(--color-bg-elevated)',
                    color: 'var(--color-text-primary)',
                    fontSize: 14,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 150ms, box-shadow 150ms',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'var(--color-brand-primary)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.15)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = errors.password ? 'var(--color-status-danger)' : 'var(--color-border-default)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((v) => !v)}
                  aria-label={showPwd ? 'Hide' : 'Show'}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-status-danger)' }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'w-full flex items-center justify-center gap-2 font-semibold rounded-md transition-all duration-150',
                isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.97]'
              )}
              style={{
                height: 48,
                background: isSubmitting ? 'var(--color-brand-primary)' : 'var(--gradient-brand)',
                border: 'none',
                color: '#fff',
                fontSize: 15,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: isSubmitting ? 'none' : '0 4px 15px rgba(99,102,241,0.3)',
                width: '100%',
              }}
            >
              {isSubmitting ? (
                <>
                  <span style={{
                    width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                  Signing in…
                </>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Footer note */}
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', marginTop: 32 }}>
            Don't have an account?{' '}
            <Link to="/register" style={{ color: 'var(--color-brand-primary)', textDecoration: 'none', fontWeight: 500 }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
