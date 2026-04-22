import { motion } from 'framer-motion'
import { Clock, BarChart3, Users, AlertCircle, type LucideProps } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Sparkline } from '@/components/charts/Sparkline'
import { AnimatedNumber } from './AnimatedNumber'

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
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && onClick?.()}
      whileHover={{ y: -2, boxShadow: '0 0 0 3px rgba(99,102,241,0.25), 0 8px 24px rgba(0,0,0,0.2)' }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn('rounded-lg p-6 cursor-pointer', className)}
      style={{
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-subtle)',
        ...style,
      }}
    >
      {children}
    </motion.div>
  )
}

// ── Metric Card ──────────────────────────────────────────────────────────────

const ICONS: Record<IconName, LucideFC> = {
  clock: Clock,
  chart: BarChart3,
  users: Users,
  alert: AlertCircle,
}

export type MetricAccent = 'brand' | 'success' | 'danger' | 'warning' | 'info'

const ACCENT_STYLES: Record<MetricAccent, { bg: string; border: string; icon: string }> = {
  brand:   { bg: 'rgba(99,102,241,0.12)',  border: 'rgba(99,102,241,0.2)',  icon: 'var(--color-brand-primary)' },
  success: { bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.2)',  icon: '#10B981' },
  danger:  { bg: 'rgba(244,63,94,0.12)',   border: 'rgba(244,63,94,0.2)',   icon: '#F43F5E' },
  warning: { bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.2)',  icon: '#F59E0B' },
  info:    { bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.2)',  icon: '#0EA5E9' },
}

export interface MetricCardProps {
  label: string
  value: React.ReactNode
  trend?: number
  icon?: IconName
  /** Semantic colour accent — affects icon container colour */
  accent?: MetricAccent
  /** Optional 7-point sparkline shown bottom-right of the card */
  sparklineData?: number[]
  className?: string
}

export function MetricCard({ label, value, trend, icon, accent = 'brand', sparklineData, className }: MetricCardProps) {
  const Icon = icon ? ICONS[icon] : null
  const isPositive = trend !== undefined && trend >= 0
  const isNegative = trend !== undefined && trend < 0
  const accentStyle = ACCENT_STYLES[accent]

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
              background: accentStyle.bg,
              border: `1px solid ${accentStyle.border}`,
            }}
          >
            <Icon size={16} color={accentStyle.icon} />
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
      <div className="flex items-end justify-between gap-2">
        <p className="text-2xl font-bold font-mono" style={{ color: 'var(--color-text-primary)' }}>
          {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
        </p>
        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline
            data={sparklineData}
            width={64}
            height={24}
            color={accentStyle.icon}
          />
        )}
      </div>
    </Card>
  )
}
