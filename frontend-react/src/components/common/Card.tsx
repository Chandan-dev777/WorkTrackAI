import { Clock, BarChart3, Users, AlertCircle, type LucideProps } from 'lucide-react'
import { cn } from '@/utils/cn'

type IconName = 'clock' | 'chart' | 'users' | 'alert'
type LucideFC = React.ForwardRefExoticComponent<Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>>

// ── Base Card ────────────────────────────────────────────────────────────────

export interface CardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, className, style }: CardProps) {
  return (
    <div
      className={cn('rounded-lg p-6', className)}
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Interactive Card ─────────────────────────────────────────────────────────

export interface InteractiveCardProps extends CardProps {
  onClick?: () => void
}

export function InteractiveCard({ children, className, onClick, style }: InteractiveCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      className={cn('rounded-lg p-6 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md', className)}
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Metric Card ──────────────────────────────────────────────────────────────

const ICONS: Record<IconName, LucideFC> = {
  clock: Clock,
  chart: BarChart3,
  users: Users,
  alert: AlertCircle,
}

export interface MetricCardProps {
  label: string
  value: number | string
  trend?: number
  icon?: IconName
  className?: string
}

export function MetricCard({ label, value, trend, icon, className }: MetricCardProps) {
  const Icon = icon ? ICONS[icon] : null
  const isPositive = trend !== undefined && trend >= 0
  const isNegative = trend !== undefined && trend < 0

  return (
    <Card className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          {label}
        </span>
        {Icon && (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{
              background: 'rgba(99,102,241,0.12)',
              border: '1px solid rgba(99,102,241,0.2)',
            }}
          >
            <Icon size={16} color="var(--color-brand-primary)" />
          </div>
        )}
        {trend !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
              isPositive && 'text-emerald-400 bg-emerald-400/10 trend-positive',
              isNegative && 'text-rose-400 bg-rose-400/10 trend-negative',
            )}
          >
            {isPositive ? '↑' : '↓'}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
        {value}
      </p>
    </Card>
  )
}
