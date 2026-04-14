import { apiClient } from './client'

export interface ChatQueryRequest {
  question: string
  session_id?: string
}

export interface SourceReference {
  work_item_id: string
  work_date: string
  task_description: string
  work_category: string
  employee_id: string
}

export interface ChatResponse {
  answer: string
  query_source: string
  session_id: string
  sources: SourceReference[]
}

export interface ChatHistoryItem {
  id: string
  question: string
  answer: string
  query_source: string | null
  session_id: string
  created_at: string
}

export const chatApi = {
  query: (data: ChatQueryRequest) =>
    apiClient.post<ChatResponse>('/chat/query', data).then(r => r.data),

  history: (session_id?: string, limit = 50) =>
    apiClient.get<ChatHistoryItem[]>('/chat/history', { params: { session_id, limit } }).then(r => r.data),
}
