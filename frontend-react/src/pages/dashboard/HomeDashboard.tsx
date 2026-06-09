import { useMemo, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import {
  PlusCircle, MessageSquare, BarChart3, Users, Shield,
  Clock, CheckCircle, AlertCircle, Sparkles, Flame,
  AlertTriangle, ArrowRight, ListTodo, FolderKanban,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuthStore } from '@/store/authStore'
import { dashboardApi } from '@/api/dashboard'
import { worklogsApi } from '@/api/worklogs'
import { chatApi } from '@/api/chat'
import { GoalRing } from '@/components/charts/GoalRing'
import { ProductivityHeatmap } from '@/components/charts/ProductivityHeatmap'
import { SkeletonCard } from '@/components/common/Skeleton'
import { AnimatedNumber } from '@/components/common/AnimatedNumber'
import { GlassCard } from '@/components/common/GlassCard'
import { formatRelative } from '@/utils/formatDate'
import { canAccess } from '@/utils/roleGuard'
import type { Role } from '@/utils/roleGuard'
import type { WorkItem } from '@/types/models'

// ── Confetti helper ───────────────────────────────────────────────────────────

async function fireConfetti(type: 'streak' | 'goal' | 'century') {
  try {
    const confetti = (await import('canvas-confetti')).default
    if (type === 'streak') {
      confetti({ particleCount: 80, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } })
      confetti({ particleCount: 80, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } })
    } else if (type === 'goal') {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#F59E0B', '#FBBF24', '#FDE68A'] })
    } else {
      confetti({ particleCount: 200, spread: 160, origin: { y: 0.5 }, colors: ['#6366F1', '#8B5CF6', '#F59E0B'] })
    }
  } catch { /* silently skip */ }
}

// ── Achievement badges ────────────────────────────────────────────────────────

interface Badge { id: string; emoji: string; label: string; desc: string; unlocked: boolean; unlockedAt?: string }

