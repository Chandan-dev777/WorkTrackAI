import { Zap, Shield, Eye, Brain, Users, AlertTriangle } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'

interface Props {
  onAccept: () => void
}

const POINTS = [
  {
    icon: Brain,
    color: '#6366F1',
    bg: 'rgba(99,102,241,0.12)',
    border: 'rgba(99,102,241,0.25)',
    title: 'AI processing of your work updates',
    body: 'The text you submit is processed by an AI language model (Claude / GPT) to extract structured task data. Your updates are sent to Merck-approved AI APIs and are not used to train external models.',
  },
  {
    icon: Eye,
    color: '#0EA5E9',
    bg: 'rgba(14,165,233,0.12)',
    border: 'rgba(14,165,233,0.25)',
    title: 'Shared with your manager and admins',
    body: 'Your submitted work logs, tasks, and hours are visible to your direct manager and anyone above them in the org hierarchy, as well as system administrators. This supports team coordination and operational awareness.',
  },
  {
    icon: Users,
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.25)',
    title: 'Org hierarchy and identity',
    body: 'Your name, email, Merck user ID, and reporting structure are stored to build the organisation chart and to scope data access by role. This data comes from your Merck SSO login.',
  },
  {
    icon: Shield,
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.25)',
    title: 'Data storage and security',
    body: 'All data is stored in a Merck-internal PostgreSQL database (Uptimize DBaaS) within the EU-Central AWS region. Access is controlled by IAM roles. No data leaves the Merck network.',
  },
]

export default function ConsentPage({ onAccept }: Props) {
  const theme = useThemeStore((s) => s.theme)

  return (
    <div
      data-theme={theme}
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--color-bg-base)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '48px 24px 80px',
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 640 }}>

        {/* Logo + header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: 'var(--gradient-brand)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
          }}>
            <Zap size={28} color="#fff" strokeWidth={2} />
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em',
            color: 'var(--color-text-primary)', margin: '0 0 10px',
          }}>
            Before you continue
          </h1>
          <p style={{
            fontSize: 15, color: 'var(--color-text-secondary)',
            lineHeight: 1.7, maxWidth: 480, margin: '0 auto',
          }}>
            DailyOps AI is an internal tool for capturing and reviewing work updates across your team.
            Please read the following before using the app.
          </p>
        </div>

        {/* Points */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
          {POINTS.map(({ icon: Icon, color, bg, border, title, body }) => (
            <div
              key={title}
              style={{
                display: 'flex', gap: 16, padding: '18px 20px',
                borderRadius: 12,
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                background: bg, border: `1px solid ${border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={20} color={color} strokeWidth={1.5} />
              </div>
              <div>
                <p style={{ margin: '0 0 5px', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {title}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
                  {body}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Warning note */}
        <div style={{
          display: 'flex', gap: 12, padding: '14px 18px',
          borderRadius: 10,
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.25)',
          marginBottom: 32,
        }}>
          <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            By clicking <strong style={{ color: 'var(--color-text-primary)' }}>Accept & Continue</strong>, you
            acknowledge that your work submissions will be processed by AI and visible to your management chain.
            If you have questions, contact your line manager or the DailyOps AI team before proceeding.
          </p>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={onAccept}
            style={{
              width: '100%', height: 50,
              background: 'var(--gradient-brand)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontSize: 15, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Accept & Continue
          </button>

          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
            This consent is stored in your browser. Clearing browser data will prompt this screen again.
          </p>
        </div>

      </div>
    </div>
  )
}
