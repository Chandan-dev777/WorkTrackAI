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
}
