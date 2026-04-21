import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  PlusCircle, MessageSquare, BarChart3, Users, Shield,
  Clock, CheckCircle, AlertCircle, Sparkles, Flame,
  AlertTriangle, ArrowRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { dashboardApi } from '@/api/dashboard'
import { worklogsApi } from '@/api/worklogs'
import { GoalRing } from '@/components/charts/GoalRing'
import { ProductivityHeatmap } from '@/components/charts/ProductivityHeatmap'
import { SkeletonCard } from '@/components/common/Skeleton'
import { formatRelative } from '@/utils/formatDate'
import { canAccess } from '@/utils/roleGuard'
import type { Role } from '@/utils/roleGuard'
import type { WorkItem } from '@/types/models'

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_WEEKLY_GOAL = 40
function getWeeklyGoal(): number {
  const saved = localStorage.getItem('worktrack_weekly_goal')
  return saved ? Number(saved) : DEFAULT_WEEKLY_GOAL
}

const CATEGORY_COLORS: Record<string, string> = {
  project: '#6366F1', ticket: '#8B5CF6', polaris_classification: '#A78BFA',
  meeting: '#0EA5E9', admin: '#6B7280', learning: '#10B981',
  support: '#F59E0B', documentation: '#34D399', review: '#06B6D4', other: '#4B5563',
}

const FOCUS_CATEGORIES = new Set(['project', 'ticket', 'polaris_classification', 'learning', 'documentation', 'review'])
const MEETING_CATEGORIES = new Set(['meeting'])
const ADMIN_CATEGORIES = new Set(['admin', 'support', 'other'])

