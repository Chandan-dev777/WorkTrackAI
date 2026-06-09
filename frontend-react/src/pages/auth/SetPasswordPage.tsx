import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Shield, Zap } from 'lucide-react'
import { setPassword } from '@/api/auth'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { cn } from '@/utils/cn'

const schema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string().min(1, 'Please confirm your password'),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})
type FormData = z.infer<typeof schema>

export default function SetPasswordPage() {
  const navigate  = useNavigate()
  const user      = useAuthStore((s) => s.user)
  const setUser   = useAuthStore((s) => s.setUser)
  const theme     = useThemeStore((s) => s.theme)
  const [serverErr, setServerErr] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormData) {
    setServerErr(null)
    try {
      await setPassword(data.password)
      if (user) setUser({ ...user, has_password: true })
      navigate('/dashboard', { replace: true })
    } catch {
      setServerErr('Failed to set password. Please try again.')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: 'var(--color-bg-base)' }} data-theme={theme}>
      <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
        {/* Icon */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--gradient-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(99,102,241,0.4)' }}>
            <Zap size={28} color="#fff" strokeWidth={2} />
          </div>
        </div>

        <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.015em', color: 'var(--color-text-primary)', margin: '0 0 8px', textAlign: 'center' }}>
          Set a backup password
        </h2>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 8, textAlign: 'center', lineHeight: 1.6 }}>
          You're signed in via Merck SSO. Set an app password so you can still log in if SSO is unavailable.
        </p>

        {/* Security note */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', marginBottom: 28 }}>
          <Shield size={16} color="var(--color-brand-primary)" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
            This is separate from your Merck account password. Used only for this app as a failsafe.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          {serverErr && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', color: 'var(--color-status-danger)', fontSize: 13, marginBottom: 20 }}>
              {serverErr}
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              New password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Min 8 characters"
              {...register('password')}
              style={{ width: '100%', height: 42, padding: '0 12px', borderRadius: 8, border: `1px solid ${errors.password ? 'var(--color-status-danger)' : 'var(--color-border-default)'}`, background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            {errors.password && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-status-danger)' }}>{errors.password.message}</p>}
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
              Confirm password
            </label>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Repeat password"
              {...register('confirm')}
              style={{ width: '100%', height: 42, padding: '0 12px', borderRadius: 8, border: `1px solid ${errors.confirm ? 'var(--color-status-danger)' : 'var(--color-border-default)'}`, background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            {errors.confirm && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-status-danger)' }}>{errors.confirm.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={cn('w-full font-semibold rounded-md transition-all duration-150', isSubmitting ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90 active:scale-[0.97]')}
            style={{ height: 48, background: 'var(--gradient-brand)', border: 'none', color: '#fff', fontSize: 15, cursor: isSubmitting ? 'not-allowed' : 'pointer', boxShadow: '0 4px 15px rgba(99,102,241,0.3)', width: '100%' }}
          >
            {isSubmitting ? 'Saving…' : 'Set Password'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20 }}>
          <button
            onClick={() => navigate('/dashboard', { replace: true })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'underline', padding: 0 }}
          >
            Skip for now
          </button>
        </p>
      </div>
    </div>
  )
}
