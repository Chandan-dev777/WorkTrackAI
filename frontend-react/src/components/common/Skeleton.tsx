import { cn } from '@/utils/cn'

// ── Base Skeleton ─────────────────────────────────────────────────────────────

export interface SkeletonProps {
  className?: string
  style?: React.CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps) {
  return (
    <div
      className={cn('rounded-md skeleton-shimmer', className)}
      aria-busy="true"
      aria-label="Loading..."
      style={style}
    />
  )
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn('rounded-lg p-6 space-y-3', className)}
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}
    >
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-3 w-4/6" />
    </div>
  )
}

// ── Skeleton Table ────────────────────────────────────────────────────────────

export interface SkeletonTableProps {
  rows?: number
  cols?: number
  className?: string
}

export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonTableProps) {
  return (
    <table
      className={cn('w-full border-collapse', className)}
      aria-busy="true"
      aria-label="Loading table..."
    >
      <thead>
        <tr role="row">
          {Array.from({ length: cols }).map((_, ci) => (
            <th key={ci} role="columnheader" className="px-4 py-3">
              <Skeleton className="h-3 w-20" />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, ri) => (
          <tr key={ri} role="row">
            {Array.from({ length: cols }).map((_, ci) => (
              <td key={ci} role="cell" className="px-4 py-3">
                <Skeleton className="h-3 w-full" />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
