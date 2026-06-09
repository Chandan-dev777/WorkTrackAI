import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { canAccess } from '@/utils/roleGuard'
import { Shell } from '@/components/layout/Shell'
import type { Role } from '@/utils/roleGuard'

// ── Lazy page imports ─────────────────────────────────────────────────────────
const LoginPage         = lazy(() => import('@/pages/auth/LoginPage'))
const RegisterPage      = lazy(() => import('@/pages/auth/RegisterPage'))
const SetPasswordPage   = lazy(() => import('@/pages/auth/SetPasswordPage'))
const OnboardingPage    = lazy(() => import('@/pages/auth/OnboardingPage'))
const OrgChartPage      = lazy(() => import('@/pages/org/OrgChartPage'))
const HomeDashboard     = lazy(() => import('@/pages/dashboard/HomeDashboard'))
const SubmitUpdatePage  = lazy(() => import('@/pages/submit/SubmitUpdatePage'))
const TasksPage         = lazy(() => import('@/pages/tasks/TasksPage'))
const MyDashboardPage   = lazy(() => import('@/pages/dashboard/MyDashboardPage'))
const TeamDashboardPage = lazy(() => import('@/pages/team/TeamDashboardPage'))
const ChatPage          = lazy(() => import('@/pages/chat/ChatPage'))
const AdminPage         = lazy(() => import('@/pages/admin/AdminPage'))
const SettingsPage      = lazy(() => import('@/pages/settings/SettingsPage'))

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

// ── Router ────────────────────────────────────────────────────────────────────
export function AppRouter() {
  return (
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

        {/* Authenticated — wrapped in Shell */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <Shell><PageLoader /></Shell>
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
  )
}
