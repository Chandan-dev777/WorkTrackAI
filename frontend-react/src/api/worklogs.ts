import { apiClient } from './client'
import type { WorkItem } from '@/types/models'

export interface WorklogParams {
  start_date?: string
  end_date?: string
  employee_id?: string
}

export interface ContinueTaskPayload {
  hours_today?: number | null
  status?: string | null
  note?: string | null
  work_date?: string
}

export interface BulkUpdatePayload {
  item_ids: string[]
  status?: string
  hours_to_add?: number
}

export const worklogsApi = {
  getMy: (params?: WorklogParams) =>
    apiClient.get<WorkItem[]>('/worklogs/my', { params }).then(r => r.data),

  getTeam: (params?: WorklogParams) =>
    apiClient.get<WorkItem[]>('/worklogs/team', { params }).then(r => r.data),

  updateItem: (id: string, data: Partial<WorkItem>) =>
    apiClient.put<WorkItem>(`/worklogs/${id}`, data).then(r => r.data),

  getOpen: (daysBack = 14) =>
    apiClient.get<WorkItem[]>('/worklogs/my/open', { params: { days_back: daysBack } }).then(r => r.data),

  continueTask: (id: string, payload: ContinueTaskPayload) =>
    apiClient.post<WorkItem>(`/worklogs/${id}/continue`, payload).then(r => r.data),

  bulkUpdate: (payload: BulkUpdatePayload) =>
    apiClient.patch<WorkItem[]>('/worklogs/bulk-update', payload).then(r => r.data),
}
