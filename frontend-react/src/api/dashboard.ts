import { apiClient } from './client'

export interface HoursSummary {
  total_hours: number
  total_items: number
  done_count: number
  in_progress_count: number
  blocked_count: number
  planned_count: number
  start_date: string
  end_date: string
}

export interface CategoryHours {
  category: string
  hours: number
  item_count?: number
}

export interface StatusCount {
  status: string
  count: number
}

export interface DailyHours {
  date: string
  hours: number
  item_count?: number
}

export interface DateRangeParams {
  start_date?: string
  end_date?: string
}

export const dashboardApi = {
  getSummary: (params?: DateRangeParams) =>
    apiClient.get<HoursSummary>('/dashboard/summary', { params }).then(r => r.data),

  getCategories: (params?: DateRangeParams) =>
    apiClient.get<CategoryHours[]>('/dashboard/categories', { params }).then(r => r.data),

  getStatus: (params?: DateRangeParams) =>
    apiClient.get<StatusCount[]>('/dashboard/status', { params }).then(r => r.data),

  getTrend: (params?: DateRangeParams) =>
    apiClient.get<DailyHours[]>('/dashboard/trend', { params }).then(r => r.data),
}
