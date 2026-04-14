import { cn } from '@/utils/cn'

export type BadgeType = 'success' | 'warning' | 'danger' | 'info' | 'ai'

const typeStyles: Record<BadgeType, { bg: string; text: string; border: string; dot: string }> = {
  success: {
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
    text: '#34D399',
    dot: '#34D399',
  },
  warning: {
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    text: '#FBBF24',
    dot: '#FBBF24',
  },
  danger: {
    bg: 'rgba(244,63,94,0.12)',
    border: 'rgba(244,63,94,0.3)',
    text: '#FB7185',
    dot: '#FB7185',
  },
  info: {
    bg: 'rgba(14,165,233,0.12)',
    border: 'rgba(14,165,233,0.3)',
    text: '#38BDF8',
    dot: '#38BDF8',
  },
  ai: {
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.3)',
    text: '#A78BFA',
    dot: '#A78BFA',
  },
}

const typeClassMap: Record<BadgeType, string> = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  ai: 'badge-ai',
}

export interface StatusBadgeProps {
  type: BadgeType
  children: React.ReactNode
  className?: string
}

export function StatusBadge({ type, children, className }: StatusBadgeProps) {
  const s = typeStyles[type]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', typeClassMap[type], className)}
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        color: s.text,
      }}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: s.dot }}
        aria-hidden="true"
      />
      {children}
    </span>
  )
}

export interface CategoryTagProps {
  children: React.ReactNode
  className?: string
}

export function CategoryTag({ children, className }: CategoryTagProps) {
  return (
    <span
      className={cn('inline-flex items-center px-2.5 py-0.5 rounded-sm text-xs font-medium', className)}
      style={{
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-subtle)',
        color: 'var(--color-text-secondary)',
      }}
    >
      {children}
    </span>
  )
}

export interface CountBadgeProps {
  count: number
  className?: string
}

export function CountBadge({ count, className }: CountBadgeProps) {
  const display = count > 99 ? '99+' : String(count)
  return (
    <span
      className={cn('inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold bg-brand text-white', className)}
      style={{ background: 'var(--color-brand-primary)' }}
    >
      {display}
    </span>
  )
}
