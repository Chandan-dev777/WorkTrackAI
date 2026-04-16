import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  PlusCircle, MessageSquare, BarChart3, Users, Shield,
  Clock, CheckCircle, AlertCircle, ArrowRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { dashboardApi } from '@/api/dashboard'
import { worklogsApi } from '@/api/worklogs'
import { SkeletonCard } from '@/components/common/Skeleton'
import { formatRelative } from '@/utils/formatDate'
import { canAccess } from '@/utils/roleGuard'
import type { Role } from '@/utils/roleGuard'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getThisWeekParams() {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 6) // last 7 days
  return {
    start_date: start.toISOString().split('T')[0],
    end_date:   today.toISOString().split('T')[0],
  }
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function formatTodayLong() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

// ── Quick action item ─────────────────────────────────────────────────────────

interface ActionItem {
  label: string
  to: string
  icon: React.ElementType
  description: string
  style: 'primary' | 'ai' | 'secondary'
  minRole: Role
}

const ACTIONS: ActionItem[] = [
  { label: 'Submit Update',   to: '/submit',       icon: PlusCircle,    description: 'Log what you worked on today',      style: 'primary',   minRole: 'employee' },
  { label: 'Chat Assistant',  to: '/chat',         icon: MessageSquare, description: 'Ask questions about your work data', style: 'ai',        minRole: 'employee' },
  { label: 'My Dashboard',    to: '/my-dashboard', icon: BarChart3,     description: 'View your analytics and work items', style: 'secondary', minRole: 'employee' },
  { label: 'Team Dashboard',  to: '/team',         icon: Users,         description: 'Overview of your team\'s progress',  style: 'secondary', minRole: 'manager'  },
  { label: 'Admin Panel',     to: '/admin',        icon: Shield,        description: 'Manage users and system settings',   style: 'secondary', minRole: 'admin'    },
]

const STATUS_COLOR: Record<string, string> = {
  done: '#10B981', in_progress: '#0EA5E9', blocked: '#F43F5E', planned: '#9CA3AF',
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomeDashboard() {
  const user     = useAuthStore(s => s.user)
  const userRole = (user?.role ?? 'employee') as Role
  const firstName = user?.full_name.split(' ')[0] ?? 'there'

  const weekParams = useMemo(() => getThisWeekParams(), [])

  const summaryQ = useQuery({
    queryKey: ['home-summary', weekParams.start_date],
    queryFn: () => dashboardApi.getSummary(weekParams),
    placeholderData: keepPreviousData,
  })

  const itemsQ = useQuery({
    queryKey: ['home-recent-items'],
    queryFn: () => worklogsApi.getMy(weekParams),
    placeholderData: keepPreviousData,
  })

  const visibleActions = ACTIONS.filter(a => canAccess(userRole, a.minRole))
  const recentItems    = (itemsQ.data ?? []).slice(0, 6)

  return (
    <div className="mx-auto p-6 flex flex-col gap-8" style={{ maxWidth: '1100px' }}>

      {/* ── Greeting ── */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
          {getGreeting()}, {firstName} 👋
        </h1>
        <p className="mt-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {formatTodayLong()}
        </p>
      </div>

      {/* ── This-week quick stats ── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Hours this week
        </p>
        {summaryQ.isLoading ? (
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Hours Logged', value: summaryQ.data?.total_hours ?? 0,    icon: Clock,        color: 'var(--color-brand-primary)' },
              { label: 'Tasks Done',   value: summaryQ.data?.done_count   ?? 0,    icon: CheckCircle,  color: '#10B981' },
              { label: 'Blocked',      value: summaryQ.data?.blocked_count ?? 0,   icon: AlertCircle,  color: '#F43F5E' },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="rounded-xl p-5"
                  style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                      {stat.label}
                    </span>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: `${stat.color}1A` }}>
                      <Icon size={14} color={stat.color} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-mono" style={{ color: stat.color }}>
                    {stat.value}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Quick actions ── */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Quick actions
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(visibleActions.length, 3)}, 1fr)` }}>
          {visibleActions.map(action => {
            const Icon = action.icon
            const isPrimary = action.style === 'primary'
            const isAI      = action.style === 'ai'
            return (
              <Link key={action.to} to={action.to}
                aria-label={action.label}
                className="flex items-start gap-3 rounded-xl p-4 transition-all hover:-translate-y-0.5"
                style={{
                  textDecoration: 'none',
                  background: isPrimary ? 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))'
                    : isAI ? 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(6,182,212,0.12))'
                    : 'var(--color-bg-surface)',
                  border: isPrimary ? 'none'
                    : isAI ? '1px solid rgba(139,92,246,0.25)'
                    : '1px solid var(--color-border-subtle)',
                  boxShadow: isPrimary ? '0 4px 15px rgba(99,102,241,0.3)' : 'none',
                }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isPrimary ? 'rgba(255,255,255,0.15)' : isAI ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.1)',
                  }}>
                  <Icon size={16} color={isPrimary ? '#fff' : isAI ? '#A78BFA' : 'var(--color-brand-primary)'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold"
                    style={{ color: isPrimary ? '#fff' : 'var(--color-text-primary)', marginBottom: 2 }}>
                    {action.label}
                  </p>
                  <p className="text-xs" style={{ color: isPrimary ? 'rgba(255,255,255,0.75)' : 'var(--color-text-secondary)' }}>
                    {action.description}
                  </p>
                </div>
                <ArrowRight size={14} color={isPrimary ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)'} className="self-center flex-shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Recent work items ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Recent work
          </p>
          <Link to="/my-dashboard" style={{ fontSize: 12, color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        {itemsQ.isLoading ? (
          <SkeletonCard />
        ) : recentItems.length === 0 ? (
          <div className="rounded-xl py-12 text-center"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              No recent work items this week.
            </p>
            <Link to="/submit"
              className="inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
              <PlusCircle size={14} />
              Submit your first update to get started
            </Link>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden"
            style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
            {recentItems.map((item, idx) => {
              const color = STATUS_COLOR[item.status ?? ''] ?? '#9CA3AF'
              return (
                <div key={item.id}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[var(--color-bg-elevated)]"
                  style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--color-border-subtle)' }}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {item.task_description}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {item.work_category} · {item.hours_spent != null ? `${item.hours_spent}h` : '—'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {formatRelative(item.work_date)}
                    </span>
                    <span className="block text-xs mt-0.5 px-1.5 py-0.5 rounded-full"
                      style={{ background: `${color}18`, color }}>
                      {item.status?.replace('_', ' ') ?? '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
