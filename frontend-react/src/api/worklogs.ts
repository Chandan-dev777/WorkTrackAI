import { apiClient } from './client'
import type { WorkItem } from '@/types/models'

export interface WorklogParams {
  start_date?: string
  end_date?: string
  employee_id?: string
}

export const worklogsApi = {
  getMy: (params?: WorklogParams) =>
    apiClient.get<WorkItem[]>('/worklogs/my', { params }).then(r => r.data),

  getTeam: (params?: WorklogParams) =>
    apiClient.get<WorkItem[]>('/worklogs/team', { params }).then(r => r.data),

  updateItem: (id: string, data: Partial<WorkItem>) =>
    apiClient.put<WorkItem>(`/worklogs/${id}`, data).then(r => r.data),
}
