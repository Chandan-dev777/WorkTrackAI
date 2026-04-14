import type { Role } from '@/utils/roleGuard'

export interface User {
  id: number
  username: string
  email: string
  role: Role
  full_name: string
}

export interface WorkItem {
  id: number
  work_log_id: number
  description: string
  hours: number
  category: string
  status: 'done' | 'in_progress' | 'blocked'
  work_date: string
  needs_review: boolean
  employee_id: number
  employee_name?: string
}

export interface WorkLog {
  id: number
  user_id: number
  raw_text: string
  work_date: string
  extraction_status: 'pending' | 'confirmed' | 'failed' | 'needs_review'
  submitted_at: string
  items: WorkItem[]
}

export interface ExtractionResult {
  work_log_id: number
  work_date: string
  items: WorkItemExtracted[]
}

export interface WorkItemExtracted {
  description: string
  hours: number
  category: string
  status: 'done' | 'in_progress' | 'blocked'
}

export interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  created_at: string
  sources?: SourceReference[]
  query_source?: 'sql' | 'vector' | 'hybrid'
}

export interface SourceReference {
  work_log_id: number
  excerpt: string
  work_date: string
  employee_name?: string
}
