import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, ChevronDown, ChevronRight, X, Building2 } from 'lucide-react'
import { orgApi } from '@/api/org'
import type { OrgNode } from '@/api/org'
import { useAuthStore } from '@/store/authStore'
import { SkeletonCard } from '@/components/common/Skeleton'

// ── Role colours ──────────────────────────────────────────────────────────────

const ROLE_COLORS = {
  admin:    { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)', text: '#A78BFA', label: 'Admin' },
  manager:  { bg: 'rgba(14,165,233,0.12)',  border: 'rgba(14,165,233,0.35)',  text: '#38BDF8', label: 'Manager' },
  employee: { bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.25)', text: '#9CA3AF', label: 'Employee' },
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ── Single org node card ──────────────────────────────────────────────────────

function OrgCard({ node, onSelect, selectedId, depth }: {
  node: OrgNode
  onSelect: (n: OrgNode) => void
  selectedId: string | null
  depth: number
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const hasReports = node.reports.length > 0
  const rc = ROLE_COLORS[node.role] ?? ROLE_COLORS.employee
  const isSelected = node.id === selectedId

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Card */}
      <div
        onClick={() => onSelect(node)}
        style={{
          cursor: 'pointer',
          padding: '14px 18px',
          borderRadius: 12,
          border: `2px solid ${isSelected ? 'var(--color-brand-primary)' : rc.border}`,
          background: isSelected ? 'rgba(99,102,241,0.1)' : rc.bg,
          minWidth: 160,
          maxWidth: 200,
          textAlign: 'center',
          transition: 'all 150ms',
          boxShadow: isSelected ? '0 0 0 3px rgba(99,102,241,0.2)' : 'none',
          position: 'relative',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: `linear-gradient(135deg, ${rc.text}33, ${rc.text}66)`,
          border: `2px solid ${rc.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 10px', fontSize: 16, fontWeight: 700, color: rc.text,
        }}>
          {initials(node.full_name)}
        </div>

        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
          {node.full_name}
        </p>
        {node.department && (
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--color-text-muted)' }}>
            {node.department}
          </p>
        )}
        <span style={{
          display: 'inline-block', marginTop: 8,
          padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500,
          background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`,
        }}>
          {rc.label}
        </span>

        {/* Expand/collapse */}
        {hasReports && (
          <button
            onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
            style={{
              position: 'absolute', bottom: -12, left: '50%', transform: 'translateX(-50%)',
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--color-bg-surface)', border: '1px solid var(--color-border-default)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', zIndex: 1,
            }}
          >
            {expanded
              ? <ChevronDown size={12} color="var(--color-text-muted)" />
              : <ChevronRight size={12} color="var(--color-text-muted)" />}
          </button>
        )}
      </div>

      {/* Children */}
      {hasReports && expanded && (
        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Connector line */}
          <div style={{ width: 2, height: 16, background: 'var(--color-border-subtle)', marginBottom: 0 }} />

          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', position: 'relative' }}>
            {/* Horizontal connector bar */}
            {node.reports.length > 1 && (
              <div style={{
                position: 'absolute', top: 0, left: '10%', right: '10%',
                height: 2, background: 'var(--color-border-subtle)',
              }} />
            )}
            {node.reports.map(child => (
              <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 2, height: 16, background: 'var(--color-border-subtle)' }} />
                <OrgCard node={child} onSelect={onSelect} selectedId={selectedId} depth={depth + 1} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ node, onClose }: { node: OrgNode; onClose: () => void }) {
  const rc = ROLE_COLORS[node.role] ?? ROLE_COLORS.employee
  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 300,
      background: 'var(--color-bg-surface)', borderLeft: '1px solid var(--color-border-subtle)',
      padding: 24, overflowY: 'auto', zIndex: 100,
      boxShadow: '-8px 0 32px rgba(0,0,0,0.12)',
    }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
        <X size={18} />
      </button>

      {/* Avatar */}
      <div style={{ width: 64, height: 64, borderRadius: '50%', background: `linear-gradient(135deg, ${rc.text}33, ${rc.text}66)`, border: `2px solid ${rc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: rc.text, margin: '0 auto 16px' }}>
        {initials(node.full_name)}
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text-primary)', textAlign: 'center', margin: '0 0 4px' }}>{node.full_name}</h3>
      <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', margin: '0 0 20px' }}>{node.email}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { label: 'Role', value: rc.label },
          { label: 'Employee ID', value: node.employee_id },
          { label: 'Department', value: node.department ?? '—' },
          { label: 'Team', value: node.team_name ?? '—' },
          { label: 'Direct reports', value: String(node.reports.length) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</p>
            <p style={{ margin: '3px 0 0', fontSize: 14, color: 'var(--color-text-primary)' }}>{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OrgChartPage() {
  const currentUser = useAuthStore(s => s.user)
  const [selected, setSelected] = useState<OrgNode | null>(null)

  const { data: tree, isLoading, isError } = useQuery({
    queryKey: ['org-tree'],
    queryFn: orgApi.getTree,
    staleTime: 60_000,
  })

  const totalNodes = (nodes: OrgNode[]): number =>
    nodes.reduce((acc, n) => acc + 1 + totalNodes(n.reports), 0)

  return (
    <div style={{ padding: '32px 32px 64px', minHeight: '100vh', paddingRight: selected ? 332 : 32 }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={20} color="var(--color-brand-primary)" />
          </div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>Org Chart</h1>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
              {currentUser?.role === 'admin' ? 'Full organisation' : currentUser?.role === 'manager' ? 'Your team hierarchy' : 'Your place in the team'} · {tree ? totalNodes(tree) : '…'} people
            </p>
          </div>
        </div>
      </div>

      {isLoading && <SkeletonCard />}

      {isError && (
        <div style={{ padding: 24, borderRadius: 12, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: 'var(--color-status-danger)', fontSize: 14 }}>
          Failed to load org chart. Please refresh.
        </div>
      )}

      {tree && tree.length === 0 && (
        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--color-text-muted)' }}>
          <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <p>No org structure set up yet. Complete onboarding to get started.</p>
        </div>
      )}

      {tree && tree.length > 0 && (
        <div style={{ overflowX: 'auto', paddingBottom: 32 }}>
          <div style={{ display: 'flex', gap: 40, justifyContent: 'center', flexWrap: 'wrap', minWidth: 'max-content', padding: '16px 32px' }}>
            {tree.map(root => (
              <OrgCard key={root.id} node={root} onSelect={setSelected} selectedId={selected?.id ?? null} depth={0} />
            ))}
          </div>
        </div>
      )}

      {selected && <DetailPanel node={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