function computeBadges(streak: number, totalHours: number, weekGoal: number, totalItems: number): Badge[] {
  const submitted   = !!localStorage.getItem('hasSubmittedBefore')
  const goalReached = totalHours >= weekGoal && weekGoal > 0
  return [
    { id: 'first-steps', emoji: '🚀', label: 'First Steps',    desc: 'Confirm your first work log',       unlocked: submitted },
    { id: 'on-fire',     emoji: '🔥', label: 'On Fire',        desc: '5-day submission streak',           unlocked: streak >= 5 },
    { id: 'goal',        emoji: '🎯', label: 'Goal Crusher',   desc: 'Hit your weekly hours target',      unlocked: goalReached },
    { id: 'century',     emoji: '🏆', label: 'Century',        desc: '100 work items confirmed',          unlocked: totalItems >= 100 },
    { id: 'consistent',  emoji: '📅', label: 'Consistent',     desc: '30-day submission streak',          unlocked: streak >= 30 },
    { id: 'ai-curious',  emoji: '🤖', label: 'AI Curious',     desc: 'Ask the AI assistant a question',   unlocked: !!localStorage.getItem('dailyops_chat_cleared_at') || false },
  ]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_WEEKLY_GOAL = 40
function getWeeklyGoal(): number {
  const saved = localStorage.getItem('dailyops_weekly_goal')
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
  { label: 'Tasks',          to: '/tasks',        icon: ListTodo,      description: 'View & update your task list',  style: 'secondary', minRole: 'employee' },
  { label: 'Projects',       to: '/projects',     icon: FolderKanban,  description: 'Browse work by project',        style: 'secondary', minRole: 'employee' },
  { label: 'My Analytics',   to: '/my-dashboard', icon: BarChart3,     description: 'Charts, trends & benchmarks',   style: 'secondary', minRole: 'employee' },
  { label: 'Team Dashboard', to: '/team',         icon: Users,         description: 'Team progress overview',        style: 'secondary', minRole: 'manager'  },
  { label: 'Admin Panel',    to: '/admin',        icon: Shield,        description: 'Users & system settings',       style: 'secondary', minRole: 'admin'    },
]

// ── Onboarding steps (shown when user has no work items yet) ─────────────────

const ONBOARD_STEPS = [
  { id: 'submit',  emoji: '✏️', label: 'Submit your first work update', desc: 'Log what you worked on today',           to: '/submit'       },
  { id: 'review',  emoji: '🔍', label: 'Review the extracted items',    desc: 'Check the AI extraction was accurate',  to: '/submit'       },
  { id: 'ask-ai',  emoji: '🤖', label: 'Ask DailyOps AI a question',   desc: 'Try the conversational assistant',       to: '/chat'         },
  { id: 'explore', emoji: '📊', label: 'Explore your dashboard',        desc: 'See your analytics once you have data',  to: '/my-dashboard' },
] as const

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
  const kpiRef    = useRef<HTMLDivElement>(null)
  const [stickyVisible, setStickyVisible] = useState(false)

  // Show sticky bar when KPI section scrolls out of view
  useEffect(() => {
    const el = kpiRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => setStickyVisible(!entry.isIntersecting), { threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

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
  const totalItems     = summaryQ.data?.total_items ?? 0
  const badges         = useMemo(() => computeBadges(streak, totalHours, weekGoal, totalItems), [streak, totalHours, weekGoal, totalItems])
  const [badgesOpen, setBadgesOpen] = useState(true)

  // AI Weekly Brief
  const [brief, setBrief] = useState<{ text: string; ts: string } | null>(() => {
    try {
      const v = localStorage.getItem(`dailyops_brief_${new Date().toISOString().split('T')[0]}`)
      return v ? JSON.parse(v) : null
    } catch { return null }
  })
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefExpanded, setBriefExpanded] = useState(false)

  // Onboarding checklist
  const [onboardDismissed, setOnboardDismissed] = useState(() => !!localStorage.getItem('dailyops_onboard_dismissed'))
  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('dailyops_onboard_completed') ?? '[]') } catch { return [] }
  })

  async function generateBrief() {
    setBriefLoading(true)
    try {
      const res = await chatApi.query({
        question: 'Summarize my work this week in 3–5 bullet points: hours logged, key tasks completed, any blockers, and what to focus on next. Be concise.',
      })
      const result = { text: res.answer, ts: new Date().toISOString() }
      localStorage.setItem(`dailyops_brief_${new Date().toISOString().split('T')[0]}`, JSON.stringify(result))
      setBrief(result)
      setBriefExpanded(true)
    } catch { /* silent */ }
    finally { setBriefLoading(false) }
  }

  function dismissOnboard() {
    localStorage.setItem('dailyops_onboard_dismissed', '1')
    setOnboardDismissed(true)
  }

  function markStepDone(id: string) {
    const updated = [...completedSteps.filter(s => s !== id), id]
    localStorage.setItem('dailyops_onboard_completed', JSON.stringify(updated))
    setCompletedSteps(updated)
  }

  // Confetti milestones — fire once per milestone ever
  useEffect(() => {
    if (!summaryQ.data) return
    if (streak >= 5 && !localStorage.getItem('confetti_streak5')) {
      localStorage.setItem('confetti_streak5', '1')
      fireConfetti('streak')
    }
    if (totalHours >= weekGoal && weekGoal > 0 && !localStorage.getItem(`confetti_goal_${weekGoal}`)) {
      localStorage.setItem(`confetti_goal_${weekGoal}`, '1')
      fireConfetti('goal')
    }
    if (totalItems >= 100 && !localStorage.getItem('confetti_century')) {
      localStorage.setItem('confetti_century', '1')
      fireConfetti('century')
    }
  }, [streak, totalHours, weekGoal, totalItems, summaryQ.data])

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

  const hasNoItems     = !recentQ.isLoading && recentItems.length === 0
  const showOnboarding = hasNoItems && !onboardDismissed

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
        <GlassCard
          className="px-5 py-3.5 flex items-center gap-3"
          style={{ borderLeftColor: 'var(--color-brand-primary)', borderLeftWidth: 3 }}
        >
          <Sparkles size={14} color="var(--color-brand-primary)" style={{ flexShrink: 0 }} />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>{narrative}</p>
        </GlassCard>
      )}

      {/* ── KPI Strip ── */}
      <div ref={kpiRef}>
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
                  <p className="text-2xl font-bold font-mono" style={{ color: stat.color }}>
                    <AnimatedNumber value={stat.value} />
                  </p>
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
                  <Link to={`/my-dashboard?review=${item.work_log_id}`} style={{ fontSize: 10, color: 'var(--color-brand-primary)', textDecoration: 'none', flexShrink: 0 }}>Review →</Link>
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

      {/* ── Achievements ── */}
      <div>
        <button onClick={() => setBadgesOpen(o => !o)}
          className="flex items-center justify-between w-full mb-3 rounded-lg px-3 py-2 transition-colors"
          style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>🏅</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>Achievements</span>
            <span className="rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--color-brand-primary)' }}>
              {badges.filter(b => b.unlocked).length}/{badges.length} unlocked
            </span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{badgesOpen ? '▲' : '▼'}</span>
        </button>
        {badgesOpen && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {badges.map(b => (
              <div key={b.id} className="rounded-xl p-3 flex flex-col items-center text-center gap-1.5"
                style={{
                  background: b.unlocked ? 'var(--color-bg-surface)' : 'var(--color-bg-elevated)',
                  border: `1px solid ${b.unlocked ? 'rgba(99,102,241,0.3)' : 'var(--color-border-subtle)'}`,
                  opacity: b.unlocked ? 1 : 0.5,
                }}>
                <span style={{ fontSize: 26, filter: b.unlocked ? 'none' : 'grayscale(100%)' }}>{b.emoji}</span>
                <p style={{ fontSize: 11, fontWeight: 600, color: b.unlocked ? 'var(--color-text-primary)' : 'var(--color-text-muted)' }}>{b.label}</p>
                <p style={{ fontSize: 10, color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{b.desc}</p>
                {b.unlocked && <span style={{ fontSize: 9, color: '#10B981', fontWeight: 600 }}>UNLOCKED</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Recent work / Onboarding rail ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>{showOnboarding ? 'Get started' : 'Recent work'}</SectionLabel>
          {!showOnboarding && (
            <Link to="/my-dashboard" style={{ fontSize: 12, color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
              View all →
            </Link>
          )}
        </div>

        {recentQ.isLoading ? (
          <SkeletonCard />
        ) : showOnboarding ? (
          /* ── Onboarding checklist ── */
          <GlassCard accent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-base font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                  🚀 Get started with DailyOps AI
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                  Complete these steps to unlock the full experience
                </p>
              </div>
              <button onClick={dismissOnboard} aria-label="Dismiss onboarding"
                className="rounded p-1 transition-colors"
                style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              {ONBOARD_STEPS.map(step => {
                const done = completedSteps.includes(step.id)
                return (
                  <div key={step.id} className="flex items-center gap-3 rounded-lg px-4 py-2.5"
                    style={{
                      background: done ? 'rgba(16,185,129,0.05)' : 'var(--color-bg-elevated)',
                      border: `1px solid ${done ? 'rgba(16,185,129,0.2)' : 'var(--color-border-subtle)'}`,
                    }}>
                    <span style={{ fontSize: 18, filter: done ? 'none' : 'grayscale(100%)', opacity: done ? 1 : 0.55 }}>
                      {done ? '✅' : step.emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium"
                        style={{ color: done ? 'var(--color-text-muted)' : 'var(--color-text-primary)', textDecoration: done ? 'line-through' : 'none' }}>
                        {step.label}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{step.desc}</p>
                    </div>
                    {!done && (
                      <Link to={step.to} onClick={() => markStepDone(step.id)}
                        style={{ fontSize: 12, color: 'var(--color-brand-primary)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Go →
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--color-text-muted)' }}>
                <span>Progress</span>
                <span>{completedSteps.length} of {ONBOARD_STEPS.length} complete</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-elevated)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${(completedSteps.length / ONBOARD_STEPS.length) * 100}%`, background: 'var(--gradient-brand)' }} />
              </div>
            </div>
          </GlassCard>
        ) : hasNoItems ? (
          /* ── Post-dismiss minimal empty state ── */
          <BentoCard className="py-10 text-center">
            <Flame size={28} style={{ margin: '0 auto 8px', color: 'var(--color-text-muted)' }} />
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
              No recent work items yet.
            </p>
            <Link to="/submit" className="inline-flex items-center gap-1.5 text-sm font-medium"
              style={{ color: 'var(--color-brand-primary)', textDecoration: 'none' }}>
              <PlusCircle size={13} /> Submit your first update to get started
            </Link>
          </BentoCard>
        ) : (
          /* ── Regular item list ── */
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

      {/* ── AI Weekly Brief ── */}
      <GlassCard accent>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: briefExpanded && !!brief ? '1px solid var(--color-border-subtle)' : 'none' }}>
          <div className="flex items-center gap-2.5">
            <Sparkles size={14} color="var(--color-brand-primary)" />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>AI Weekly Brief</p>
              {brief?.ts ? (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Generated {new Date(brief.ts).toLocaleDateString()} at {new Date(brief.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              ) : (
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  AI summary of your week's work
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {brief && !briefLoading && (
              <button onClick={() => setBriefExpanded(o => !o)}
                className="text-xs rounded-md px-3 py-1.5 transition-colors"
                style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-subtle)', cursor: 'pointer' }}>
                {briefExpanded ? '▲ Collapse' : '▼ Expand'}
              </button>
            )}
            <button onClick={generateBrief} disabled={briefLoading} aria-label={brief ? 'Refresh brief' : 'Generate brief'}
              className="text-xs rounded-md px-3 py-1.5 transition-colors"
              style={{ background: briefLoading ? 'var(--color-bg-elevated)' : 'rgba(99,102,241,0.1)', color: 'var(--color-brand-primary)', border: '1px solid rgba(99,102,241,0.2)', cursor: briefLoading ? 'not-allowed' : 'pointer', opacity: briefLoading ? 0.6 : 1 }}>
              {briefLoading ? '…' : brief ? '↻ Refresh' : '✦ Generate Brief'}
            </button>
          </div>
        </div>

        {briefLoading && (
          <div className="px-5 py-4 flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Generating your weekly brief
            {[0, 1, 2].map(i => (
              <motion.span key={i} className="inline-block w-1 h-1 rounded-full"
                style={{ background: 'var(--color-brand-primary)' }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
        )}

        {!brief && !briefLoading && (
          <p className="px-5 py-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Generate an AI-powered summary of your week — what you accomplished, where you're blocked, and what to focus on next.
          </p>
        )}

        {briefExpanded && brief && !briefLoading && (
          <div className="px-5 py-4">
            <div className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{brief.text}</ReactMarkdown>
            </div>
            <p className="text-xs mt-3 pt-3 flex items-center gap-1"
              style={{ color: 'var(--color-text-muted)', borderTop: '1px solid var(--color-border-subtle)' }}>
              <Sparkles size={10} /> Generated by DailyOps AI
            </p>
          </div>
        )}
      </GlassCard>

      {/* ── Sticky insight bar — slides in when KPI strip scrolls out of view ── */}
      <AnimatePresence>
        {stickyVisible && summaryQ.data && (
          <motion.div
            key="sticky-bar"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            style={{
              position: 'fixed', top: 56, left: 0, right: 0, zIndex: 30,
              background: 'var(--color-bg-surface)',
              borderBottom: '1px solid var(--color-border-default)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}>
            <div className="mx-auto flex items-center gap-6 px-6 py-2" style={{ maxWidth: 1100 }}>
              <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>This week</span>
              <span className="text-sm font-bold font-mono" style={{ color: 'var(--color-brand-primary)' }}>
                {totalHours.toFixed(1)}h
              </span>
              <span className="text-xs" style={{ color: '#10B981' }}>✓ {doneCount} done</span>
              {blockedCount > 0 && (
                <span className="text-xs" style={{ color: '#F43F5E' }}>⚠ {blockedCount} blocked</span>
              )}
              <span className="text-xs" style={{ color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {Math.round((totalHours / weekGoal) * 100)}% of {weekGoal}h goal
              </span>
              <Link to="/submit" className="text-xs font-medium rounded-md px-3 py-1"
                style={{ background: 'var(--color-brand-primary)', color: '#fff', textDecoration: 'none' }}>
                + Submit
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
