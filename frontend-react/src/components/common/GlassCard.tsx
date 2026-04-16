import { cn } from '@/utils/cn'

export interface GlassCardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  /** If true, draws a gradient accent border (indigo→purple) */
  accent?: boolean
}

/**
 * Glassmorphism card — layered backdrop-blur surface with a subtle
 * top-shine line and optional gradient accent border.
 * Use for: AI insight cards, command palette, help widget, auth hero panels.
 */
export function GlassCard({ children, className, style, accent }: GlassCardProps) {
  return (
    <div
      className={cn('relative overflow-hidden rounded-2xl', className)}
      style={{
        background: accent
          ? 'var(--color-bg-surface)'
          : 'var(--color-bg-overlay)',
        backdropFilter: 'blur(12px) saturate(180%)',
        WebkitBackdropFilter: 'blur(12px) saturate(180%)',
        border: accent
          ? '1px solid transparent'
          : '1px solid var(--color-border-subtle)',
        backgroundClip: accent ? 'padding-box' : undefined,
        boxShadow: accent
          ? 'var(--shadow-md), inset 0 1px 0 rgba(255,255,255,0.05)'
          : 'var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)',
        ...(accent && {
          backgroundImage:
            'linear-gradient(var(--color-bg-surface), var(--color-bg-surface)), var(--gradient-brand)',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }),
        ...style,
      }}
    >
      {/* Top shine line */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
        }}
      />
      {children}
    </div>
  )
}
