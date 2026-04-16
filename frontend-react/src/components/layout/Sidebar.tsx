import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, PlusCircle, BarChart3, Users,
  MessageSquare, Shield, Settings, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { canAccess } from '@/utils/roleGuard'
import { cn } from '@/utils/cn'
import type { Role } from '@/utils/roleGuard'

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
  minRole: Role
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      path: '/dashboard',    icon: LayoutDashboard, minRole: 'employee' },
  { label: 'Submit Update',  path: '/submit',       icon: PlusCircle,      minRole: 'employee' },
  { label: 'My Dashboard',   path: '/my-dashboard', icon: BarChart3,       minRole: 'employee' },
  { label: 'Team Dashboard', path: '/team',         icon: Users,           minRole: 'manager'  },
  { label: 'Chat Assistant', path: '/chat',         icon: MessageSquare,   minRole: 'employee' },
  { label: 'Admin',          path: '/admin',        icon: Shield,          minRole: 'admin'    },
  { label: 'Settings',       path: '/settings',     icon: Settings,        minRole: 'employee' },
]

export function Sidebar() {
  const user       = useAuthStore((s) => s.user)
  const open       = useUIStore((s) => s.sidebarOpen)
  const toggle     = useUIStore((s) => s.toggleSidebar)
  const userRole   = (user?.role ?? 'employee') as Role

  const visibleItems = NAV_ITEMS.filter((item) => canAccess(userRole, item.minRole))

  return (
    <aside
      style={{
        width: open ? 240 : 60,
        minWidth: open ? 240 : 60,
        transition: 'width 250ms cubic-bezier(0.16,1,0.3,1)',
        backgroundColor: 'var(--color-bg-surface)',
        borderRight: '1px solid var(--color-border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Nav items */}
      <nav style={{ flex: 1, padding: '8px 8px', marginTop: 8 }} aria-label="Main navigation">
        {visibleItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              aria-label={item.label}
              title={item.label}
              style={{ textDecoration: 'none', display: 'block', marginBottom: 2 }}
            >
              {({ isActive }) => (
                <span
                  className={cn(
                    'flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-100',
                    isActive
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                  )}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <Icon size={20} strokeWidth={1.5} style={{ flexShrink: 0 }} />
                  {open && (
                    <span style={{ opacity: open ? 1 : 0, transition: 'opacity 150ms' }}>
                      {item.label}
                    </span>
                  )}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid var(--color-border-subtle)' }}>
        <button
          onClick={toggle}
          aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
          className="flex items-center justify-center w-full rounded-md p-2 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors duration-100"
        >
          {open ? <ChevronLeft size={18} strokeWidth={1.5} /> : <ChevronRight size={18} strokeWidth={1.5} />}
          {open && <span style={{ marginLeft: 8, fontSize: 13 }}>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
