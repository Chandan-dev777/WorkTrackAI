import type { Role } from '@/utils/roleGuard'

export interface User {
  id: string           // UUID string from backend
  employee_id: string
  full_name: string
  email: string
  role: Role
  team_name: string | null
  department: string | null
  is_active: boolean
}

export type WorkCategory =
  | 'project' | 'ticket' | 'polaris_classification' | 'admin'
  | 'meeting' | 'learning' | 'support' | 'documentation' | 'review' | 'other'

export type StatusType = 'planned' | 'in_progress' | 'blocked' | 'done'

export interface WorkItemExtracted {
  task_description: string
  work_category: WorkCategory
  hours_spent: number | null
  status: StatusType | null
  priority?: 'low' | 'medium' | 'high' | null
  blockers?: string | null
  next_steps?: string | null
  tags?: string[] | null
  links?: string[] | null
  project_name?: string | null
  ticket_id?: string | null
  confidence_score?: number | null
  clarification_needed?: boolean
  clarification_reason?: string | null
}

export interface ExtractionResult {
  work_log_id: string
  work_date: string
  extraction_status: string
  items: WorkItemExtracted[]
  total_hours_warning: boolean
  has_clarification_needed: boolean
}

export interface WorkItem {
  id: string
  work_log_id: string
  employee_id: string
  work_date: string
  task_description: string
  work_category: string
  hours_spent: number | null
  status: string | null
  priority: string | null
  blockers: string | null
  next_steps: string | null
  tags: string[] | null
  links: string[] | null
  project_name: string | null
  ticket_id: string | null
  confidence_score: number | null
  needs_review: boolean
  clarification_needed: boolean
  clarification_reason: string | null
  is_user_corrected: boolean
  logical_task_id: string | null
  continuation_of: string | null
  created_at: string
  updated_at: string
  employee_name?: string
}

export interface UserTemplate {
  id: string
  user_id: string
  label: string
  text: string
  created_at: string
  updated_at: string
}

export interface WorkLog {
  id: string
  user_id: string
  raw_message: string
  work_date: string
  extraction_status: string
  submitted_at: string
  is_deleted: boolean
  work_items: WorkItem[]
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

// ── Help Widget / Assistant Notes ─────────────────────────────────────────────

export type NoteType = 'bug' | 'requirement' | 'feedback'
export type NotePriority = 'low' | 'medium' | 'high' | 'critical'
export type NoteStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'wont_fix'

export interface AssistantNote {
  id: string
  user_id: string
  type: NoteType
  title: string
  body: string
  priority: NotePriority
  status: NoteStatus
  affected_page: string | null
  created_at: string
  updated_at: string
}

export interface NoteCreate {
  type: NoteType
  title: string
  body: string
  priority?: NotePriority
  affected_page?: string | null
}

export interface NoteUpdate {
  title?: string
  body?: string
  priority?: NotePriority
  status?: NoteStatus
  affected_page?: string | null
}

// Widget-local message type
export interface HelpMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCall?: string   // e.g. "Saved Bug #abc123: Login page 401"
  isError?: boolean
}