const STATUS_COLOR: Record<string, string> = {
  done: '#10B981', in_progress: '#0EA5E9', blocked: '#F43F5E', planned: '#9CA3AF',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getThisWeekParams() {
  const today = new Date()
  const start = new Date(today)
  start.setDate(today.getDate() - 6)
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

function computeStreak(items: WorkItem[]): number {
  if (!items.length) return 0
  const days = [...new Set(items.map(i => i.work_date))].sort().reverse()
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (days[0] !== today && days[0] !== yesterday) return 0
  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const diff = (new Date(days[i - 1]).getTime() - new Date(days[i]).getTime()) / 86400000
    if (diff <= 1) streak++; else break
  }
  return streak
}

function buildNarrative(
  hours: number,
  done: number,
  blocked: number,
  goal: number,
  firstName: string,
): string {
  const parts: string[] = []
  parts.push(`You've logged ${hours.toFixed(1)}h this week`)
  if (done > 0) parts.push(`${done} task${done !== 1 ? 's' : ''} completed`)
  if (blocked > 0) parts.push(`${blocked} item${blocked !== 1 ? 's' : ''} blocked`)
  const remaining = goal - hours
  if (remaining > 0 && remaining < goal) parts.push(`${remaining.toFixed(1)}h to your weekly goal`)
  return `${firstName}, ${parts.join(' · ')}.`
}

// ── Quick actions ─────────────────────────────────────────────────────────────

interface ActionItem {
  label: string; to: string; icon: React.ElementType
  description: string; style: 'primary' | 'ai' | 'secondary'; minRole: Role
}

const ACTIONS: ActionItem[] = [
  { label: 'Submit Update',  to: '/submit',       icon: PlusCircle,    description: 'Log what you worked on',        style: 'primary',   minRole: 'employee' },
  { label: 'Chat Assistant', to: '/chat',         icon: MessageSquare, description: 'Ask about your work data',      style: 'ai',        minRole: 'employee' },
  { label: 'My Dashboard',   to: '/my-dashboard', icon: BarChart3,     description: 'Analytics & work items',        style: 'secondary', minRole: 'employee' },
  { label: 'Team Dashboard', to: '/team',         icon: Users,         description: 'Team progress overview',        style: 'secondary', minRole: 'manager'  },
  { label: 'Admin Panel',    to: '/admin',        icon: Shield,        description: 'Users & system settings',       style: 'secondary', minRole: 'admin'    },
]

// ── Bento card wrapper ────────────────────────────────────────────────────────

function BentoCard({ children, style, className = '' }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`rounded-xl p-5 ${className}`}
      style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', ...style }}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>{children}</p>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomeDashboard() {
  const user      = useAuthStore(s => s.user)
  const userRole  = (user?.role ?? 'employee') as Role
  const firstName = user?.full_name.split(' ')[0] ?? 'there'
  const weekGoal  = getWeeklyGoal()

  const weekParams = useMemo(() => getThisWeekParams(), [])

  const summaryQ    = useQuery({ queryKey: ['home-summary',    weekParams.start_date], queryFn: () => dashboardApi.getSummary(weekParams),    placeholderData: keepPreviousData })
  const categoriesQ = useQuery({ queryKey: ['home-categories', weekParams.start_date], queryFn: () => dashboardApi.getCategories(weekParams), placeholderData: keepPreviousData })
  // Week items — used for heatmap, streak, needs-review (scoped to this week)
  const itemsQ      = useQuery({ queryKey: ['home-week-items', weekParams.start_date], queryFn: () => worklogsApi.getMy(weekParams),           placeholderData: keepPreviousData })
  // Recent items — unfiltered so the activity feed always shows the latest work
  const recentQ     = useQuery({ queryKey: ['home-recent-items'],                      queryFn: () => worklogsApi.getMy(),                      placeholderData: keepPreviousData })

  const totalHours   = summaryQ.data?.total_hours   ?? 0
  const doneCount    = summaryQ.data?.done_count    ?? 0
  const blockedCount = summaryQ.data?.blocked_count ?? 0

  // Derived: streak + heatmap + needs-review from week items
  const allItems    = itemsQ.data ?? []
  const streak      = useMemo(() => computeStreak(allItems), [allItems])
  const needsReview = allItems.filter(i => i.needs_review)
  // Activity feed: most recent 5 items, no date restriction
  const recentItems = (recentQ.data ?? []).slice(0, 5)

  // Derived: heatmap data
  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {}
    allItems.forEach(i => { map[i.work_date] = (map[i.work_date] ?? 0) + (i.hours_spent ?? 1) })
    return Object.entries(map).map(([date, count]) => ({ date, count }))
  }, [allItems])

  // Derived: focus split from categories
  const { focusPct, meetingPct, adminPct } = useMemo(() => {
    const cats = categoriesQ.data ?? []
    const total = cats.reduce((s, c) => s + c.hours, 0)
    if (!total) return { focusPct: 0, meetingPct: 0, adminPct: 0 }
    const focus   = cats.filter(c => FOCUS_CATEGORIES.has(c.category)).reduce((s, c) => s + c.hours, 0)
    const meeting = cats.filter(c => MEETING_CATEGORIES.has(c.category)).reduce((s, c) => s + c.hours, 0)
    const admin   = cats.filter(c => ADMIN_CATEGORIES.has(c.category)).reduce((s, c) => s + c.hours, 0)
    return {
      focusPct:   Math.round((focus   / total) * 100),
      meetingPct: Math.round((meeting / total) * 100),
      adminPct:   Math.round((admin   / total) * 100),
    }
  }, [categoriesQ.data])

  const visibleActions = ACTIONS.filter(a => canAccess(userRole, a.minRole))

  // Dynamic sub-message
  const subMessage = useMemo(() => {
    if (!summaryQ.data) return formatTodayLong()
    const remaining = weekGoal - totalHours
    if (blockedCount > 0) return `${blockedCount} item${blockedCount !== 1 ? 's' : ''} blocked this week · ${remaining > 0 ? `${remaining.toFixed(0)}h to your goal` : 'Weekly goal reached 🎉'}`
    if (remaining > 0) return `${totalHours.toFixed(1)}h logged · ${remaining.toFixed(0)}h to your weekly goal`
    return `Weekly goal reached · ${doneCount} tasks done · Great work! 🎉`
  }, [summaryQ.data, totalHours, blockedCount, weekGoal, doneCount])

  // Narrative strip
  const narrative = useMemo(() => {
    if (!summaryQ.data) return null
    return buildNarrative(totalHours, doneCount, blockedCount, weekGoal, firstName)
  }, [summaryQ.data, totalHours, doneCount, blockedCount, weekGoal, firstName])

  const hasNoItems = !recentQ.isLoading && recentItems.length === 0

  return (
    <div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1200px' }}>

      {/* ── Greeting ── */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--color-text-primary)', letterSpacing: '-0.02em' }}>
          {getGreeting()}, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {formatTodayLong()}
        </p>
        {summaryQ.data && subMessage && (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {subMessage}
          </p>
        )}
      </div>

      {/* ── AI Narrative strip ── */}
      {narrative && (
        <div className="rounded-xl px-5 py-3.5 flex items-center gap-3"
          style={{
            background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderLeft: '3px solid var(--color-brand-primary)',
          }}>
          <Sparkles size={14} color="var(--color-brand-primary)" style={{ flexShrink: 0 }} />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{narrative}</p>
        </div>
      )}

      {/* ── KPI Strip ── */}
      <div>
        <SectionLabel>This week</SectionLabel>
        {summaryQ.isLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: 'Hours Logged', value: totalHours,   display: totalHours.toFixed(1), icon: Clock,        color: 'var(--color-brand-primary)' },
              { label: 'Tasks Done',   value: doneCount,    display: String(doneCount),      icon: CheckCircle,  color: '#10B981' },
              { label: 'Blocked',      value: blockedCount, display: String(blockedCount),   icon: AlertCircle,  color: '#F43F5E' },
            ].map(stat => {
              const Icon = stat.icon
              return (
                <BentoCard key={stat.label}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{stat.label}</span>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}1A` }}>
                      <Icon size={13} color={stat.color} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold font-mono" style={{ color: stat.color }}>{stat.display}</p>
                </BentoCard>
              )
            })}
            {/* Goal ring */}
            <BentoCard className="flex items-center justify-center">
              <GoalRing current={totalHours} target={weekGoal} label="Weekly Goal" size={96} />
            </BentoCard>
          </div>
        )}
      </div>

      {/* ── Bento row 2: Heatmap + Streak/Focus ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>

        {/* Productivity heatmap */}
        <BentoCard>
          <SectionLabel>Productivity — last 6 months</SectionLabel>
          <ProductivityHeatmap data={heatmapData} weeks={26} />
        </BentoCard>

        {/* Streak + Focus split */}
        <div className="flex flex-col gap-4">
          {/* Streak */}
          <BentoCard style={{ flex: 1 }}>
            <SectionLabel>Submission streak</SectionLabel>
            <div className="flex items-center gap-3">
              <span style={{ fontSize: 32 }}>{streak > 7 ? '🔥' : streak > 0 ? '⚡' : '💤'}</span>
              <div>
                <p className="text-2xl font-bold font-mono" style={{ color: streak > 0 ? '#F59E0B' : 'var(--color-text-muted)' }}>
                  {streak} day{streak !== 1 ? 's' : ''}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  {streak > 7 ? 'On fire! Keep it up!' : streak > 0 ? 'Good momentum' : 'Submit today to start'}
                </p>
              </div>
            </div>
          </BentoCard>

          {/* Focus split */}
          <BentoCard style={{ flex: 1 }}>
            <SectionLabel>Time split</SectionLabel>
            {categoriesQ.isLoading ? (
              <SkeletonCard />
            ) : focusPct + meetingPct + adminPct === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>No data this week</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {[
                  { label: 'Deep work', pct: focusPct,   color: '#6366F1' },
                  { label: 'Meetings',  pct: meetingPct, color: '#0EA5E9' },
                  { label: 'Admin',     pct: adminPct,   color: '#6B7280' },
                ].map(({ label, pct, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                      <span>{label}</span><span style={{ fontFamily: 'monospace' }}>{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full" style={{ background: 'var(--color-bg-elevated)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </BentoCard>
        </div>
      </div>

      {/* ── Bento row 3: Quick actions + Needs Review ── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>

        {/* Quick actions */}
        <div>
          <SectionLabel>Quick actions</SectionLabel>
          <div className="flex flex-col gap-2">
            {visibleActions.map(action => {
              const Icon = action.icon
              const isPrimary = action.style === 'primary'
              const isAI      = action.style === 'ai'
              return (
                <motion.div key={action.to}
                  whileHover={{ x: 3 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}>
                  <Link to={action.to} aria-label={action.label}
                    className="flex items-center gap-3 rounded-xl px-4 py-3"
                    style={{
                      textDecoration: 'none', display: 'flex',
                      background: isPrimary ? 'linear-gradient(135deg, var(--color-brand-primary), var(--color-brand-secondary))'
                        : isAI ? 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(6,182,212,0.1))'
                        : 'var(--color-bg-surface)',
                      border: isPrimary ? 'none' : isAI ? '1px solid rgba(139,92,246,0.25)' : '1px solid var(--color-border-subtle)',
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: isPrimary ? 'rgba(255,255,255,0.15)' : isAI ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.1)' }}>
                      <Icon size={15} color={isPrimary ? '#fff' : isAI ? '#A78BFA' : 'var(--color-brand-primary)'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: isPrimary ? '#fff' : 'var(--color-text-primary)', marginBottom: 1 }}>{action.label}</p>
                      <p className="text-xs" style={{ color: isPrimary ? 'rgba(255,255,255,0.75)' : 'var(--color-text-secondary)' }}>{action.description}</p>
                    </div>
                    <ArrowRight size={13} color={isPrimary ? 'rgba(255,255,255,0.6)' : 'var(--color-text-muted)'} />
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Needs Review queue */}
        <div>
          <SectionLabel>
            {needsReview.length > 0
              ? `Needs your review (${needsReview.length})`
              : 'Needs review'}
          </SectionLabel>
          {needsReview.length === 0 ? (
            <BentoCard className="flex flex-col items-center justify-center text-center" style={{ minHeight: 120 }}>
              <CheckCircle size={20} color="#10B981" style={{ marginBottom: 8 }} />
              <p className="text-sm font-medium" style={{ color: '#10B981' }}>All clear!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>No items need review</p>
            </BentoCard>
          ) : (
            <div className="flex flex-col gap-2">
              {needsReview.slice(0, 4).map(item => (
                <div key={item.id} className="rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)' }}>
                  <AlertTriangle size={13} color="#F59E0B" style={{ marginTop: 2, flexShrink: 0 }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--color-text-primary)' }}>{item.task_description}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{item.work_date} · {item.work_category}</p>
                  </div>
                  <Link to="/submit" style={{ fontSize: 10, color: 'var(--color-brand-primary)', textDecoration: 'none', flexShrink: 0 }}>Review →</Link>
                </div>
              ))}
              {needsReview.length > 4 && (
                <Link to="/my-dashboard" style={{ fontSize: 12, color: 'var(--color-brand-primary)', textDecoration: 'none', textAlign: 'center', padding: '4px 0' }}>
                  +{needsReview.length - 4} more →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent work activity ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Recent work</SectionLabel>
          <Link to="/my-dashboard" style={{ fontSize: 12, color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
            View all →
          </Link>
        </div>

        {recentQ.isLoading ? (
          <SkeletonCard />
        ) : hasNoItems ? (
          <BentoCard className="py-10 text-center">
            <Flame size={28} style={{ margin: '0 auto 8px', color: 'var(--color-text-muted)' }} />
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              No recent work items this week.
            </p>
            <Link to="/submit" className="inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
              <PlusCircle size={13} /> Submit your first update to get started
            </Link>
          </BentoCard>
        ) : (
          <BentoCard style={{ padding: 0, overflow: 'hidden' }}>
            {recentItems.map((item, idx) => {
              const statusColor = STATUS_COLOR[item.status ?? ''] ?? '#9CA3AF'
              const catColor    = CATEGORY_COLORS[item.work_category] ?? '#6366F1'
              return (
                <div key={item.id}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                  style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--color-border-subtle)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                  onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  {/* Category colour dot */}
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: catColor }} title={item.work_category} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: 'var(--color-text-primary)' }}>
                      {item.task_description}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {item.work_category}{item.project_name ? ` · ${item.project_name}` : ''} · {item.hours_spent != null ? `${item.hours_spent}h` : '—'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-xs block" style={{ color: 'var(--color-text-muted)' }}>{formatRelative(item.work_date)}</span>
                    <span className="text-xs mt-0.5 px-1.5 py-0.5 rounded-full inline-block"
                      style={{ background: `${statusColor}18`, color: statusColor }}>
                      {item.status?.replace('_', ' ') ?? '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </BentoCard>
        )}
      </div>
    </div>
  )
}
