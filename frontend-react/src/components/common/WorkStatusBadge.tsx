/**
 * Shared work-item status badge.
 * Replaces the local StatusBadge copies in DashboardPage and TeamDashboardPage.
 */
const STATUS_COLOR: Record<string, string> = {
  done:        '#10B981',
  in_progress: '#0EA5E9',
  blocked:     '#F43F5E',
  planned:     '#9CA3AF',
}

export function WorkStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
  const color = STATUS_COLOR[status] ?? '#9CA3AF'
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: `${color}18`, border: `1px solid ${color}4D`, color }}
    >
      {status.replace('_', ' ')}
    </span>
  )
}
