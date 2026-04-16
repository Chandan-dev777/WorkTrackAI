import type { StatusType } from '@/types/models'

const STATUS_COLORS: Record<StatusType, string> = {
  done:        '#10B981',
  in_progress: '#0EA5E9',
  blocked:     '#F43F5E',
  planned:     '#6B7280',
}

export interface StatusDotProps {
  status: StatusType
  /** Diameter in px — defaults to 8 */
  size?: number
  className?: string
}

/**
 * A small coloured circle representing a work item status.
 * Use consistently in tables, activity feeds, sidebar markers,
 * and employee cards instead of text-only status badges.
 */
export function StatusDot({ status, size = 8, className }: StatusDotProps) {
  return (
    <span
      aria-label={status.replace('_', ' ')}
      data-status={status}
      className={className}
      style={{
        display: 'inline-block',
        width:  size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
        background: STATUS_COLORS[status] ?? '#6B7280',
      }}
    />
  )
}
