import { apiClient } from './client'

export interface OrgNode {
  id: string
  full_name: string
  employee_id: string
  email: string
  role: 'employee' | 'manager' | 'admin'
  department: string | null
  team_name: string | null
  manager_id: string | null
  is_active: boolean
  reports: OrgNode[]
}

export interface UserSearchResult {
  id: string
  full_name: string
  email: string
  employee_id: string
  role: string
  department: string | null
}

export interface OnboardingPayload {
  full_name?: string
  role?: 'employee' | 'manager'
  manager_id?: string | null
  team_name?: string
  department?: string
}

export const orgApi = {
  getTree: () =>
    apiClient.get<OrgNode[]>('/api/org/tree').then(r => r.data),

  searchUsers: (q: string) =>
    apiClient.get<UserSearchResult[]>('/api/org/users/search', { params: { q } }).then(r => r.data),

  setManager: (userId: string, managerId: string | null) =>
    apiClient.put(`/api/org/users/${userId}/manager`, { manager_id: managerId }).then(r => r.data),

  completeOnboarding: (payload: OnboardingPayload) =>
    apiClient.post('/api/auth/onboarding', payload).then(r => r.data),

  updateProfile: (payload: { full_name?: string; team_name?: string; department?: string; manager_id?: string | null }) =>
    apiClient.put('/api/auth/profile', payload).then(r => r.data),
}
