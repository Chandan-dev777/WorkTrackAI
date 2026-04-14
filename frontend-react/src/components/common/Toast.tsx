import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore, type ToastType } from '@/store/toastStore'
import { cn } from '@/utils/cn'

const CONFIG: Record<ToastType, { renderIcon: (color: string) => React.ReactNode; color: string; border: string }> = {
  success: { renderIcon: (c) => <CheckCircle size={18} color={c} aria-hidden="true" />, color: '#34D399', border: '#10B981' },
  error:   { renderIcon: (c) => <XCircle size={18} color={c} aria-hidden="true" />,    color: '#FB7185', border: '#F43F5E' },
  warning: { renderIcon: (c) => <AlertTriangle size={18} color={c} aria-hidden="true" />, color: '#FBBF24', border: '#F59E0B' },
  info:    { renderIcon: (c) => <Info size={18} color={c} aria-hidden="true" />,        color: '#38BDF8', border: '#0EA5E9' },
}

function ToastItem({ id, message, type, title }: { id: string; message: string; type: ToastType; title?: string }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const { renderIcon, color, border } = CONFIG[type]

  return (
    <div
      className={cn('flex items-start gap-3 rounded-xl p-4 w-80 shadow-xl')}
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-default)',
        borderLeft: `4px solid ${border}`,
      }}
      role="status"
      aria-live="polite"
    >
      <span style={{ flexShrink: 0, marginTop: 1, display: 'flex' }}>{renderIcon(color)}</span>
      <div className="flex-1 min-w-0">
        {title && (
          <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--color-text-primary)' }}>
            {title}
          </p>
        )}
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {message}
        </p>
      </div>
      <button
        type="button"
        onClick={() => removeToast(id)}
        aria-label="Dismiss"
        className="flex items-center justify-center w-5 h-5 rounded-md flex-shrink-0 hover:bg-[var(--color-bg-overlay)] transition-colors"
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-2"
      aria-label="Notifications"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  )
}
