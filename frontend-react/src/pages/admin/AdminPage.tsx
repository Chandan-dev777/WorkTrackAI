import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, Database, Users, AlertTriangle, RefreshCw, Sprout, ChevronDown, ChevronRight, Activity, CheckCircle2, XCircle, Clock, Search, X } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { adminApi } from '@/api/admin'
import { orgApi } from '@/api/org'
import type { UserSearchResult } from '@/api/org'
import { SkeletonCard, SkeletonTable } from '@/components/common/Skeleton'
import { formatDateShort } from '@/utils/formatDate'
import { cn } from '@/utils/cn'
import type { AdminUser, ActivityLogEntry } from '@/api/admin'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

const ROLE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  admin:    { bg: 'rgba(139,92,246,0.12)', color: '#A78BFA', border: 'rgba(139,92,246,0.3)' },
  manager:  { bg: 'rgba(14,165,233,0.12)', color: '#38BDF8', border: 'rgba(14,165,233,0.3)' },
  employee: { bg: 'rgba(107,114,128,0.12)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
}

function RoleBadge({ role }: { role: AdminUser['role'] }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.employee
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {role}
    </span>
  )
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-subtle)',
  borderRadius: '12px',
  padding: '24px',
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  border: '1px solid var(--color-border-default)',
  color: 'var(--color-text-primary)',
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '12px',
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'users' | 'system' | 'errors' | 'activity'
type ErrorFilter = 'all' | 'failed' | 'needs_review'

