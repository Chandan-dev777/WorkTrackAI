import { apiClient } from './client'

export interface AdminUser {
  id: string
  employee_id: string
  full_name: string
  email: string
  role: 'employee' | 'manager' | 'admin'
  team_name: string | null
  department: string | null
  is_active: boolean
  manager_id?: string | null
}

export interface ExtractionError {
  id: string
  employee_id: string
  work_date: string | null
  extraction_status: 'failed' | 'needs_review'
  raw_message: string
  model_name: string | null
  submitted_at: string | null
}

export interface ReindexResult {
  indexed: number
  message: string
}

export interface UserUpdatePayload {
  role?: AdminUser['role']
  is_active?: boolean
  team_name?: string
  department?: string
}

export interface AdminStats {
  total_work_logs: number
  total_work_items: number
  total_users: number
  extraction_errors: number
  extraction_error_rate: number
}

export interface ActivityLogEntry {
  id: string
  employee_name: string
  employee_id: string
  action: string
  work_date: string | null
  submitted_at: string | null
}

export const adminApi = {
  getUsers: () =>
    apiClient.get<AdminUser[]>('/admin/users').then(r => r.data),

  updateUser: (userId: string, payload: UserUpdatePayload) =>
    apiClient.put<AdminUser>(`/admin/users/${userId}`, payload).then(r => r.data),

  getExtractionErrors: () =>
    apiClient.get<ExtractionError[]>('/admin/extraction-errors').then(r => r.data),

  reindex: () =>
    apiClient.post<ReindexResult>('/admin/reindex').then(r => r.data),

  seedDummyData: () =>
    apiClient.post<{ message: string }>('/admin/seed-dummy-data').then(r => r.data),

  getStats: () =>
    apiClient.get<AdminStats>('/admin/stats').then(r => r.data),

  getActivityLog: (limit = 50) =>
    apiClient.get<ActivityLogEntry[]>('/admin/activity-log', { params: { limit } }).then(r => r.data),

  setManager: (userId: string, managerId: string | null) =>
    apiClient.put(`/api/org/users/${userId}/manager`, { manager_id: managerId }).then(r => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiClient.post<{ message: string }>('/api/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    }).then(r => r.data),
}
