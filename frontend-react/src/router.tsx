import { lazy, Suspense, Component, type ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { canAccess } from '@/utils/roleGuard'
import { Shell } from '@/components/layout/Shell'
import type { Role } from '@/utils/roleGuard'

// ── Chunk-load retry helper ───────────────────────────────────────────────────
// After a deploy, chunk hashes change. If a stale bundle tries to import() an
// old chunk name, the 404 is caught here and we reload the page once.
function lazyRetry(importFn: () => Promise<{ default: React.ComponentType<any> }>) {
  return lazy(async () => {
    try {
      const module = await importFn()
      sessionStorage.removeItem('chunk-reload')
      return module
    } catch {
      if (!sessionStorage.getItem('chunk-reload')) {
        sessionStorage.setItem('chunk-reload', '1')
        window.location.reload()
      }
      return { default: () => null }
    }
  })
}

// ── Lazy page imports ─────────────────────────────────────────────────────────
const LoginPage         = lazyRetry(() => import('@/pages/auth/LoginPage'))
const RegisterPage      = lazyRetry(() => import('@/pages/auth/RegisterPage'))
const SetPasswordPage   = lazyRetry(() => import('@/pages/auth/SetPasswordPage'))
const OnboardingPage    = lazyRetry(() => import('@/pages/auth/OnboardingPage'))
const OrgChartPage      = lazyRetry(() => import('@/pages/org/OrgChartPage'))
const HomeDashboard     = lazyRetry(() => import('@/pages/dashboard/HomeDashboard'))
const SubmitUpdatePage  = lazyRetry(() => import('@/pages/submit/SubmitUpdatePage'))
const TasksPage         = lazyRetry(() => import('@/pages/tasks/TasksPage'))
const MyDashboardPage   = lazyRetry(() => import('@/pages/dashboard/MyDashboardPage'))
const TeamDashboardPage = lazyRetry(() => import('@/pages/team/TeamDashboardPage'))
const ChatPage          = lazyRetry(() => import('@/pages/chat/ChatPage'))
const AdminPage         = lazyRetry(() => import('@/pages/admin/AdminPage'))
const SettingsPage      = lazyRetry(() => import('@/pages/settings/SettingsPage'))

// ── Guards ────────────────────────────────────────────────────────────────────
function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user            = useAuthStore((s) => s.user)
  const location        = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  // Force onboarding if not yet completed — catches users who skipped it via stored JWT
  if (user && !user.onboarding_complete && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return <>{children}</>
}

/** Redirects already-authenticated users away from login/register */
function RequireGuest({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

function RequireRole({ role, children }: { role: Role; children: React.ReactNode }) {
  const userRole = useAuthStore((s) => s.user?.role ?? 'employee') as Role
  if (!canAccess(userRole, role)) {
    return <Navigate to="/dashboard" replace />
  }
  return <>{children}</>
}

const PageLoader = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'var(--color-text-muted)' }}>
    Loading…
  </div>
)

class ChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', gap: 16, color: 'var(--color-text-secondary)' }}>
          <p style={{ fontSize: 15 }}>A new version was deployed. Please refresh the page.</p>
          <button
            onClick={() => { sessionStorage.removeItem('chunk-reload'); window.location.reload() }}
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--color-border-subtle)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', cursor: 'pointer', fontSize: 14 }}
          >
            Refresh now
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Router ────────────────────────────────────────────────────────────────────
export function AppRouter() {
  return (
    <ChunkErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public — redirect authenticated users to dashboard */}
        <Route path="/login"        element={<RequireGuest><LoginPage /></RequireGuest>} />
        <Route path="/register"     element={<RequireGuest><RegisterPage /></RequireGuest>} />
        {/* Set password — requires auth, shown after first SSO login */}
        <Route path="/set-password" element={<RequireAuth><SetPasswordPage /></RequireAuth>} />
        {/* Onboarding — requires auth, shown after first SSO login */}
        <Route path="/onboarding"   element={<RequireAuth><OnboardingPage /></RequireAuth>} />

        {/* Org chart — requires auth */}
        <Route path="/org" element={<RequireAuth><Shell><OrgChartPage /></Shell></RequireAuth>} />

        {/* Root redirect */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Navigate to="/dashboard" replace />
            </RequireAuth>
          }
        />

        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Shell><HomeDashboard /></Shell>
            </RequireAuth>
          }
        />

        <Route
          path="/submit"
          element={
            <RequireAuth>
              <Shell><SubmitUpdatePage /></Shell>
            </RequireAuth>
          }
        />

        <Route
          path="/tasks"
          element={
            <RequireAuth>
              <Shell><TasksPage /></Shell>
            </RequireAuth>
          }
        />

        <Route path="/projects" element={<Navigate to="/tasks" replace />} />

        <Route
          path="/my-dashboard"
          element={
            <RequireAuth>
              <Shell><MyDashboardPage /></Shell>
            </RequireAuth>
          }
        />

        <Route
          path="/team"
          element={
            <RequireAuth>
              <RequireRole role="manager">
                <Shell><TeamDashboardPage /></Shell>
              </RequireRole>
            </RequireAuth>
          }
        />

        <Route
          path="/chat"
          element={
            <RequireAuth>
              <Shell><ChatPage /></Shell>
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireRole role="admin">
                <Shell><AdminPage /></Shell>
              </RequireRole>
            </RequireAuth>
          }
        />

        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Shell><SettingsPage /></Shell>
            </RequireAuth>
          }
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
    </ChunkErrorBoundary>
  )
}