export default function AdminPage() {
  const currentUser = useAuthStore(s => s.user)
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab]       = useState<Tab>('users')
  const [errorFilter, setErrorFilter]   = useState<ErrorFilter>('all')
  const [expandedError, setExpandedError] = useState<string | null>(null)

  // Seed actions
  const [seedConfirm, setSeedConfirm]   = useState(false)
  const [seeding, setSeeding]           = useState(false)
  const [seedResult, setSeedResult]     = useState<string | null>(null)

  // Reindex actions
  const [reindexing, setReindexing]       = useState(false)
  const [reindexResult, setReindexResult] = useState<string | null>(null)

  // Per-user edit state: userId → local draft
  const [editDrafts, setEditDrafts]       = useState<Record<string, AdminUser>>({})
  const [savingUser, setSavingUser]       = useState<Record<string, boolean>>({})
  const [userSaveMsg, setUserSaveMsg]     = useState<Record<string, { ok?: string; err?: string }>>({})

  // Manager assignment modal
  const [mgrModal, setMgrModal]     = useState<{ userId: string; userName: string } | null>(null)
  const [mgrSearch, setMgrSearch]   = useState('')
  const [mgrResults, setMgrResults] = useState<UserSearchResult[]>([])
  const [settingMgr, setSettingMgr] = useState(false)

  useEffect(() => {
    if (!mgrSearch.trim()) { setMgrResults([]); return }
    const t = setTimeout(() => orgApi.searchUsers(mgrSearch).then(setMgrResults).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [mgrSearch])

  async function applyManager(userId: string, managerId: string | null, managerName: string | null) {
    setSettingMgr(true)
    try {
      await adminApi.setManager(userId, managerId)
      queryClient.setQueryData<typeof usersQ.data>(['admin-users'], old =>
        old?.map(u => u.id === userId ? { ...u, manager_id: managerId, manager_name: managerName } : u)
      )
      toast.success(managerName ? `Manager set to ${managerName}` : 'Manager removed')
      setMgrModal(null); setMgrSearch(''); setMgrResults([])
    } catch { toast.error('Failed to update manager') }
    finally { setSettingMgr(false) }
  }

  const usersQ    = useQuery({ queryKey: ['admin-users'],    queryFn: adminApi.getUsers })
  const errorsQ   = useQuery({ queryKey: ['admin-errors'],   queryFn: adminApi.getExtractionErrors })
  const statsQ    = useQuery({ queryKey: ['admin-stats'],    queryFn: adminApi.getStats,        staleTime: 30_000 })
  const activityQ = useQuery({ queryKey: ['admin-activity'], queryFn: () => adminApi.getActivityLog(50), staleTime: 30_000, enabled: activeTab === 'activity' })

  // Initialise edit drafts when users load
  useEffect(() => {
    if (usersQ.data && Object.keys(editDrafts).length === 0) {
      const drafts: Record<string, AdminUser> = {}
      usersQ.data.forEach(u => { drafts[u.id] = { ...u } })
      setEditDrafts(drafts)
    }
  }, [usersQ.data]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateDraft(userId: string, field: keyof AdminUser, value: unknown) {
    setEditDrafts(prev => ({ ...prev, [userId]: { ...prev[userId], [field]: value } }))
  }

  async function saveUser(userId: string) {
    const original = usersQ.data?.find(u => u.id === userId)
    const draft    = editDrafts[userId]
    if (!original || !draft) return

    const payload: Record<string, unknown> = {}
    if (draft.role      !== original.role)      payload.role      = draft.role
    if (draft.is_active !== original.is_active) payload.is_active = draft.is_active
    if (draft.team_name !== original.team_name) payload.team_name = draft.team_name ?? ''

    if (Object.keys(payload).length === 0) {
      setUserSaveMsg(prev => ({ ...prev, [userId]: { ok: 'No changes.' } }))
      return
    }

    setSavingUser(prev => ({ ...prev, [userId]: true }))
    setUserSaveMsg(prev => ({ ...prev, [userId]: {} }))
    try {
      const updated = await adminApi.updateUser(userId, payload)
      queryClient.setQueryData<AdminUser[]>(['admin-users'], old =>
        old?.map(u => u.id === userId ? updated : u)
      )
      setEditDrafts(prev => ({ ...prev, [userId]: { ...updated } }))
      toast.success(`Saved — ${updated.full_name}`)
      setUserSaveMsg(prev => ({ ...prev, [userId]: { ok: `Saved — ${updated.full_name}` } }))
    } catch {
      toast.error('Save failed.')
      setUserSaveMsg(prev => ({ ...prev, [userId]: { err: 'Save failed.' } }))
    } finally {
      setSavingUser(prev => ({ ...prev, [userId]: false }))
    }
  }

  async function handleSeedConfirm() {
    setSeeding(true); setSeedConfirm(false)
    try {
      await toast.promise(
        adminApi.seedDummyData().then(r => { setSeedResult(r.message); return r }),
        { loading: 'Seeding demo data…', success: (r: { message: string }) => r.message, error: 'Seed failed — check backend logs.' }
      )
    } catch { setSeedResult('Seed failed — check backend logs.') }
    setSeeding(false)
  }

  async function handleReindex() {
    setReindexing(true); setReindexResult(null)
    try {
      await toast.promise(
        adminApi.reindex().then(r => { setReindexResult(r.message); return r }),
        { loading: 'Rebuilding ChromaDB index…', success: (r: { message: string }) => r.message, error: 'Reindex failed — check backend logs.' }
      )
    } catch { setReindexResult('Reindex failed — check backend logs.') }
    setReindexing(false)
  }

  // Metrics
  const users       = usersQ.data ?? []
  const totalUsers  = users.length
  const activeCount = users.filter(u => u.is_active).length
  const adminCount  = users.filter(u => u.role === 'admin').length
  const inactiveCount = users.filter(u => !u.is_active).length

  const errors   = errorsQ.data ?? []
  const failedCount  = errors.filter(e => e.extraction_status === 'failed').length
  const reviewCount  = errors.filter(e => e.extraction_status === 'needs_review').length
  const filteredErrors = errorFilter === 'all' ? errors
    : errors.filter(e => e.extraction_status === errorFilter)

  const TABS: { id: Tab; label: string }[] = [
    { id: 'users',    label: 'User Management' },
    { id: 'system',   label: 'System Actions' },
    { id: 'errors',   label: `Extraction Errors${errors.length > 0 ? ` (${errors.length})` : ''}` },
    { id: 'activity', label: 'Activity Log' },
  ]

  const stats = statsQ.data

  return (
    <><div className="mx-auto p-6 flex flex-col gap-6" style={{ maxWidth: '1440px' }}>

      {/* Header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          <Shield size={22} color="var(--color-brand-primary)" />
          Admin Panel
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          System management — admin access only
        </p>
      </div>

      {/* System Health Strip */}
      <div className="flex flex-wrap gap-2">
        {[
          { icon: CheckCircle2, label: 'API Online',       ok: true,  detail: 'Backend responding' },
          { icon: Database,     label: `${stats?.total_work_logs ?? '…'} logs`, ok: true, detail: 'SQLite healthy' },
          { icon: stats && stats.extraction_errors > 0 ? AlertTriangle : CheckCircle2,
            label: stats ? `${stats.extraction_errors} extraction error${stats.extraction_errors !== 1 ? 's' : ''}` : 'Checking…',
            ok: !stats || stats.extraction_errors === 0,
            detail: stats ? `${stats.extraction_error_rate}% error rate` : '' },
          { icon: Users, label: `${stats?.total_users ?? '…'} users`, ok: true, detail: 'All registered users' },
        ].map(chip => {
          const Icon = chip.icon
          return (
            <span key={chip.label} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
              style={{
                background: chip.ok ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                border: `1px solid ${chip.ok ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                color: chip.ok ? '#10B981' : '#F59E0B',
              }}
              title={chip.detail}>
              <Icon size={11} />
              {chip.label}
            </span>
          )
        })}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--color-bg-elevated)', width: 'fit-content' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            aria-label={tab.label}
            className={cn('rounded-lg px-4 py-2 text-sm font-medium transition-all', activeTab === tab.id ? 'text-white' : '')}
            style={activeTab === tab.id
              ? { background: 'var(--color-brand-primary)', color: '#fff' }
              : { color: 'var(--color-text-secondary)' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB: USER MANAGEMENT ── */}
      {activeTab === 'users' && (
        <div className="flex flex-col gap-6">

          {/* Metrics row */}
          {usersQ.isLoading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Total Users',   value: totalUsers,    color: 'var(--color-brand-primary)' },
                { label: 'Active',        value: activeCount,   color: '#10B981' },
                { label: 'Admins',        value: adminCount,    color: '#A78BFA' },
                { label: 'Inactive',      value: inactiveCount, color: '#9CA3AF' },
              ].map(m => (
                <div key={m.label} className="rounded-xl p-4" style={sectionStyle}>
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>{m.label}</p>
                  <p className="text-2xl font-bold font-mono mt-1" style={{ color: m.color }}>{m.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* User table */}
          <section style={sectionStyle} aria-labelledby="users-heading">
            <h2 id="users-heading" className="text-base font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
              <Users size={15} className="inline mr-1.5" />
              Users
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--color-brand-primary)', border: '1px solid rgba(99,102,241,0.2)' }}>
                {totalUsers}
              </span>
            </h2>

            {usersQ.isLoading ? <SkeletonTable rows={5} cols={6} /> : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border-default)' }}>
                      {['User', 'Email', 'Role', 'Team', 'Manager', 'Active', 'Actions'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
                          style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => {
                      const draft  = editDrafts[user.id] ?? user
                      const isSelf = user.employee_id === currentUser?.employee_id
                      const saving = savingUser[user.id]
                      const msg    = userSaveMsg[user.id]
                      return (
                        <tr key={user.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--color-brand-primary)' }}>
                                {initials(user.full_name)}
                              </div>
                              <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                                  {user.full_name}
                                  {isSelf && <span className="ml-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>(you)</span>}
                                </p>
                                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{user.employee_id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {user.email}
                          </td>
                          <td className="px-4 py-3">
                            {isSelf ? (
                              <RoleBadge role={draft.role} />
                            ) : (
                              <select
                                aria-label={`Role for ${user.full_name}`}
                                value={draft.role}
                                onChange={e => updateDraft(user.id, 'role', e.target.value)}
                                style={inputStyle}>
                                <option value="employee">employee</option>
                                <option value="manager">manager</option>
                                <option value="admin">admin</option>
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input type="text"
                              aria-label={`Team for ${user.full_name}`}
                              value={draft.team_name ?? ''}
                              onChange={e => updateDraft(user.id, 'team_name', e.target.value || null)}
                              placeholder="—"
                              style={{ ...inputStyle, width: '120px' }} />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                                {user.manager_name ?? <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                              </span>
                              <button
                                onClick={() => setMgrModal({ userId: user.id, userName: user.full_name })}
                                className="text-xs rounded px-2 py-0.5 transition-colors"
                                style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--color-brand-primary)', border: '1px solid rgba(99,102,241,0.2)', cursor: 'pointer', width: 'fit-content' }}>
                                {user.manager_id ? 'Change' : 'Set Manager'}
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <label className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input type="checkbox"
                                aria-label={`Active status for ${user.full_name}`}
                                checked={draft.is_active}
                                disabled={isSelf}
                                onChange={e => updateDraft(user.id, 'is_active', e.target.checked)}
                                className="rounded" />
                              <span className="text-xs" style={{ color: draft.is_active ? '#10B981' : '#9CA3AF' }}>
                                {draft.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </label>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => saveUser(user.id)}
                                disabled={saving || isSelf}
                                aria-label={`Save ${user.full_name}`}
                                className={cn('rounded px-3 py-1 text-xs font-semibold', (saving || isSelf) && 'opacity-40 cursor-not-allowed')}
                                style={{ background: 'var(--color-brand-primary)', color: '#fff' }}>
                                {saving ? 'Saving…' : 'Save'}
                              </button>
                              {msg?.ok  && <span className="text-xs" style={{ color: '#10B981' }}>{msg.ok}</span>}
                              {msg?.err && <span className="text-xs" style={{ color: '#F43F5E' }}>{msg.err}</span>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── TAB: SYSTEM ACTIONS ── */}
      {activeTab === 'system' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Seed Dummy Data */}
          <div style={sectionStyle}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <Sprout size={16} color="#F43F5E" />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Seed Dummy Data</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Populate the database with 15 employees × 30 days of realistic work logs.
                  Safe to run on an empty database — skips if users already exist.
                </p>
              </div>
            </div>
            {seedResult && (
              <p className="text-xs mb-3 px-3 py-2 rounded-md"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34D399' }}>
                {seedResult}
              </p>
            )}
            {seedConfirm ? (
              <div className="rounded-md px-3 py-2 mb-3" style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.2)' }}>
                <p className="text-xs mb-2" style={{ color: '#FB7185' }}>
                  This will add test data to the database. Continue?
                </p>
                <div className="flex gap-2">
                  <button onClick={handleSeedConfirm} disabled={seeding} aria-label="Confirm"
                    className="rounded px-3 py-1 text-xs font-semibold"
                    style={{ background: '#F43F5E', color: '#fff' }}>
                    {seeding ? 'Seeding…' : 'Confirm'}
                  </button>
                  <button onClick={() => setSeedConfirm(false)} aria-label="Cancel"
                    className="rounded px-3 py-1 text-xs font-medium"
                    style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setSeedConfirm(true)} disabled={seeding} aria-label="Seed dummy data"
                className={cn('rounded-md px-4 py-2 text-xs font-semibold', seeding && 'opacity-50 cursor-not-allowed')}
                style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', color: '#FB7185' }}>
                {seeding ? 'Seeding…' : 'Seed Data'}
              </button>
            )}
          </div>

          {/* Rebuild Index */}
          <div style={sectionStyle}>
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Database size={16} color="var(--color-brand-primary)" />
              </div>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>Rebuild ChromaDB Index</h3>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  Drops and rebuilds the entire vector search index from SQLite.
                  Use if vector search results seem stale or out of sync.
                </p>
              </div>
            </div>
            {reindexResult && (
              <p className="text-xs mb-3 px-3 py-2 rounded-md"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34D399' }}>
                {reindexResult}
              </p>
            )}
            <button onClick={handleReindex} disabled={reindexing} aria-label="Rebuild index"
              className={cn('inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold', reindexing && 'opacity-50 cursor-not-allowed')}
              style={{ border: '1px solid var(--color-border-default)', color: 'var(--color-text-secondary)' }}>
              <RefreshCw size={13} className={reindexing ? 'animate-spin' : ''} />
              {reindexing ? 'Rebuilding…' : 'Rebuild Index'}
            </button>
          </div>
        </div>
      )}

      {/* ── TAB: EXTRACTION ERRORS ── */}
      {activeTab === 'errors' && (
        <div className="flex flex-col gap-6">

          {/* Error metrics */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl p-4" style={sectionStyle}>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Total Errors</p>
              <p className="text-2xl font-bold font-mono mt-1" style={{ color: 'var(--color-text-primary)' }}>{errors.length}</p>
            </div>
            <div className="rounded-xl p-4" style={sectionStyle}>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Failed</p>
              <p className="text-2xl font-bold font-mono mt-1" style={{ color: '#F43F5E' }}>{failedCount}</p>
            </div>
            <div className="rounded-xl p-4" style={sectionStyle}>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-secondary)' }}>Needs Review</p>
              <p className="text-2xl font-bold font-mono mt-1" style={{ color: '#F59E0B' }}>{reviewCount}</p>
            </div>
          </div>

          {/* Filter + table */}
          <section style={sectionStyle} aria-labelledby="errors-heading">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 id="errors-heading" className="text-base font-semibold flex items-center gap-2"
                style={{ color: 'var(--color-text-primary)' }}>
                <AlertTriangle size={15} color="#F43F5E" />
                Extraction Errors
              </h2>
              {/* Status filter */}
              <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--color-bg-elevated)' }}>
                {(['all', 'failed', 'needs_review'] as const).map(f => (
                  <button key={f} onClick={() => setErrorFilter(f)}
                    aria-label={`Filter ${f}`}
                    className="rounded px-3 py-1 text-xs font-medium transition-all"
                    style={errorFilter === f
                      ? { background: 'var(--color-brand-primary)', color: '#fff' }
                      : { color: 'var(--color-text-secondary)' }}>
                    {f === 'all' ? 'All' : f === 'needs_review' ? 'Needs Review' : 'Failed'}
                  </button>
                ))}
              </div>
            </div>

            {errorsQ.isLoading ? <SkeletonTable rows={3} cols={4} /> :
             filteredErrors.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
                No extraction errors — all extractions succeeded.
              </p>
            ) : (
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border-subtle)' }}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr style={{ background: 'var(--color-bg-elevated)', borderBottom: '1px solid var(--color-border-default)' }}>
                      {['', 'Employee', 'Date', 'Status', 'Model', 'Submitted'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide"
                          style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredErrors.map(err => (
                      <>
                        <tr key={err.id}
                          className="cursor-pointer transition-colors hover:bg-[var(--color-bg-elevated)]"
                          style={{ borderTop: '1px solid var(--color-border-subtle)' }}
                          onClick={() => setExpandedError(expandedError === err.id ? null : err.id)}>
                          <td className="px-3 py-3 text-xs" style={{ color: 'var(--color-text-muted)', width: '28px' }}>
                            {expandedError === err.id
                              ? <ChevronDown size={13} />
                              : <ChevronRight size={13} />}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono" style={{ color: 'var(--color-text-secondary)' }}>
                            {err.employee_id}
                          </td>
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                            {err.work_date ? formatDateShort(err.work_date) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                              style={err.extraction_status === 'failed'
                                ? { background: 'rgba(244,63,94,0.12)', color: '#FB7185', border: '1px solid rgba(244,63,94,0.3)' }
                                : { background: 'rgba(245,158,11,0.12)', color: '#FBBF24', border: '1px solid rgba(245,158,11,0.3)' }}>
                              {err.extraction_status === 'needs_review' ? 'needs review' : err.extraction_status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                            {err.model_name ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {err.submitted_at ? formatDateShort(err.submitted_at) : '—'}
                          </td>
                        </tr>
                        {expandedError === err.id && (
                          <tr key={`${err.id}-raw`} style={{ borderTop: 'none', background: 'rgba(139,92,246,0.04)' }}>
                            <td colSpan={6} className="px-6 pb-4 pt-2">
                              <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>
                                Raw submission:
                              </p>
                              <pre className="text-xs rounded-md px-3 py-2 whitespace-pre-wrap break-words"
                                style={{
                                  background: 'var(--color-bg-elevated)',
                                  border: '1px solid var(--color-border-subtle)',
                                  color: 'var(--color-text-primary)',
                                  fontFamily: 'var(--font-mono)',
                                }}>
                                {err.raw_message}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* ── TAB: ACTIVITY LOG ── */}
      {activeTab === 'activity' && (
        <div className="flex flex-col gap-4">
          {/* Stats summary row */}
          {stats && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Total Work Logs',  value: stats.total_work_logs.toLocaleString(),  color: 'var(--color-brand-primary)' },
                { label: 'Work Items',       value: stats.total_work_items.toLocaleString(), color: '#10B981' },
                { label: 'Registered Users', value: stats.total_users.toLocaleString(),      color: '#0EA5E9' },
                { label: 'Error Rate',       value: `${stats.extraction_error_rate}%`,       color: stats.extraction_error_rate > 5 ? '#F43F5E' : '#F59E0B' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4" style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)' }}>
                  <p className="text-xs mb-1" style={{ color: 'var(--color-text-secondary)' }}>{s.label}</p>
                  <p className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Timeline */}
          <section style={sectionStyle} aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="flex items-center gap-2 text-base font-semibold mb-4"
              style={{ color: 'var(--color-text-primary)' }}>
              <Activity size={15} color="var(--color-brand-primary)" />
              Recent Activity
            </h2>
            {activityQ.isLoading ? (
              <div className="flex flex-col gap-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: 'var(--color-bg-elevated)' }} />)}</div>
            ) : (
              <div className="flex flex-col gap-0">
                {(activityQ.data ?? []).map((entry: ActivityLogEntry, idx: number) => {
                  const isOk      = entry.action === 'success'
                  const isFailed  = entry.action === 'failed'
                  const Icon      = isOk ? CheckCircle2 : isFailed ? XCircle : Clock
                  const color     = isOk ? '#10B981' : isFailed ? '#F43F5E' : '#F59E0B'
                  return (
                    <div key={entry.id} className="flex items-start gap-3 py-3"
                      style={{ borderBottom: idx < (activityQ.data?.length ?? 0) - 1 ? '1px solid var(--color-border-subtle)' : 'none' }}>
                      <Icon size={14} color={color} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" style={{ color: 'var(--color-text-primary)' }}>
                          <span style={{ fontWeight: 500 }}>{entry.employee_name}</span>
                          <span style={{ color: 'var(--color-text-muted)' }}> · {entry.employee_id}</span>
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {entry.work_date ?? '—'} · {entry.submitted_at ? formatDateShort(entry.submitted_at) : '—'}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: `${color}18`, color }}>
                        {entry.action.replace('_', ' ')}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>

      {/* ── Manager assignment modal ── */}

      {mgrModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
          onClick={() => { setMgrModal(null); setMgrSearch(''); setMgrResults([]) }}>
          <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-subtle)', borderRadius: 14, padding: 24, width: 360, boxShadow: '0 24px 48px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                Set Manager — {mgrModal.userName}
              </h3>
              <button onClick={() => { setMgrModal(null); setMgrSearch(''); setMgrResults([]) }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
              <input
                autoFocus
                value={mgrSearch}
                onChange={e => setMgrSearch(e.target.value)}
                placeholder="Search by name…"
                style={{ width: '100%', height: 38, paddingLeft: 32, paddingRight: 12, borderRadius: 8, border: '1px solid var(--color-border-default)', background: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {mgrResults.length > 0 && (
              <div style={{ borderRadius: 8, border: '1px solid var(--color-border-default)', overflow: 'hidden', marginBottom: 12 }}>
                {mgrResults.map(u => (
                  <button key={u.id}
                    onClick={() => applyManager(mgrModal.userId, u.id, u.full_name)}
                    disabled={settingMgr}
                    style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--color-border-subtle)', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>{u.full_name}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{u.department ?? u.email}</span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => applyManager(mgrModal.userId, null, null)}
              disabled={settingMgr}
              style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--color-border-default)', background: 'none', color: 'var(--color-status-danger)', fontSize: 13, cursor: 'pointer' }}>
              Remove manager (set as top-level)
            </button>
          </div>
        </div>
      )}
    </>
  )
}
