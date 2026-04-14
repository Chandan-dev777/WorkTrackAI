import { http, HttpResponse } from 'msw'

const BASE = ''

export const handlers = [
  // ── Auth ──────────────────────────────────────────────────────────────────
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    if (body.email === 'alice@example.com' && body.password === 'password123') {
      return HttpResponse.json({ access_token: 'mock-jwt-token-alice', token_type: 'bearer' })
    }
    return HttpResponse.json({ detail: 'Incorrect email or password' }, { status: 401 })
  }),

  http.post(`${BASE}/auth/register`, async () => {
    return HttpResponse.json(
      { access_token: 'mock-jwt-new-user', token_type: 'bearer' },
      { status: 201 }
    )
  }),

  http.get(`${BASE}/auth/me`, ({ request }) => {
    const auth = request.headers.get('Authorization')
    if (!auth) return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    return HttpResponse.json({
      id: 'uuid-alice-001',
      employee_id: 'EMP-001',
      full_name: 'Alice Smith',
      email: 'alice@example.com',
      role: 'employee',
      team_name: 'Engineering',
      department: 'Technology',
      is_active: true,
    })
  }),

  // ── Work Updates ──────────────────────────────────────────────────────────
  http.post(`${BASE}/updates/submit`, async () => {
    return HttpResponse.json({
      work_log_id: 'wl-mock-001',
      work_date: new Date().toISOString().split('T')[0],
      extraction_status: 'pending',
      total_hours_warning: false,
      has_clarification_needed: false,
      items: [
        { task_description: 'Fixed authentication bug', work_category: 'project', hours_spent: 3, status: 'done', clarification_needed: false },
        { task_description: 'Sprint planning meeting', work_category: 'meeting', hours_spent: 1, status: 'done', clarification_needed: false },
      ],
    })
  }),

  http.put(`${BASE}/updates/:id/confirm`, async () => {
    return HttpResponse.json({ id: 42, extraction_status: 'confirmed' })
  }),

  // ── Dashboard stubs (used from Phase 5 onward) ────────────────────────────
  http.get(`${BASE}/dashboard/summary`, () =>
    HttpResponse.json({
      total_hours: 42.5, total_items: 18,
      done_count: 12, in_progress_count: 4, blocked_count: 2, planned_count: 0,
      start_date: '2026-03-15', end_date: '2026-04-14',
    })
  ),
  http.get(`${BASE}/dashboard/categories`, () =>
    HttpResponse.json([
      { category: 'Development', hours: 20, item_count: 8 },
      { category: 'Testing', hours: 8, item_count: 3 },
      { category: 'Meeting', hours: 6, item_count: 4 },
    ])
  ),
  http.get(`${BASE}/dashboard/status`, () =>
    HttpResponse.json([
      { status: 'done', count: 12 },
      { status: 'in_progress', count: 4 },
      { status: 'blocked', count: 2 },
    ])
  ),
  http.get(`${BASE}/dashboard/trend`, () =>
    HttpResponse.json([
      { date: '2026-04-07', hours: 6, item_count: 3 },
      { date: '2026-04-08', hours: 7.5, item_count: 4 },
      { date: '2026-04-09', hours: 5, item_count: 2 },
    ])
  ),

  // ── Team Dashboard (Phase 6) ──────────────────────────────────────────────
  http.get(`${BASE}/dashboard/team/summary`, () =>
    HttpResponse.json([
      { employee_id: 'EMP-001', full_name: 'Alice Smith',   total_hours: 42.5, done_count: 12, blocked_count: 1, last_activity: '2026-04-13' },
      { employee_id: 'EMP-002', full_name: 'Bob Jones',     total_hours: 36.0, done_count: 10, blocked_count: 2, last_activity: '2026-04-12' },
      { employee_id: 'EMP-003', full_name: 'Carol Williams', total_hours: 28.5, done_count: 8,  blocked_count: 0, last_activity: '2026-04-11' },
    ])
  ),

  http.get(`${BASE}/dashboard/employees`, () =>
    HttpResponse.json([
      { employee_id: 'EMP-001', full_name: 'Alice Smith',   total_hours: 42.5, done_count: 12, blocked_count: 1, last_activity: '2026-04-13' },
      { employee_id: 'EMP-002', full_name: 'Bob Jones',     total_hours: 36.0, done_count: 10, blocked_count: 2, last_activity: '2026-04-12' },
      { employee_id: 'EMP-003', full_name: 'Carol Williams', total_hours: 28.5, done_count: 8,  blocked_count: 0, last_activity: '2026-04-11' },
    ])
  ),

  http.get(`${BASE}/dashboard/team/categories`, () =>
    HttpResponse.json([
      { category: 'project',  hours: 55.0, item_count: 20 },
      { category: 'meeting',  hours: 18.0, item_count: 12 },
      { category: 'review',   hours: 14.0, item_count: 8  },
      { category: 'learning', hours: 20.0, item_count: 6  },
    ])
  ),

  http.get(`${BASE}/worklogs/team`, ({ request }) => {
    const url = new URL(request.url)
    const employeeId = url.searchParams.get('employee_id')
    const allItems = [
      {
        id: 'ti-001', work_log_id: 'wl-t01', employee_id: 'EMP-001',
        work_date: '2026-04-13', task_description: 'Fixed auth bug',
        work_category: 'project', hours_spent: 3, status: 'done',
        priority: null, blockers: null, next_steps: null, tags: null,
        project_name: null, ticket_id: null, confidence_score: null,
        needs_review: false, clarification_needed: false, clarification_reason: null,
        is_user_corrected: false, created_at: '2026-04-13T09:00:00', updated_at: '2026-04-13T09:00:00',
        employee_name: 'Alice Smith',
      },
      {
        id: 'ti-002', work_log_id: 'wl-t02', employee_id: 'EMP-002',
        work_date: '2026-04-12', task_description: 'Deployment blocked by infra',
        work_category: 'project', hours_spent: 2, status: 'blocked',
        priority: 'high', blockers: 'Infra team unavailable', next_steps: null, tags: null,
        project_name: null, ticket_id: null, confidence_score: null,
        needs_review: true, clarification_needed: false, clarification_reason: null,
        is_user_corrected: false, created_at: '2026-04-12T11:00:00', updated_at: '2026-04-12T11:00:00',
        employee_name: 'Bob Jones',
      },
      {
        id: 'ti-003', work_log_id: 'wl-t03', employee_id: 'EMP-003',
        work_date: '2026-04-11', task_description: 'Code review session',
        work_category: 'review', hours_spent: 1.5, status: 'done',
        priority: null, blockers: null, next_steps: null, tags: null,
        project_name: null, ticket_id: null, confidence_score: null,
        needs_review: false, clarification_needed: false, clarification_reason: null,
        is_user_corrected: false, created_at: '2026-04-11T14:00:00', updated_at: '2026-04-11T14:00:00',
        employee_name: 'Carol Williams',
      },
    ]
    const filtered = employeeId ? allItems.filter(i => i.employee_id === employeeId) : allItems
    return HttpResponse.json(filtered)
  }),

  // ── Work Logs (Phase 5) ───────────────────────────────────────────────────
  http.get(`${BASE}/worklogs/my`, () =>
    HttpResponse.json([
      {
        id: 'wi-001', work_log_id: 'wl-001', employee_id: 'EMP-001',
        work_date: '2026-04-13', task_description: 'Fixed auth bug',
        work_category: 'project', hours_spent: 3, status: 'done',
        priority: null, blockers: null, next_steps: null, tags: null,
        project_name: null, ticket_id: null, confidence_score: null,
        needs_review: false, clarification_needed: false, clarification_reason: null,
        is_user_corrected: false, created_at: '2026-04-13T09:00:00', updated_at: '2026-04-13T09:00:00',
      },
      {
        id: 'wi-002', work_log_id: 'wl-001', employee_id: 'EMP-001',
        work_date: '2026-04-13', task_description: 'Sprint planning meeting',
        work_category: 'meeting', hours_spent: 1, status: 'done',
        priority: null, blockers: null, next_steps: null, tags: null,
        project_name: null, ticket_id: null, confidence_score: null,
        needs_review: false, clarification_needed: false, clarification_reason: null,
        is_user_corrected: false, created_at: '2026-04-13T10:00:00', updated_at: '2026-04-13T10:00:00',
      },
      {
        id: 'wi-003', work_log_id: 'wl-002', employee_id: 'EMP-001',
        work_date: '2026-04-12', task_description: 'Code review session',
        work_category: 'review', hours_spent: 2, status: 'in_progress',
        priority: null, blockers: null, next_steps: null, tags: null,
        project_name: null, ticket_id: null, confidence_score: null,
        needs_review: true, clarification_needed: false, clarification_reason: null,
        is_user_corrected: false, created_at: '2026-04-12T14:00:00', updated_at: '2026-04-12T14:00:00',
      },
    ])
  ),

  http.put(`${BASE}/worklogs/:id`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.id, work_log_id: 'wl-001', employee_id: 'EMP-001',
      work_date: '2026-04-13', task_description: 'Fixed auth bug',
      work_category: 'project', hours_spent: body.hours_spent ?? 3, status: 'done',
      priority: null, blockers: null, next_steps: null, tags: null,
      project_name: null, ticket_id: null, confidence_score: null,
      needs_review: false, clarification_needed: false, clarification_reason: null,
      is_user_corrected: true, created_at: '2026-04-13T09:00:00', updated_at: '2026-04-14T10:00:00',
    })
  }),
]
