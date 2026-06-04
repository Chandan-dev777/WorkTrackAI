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

  http.get(`${BASE}/updates/`, () =>
    HttpResponse.json([
      {
        id: 'wl-hist-001', user_id: 'uuid-alice-001',
        work_date: '2026-04-20', submitted_at: '2026-04-20T09:00:00',
        raw_message: 'Fixed authentication bug for 3 hours. Ticket: AUTH-42, project: Auth service. Status: done. Then attended sprint planning for 1 hour.',
        extraction_status: 'success', model_name: 'claude-sonnet', is_deleted: false,
        work_items: [{ id: 'wi-h1', work_log_id: 'wl-hist-001' }, { id: 'wi-h2', work_log_id: 'wl-hist-001' }],
      },
      {
        id: 'wl-hist-002', user_id: 'uuid-alice-001',
        work_date: '2026-04-19', submitted_at: '2026-04-19T17:30:00',
        raw_message: 'Worked on dashboard charts feature for 4 hours, project: DailyOps UI. Status: in_progress. Reviewed 2 PRs for 1 hour.',
        extraction_status: 'success', model_name: 'claude-sonnet', is_deleted: false,
        work_items: [{ id: 'wi-h3', work_log_id: 'wl-hist-002' }],
      },
      {
        id: 'wl-hist-003', user_id: 'uuid-alice-001',
        work_date: '2026-04-18', submitted_at: '2026-04-18T16:00:00',
        raw_message: 'Attended team standup for 0.5 hours. Researched vector DB options for 2 hours, project: RAG pipeline. Status: done.',
        extraction_status: 'success', model_name: 'claude-sonnet', is_deleted: false,
        work_items: [{ id: 'wi-h4', work_log_id: 'wl-hist-003' }],
      },
    ])
  ),

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

  // ── Admin (Phase 8) ──────────────────────────────────────────────────────
  http.get(`${BASE}/admin/users`, () =>
    HttpResponse.json([
      { id: 'u-001', employee_id: 'EMP-001', full_name: 'Alice Smith',  email: 'alice@example.com',  role: 'employee', team_name: 'Engineering', department: 'Technology', is_active: true },
      { id: 'u-002', employee_id: 'EMP-MGR', full_name: 'Bob Manager',  email: 'bob@example.com',    role: 'manager',  team_name: 'Engineering', department: 'Technology', is_active: true },
      { id: 'u-003', employee_id: 'EMP-ADM', full_name: 'Carol Admin',  email: 'carol@example.com',  role: 'admin',    team_name: null,          department: null,         is_active: true },
    ])
  ),

  http.get(`${BASE}/admin/extraction-errors`, () =>
    HttpResponse.json([
      { id: 'err-001', employee_id: 'EMP-001', work_date: '2026-04-10', extraction_status: 'failed',       raw_message: 'Could not parse this vague update about meetings and stuff', model_name: 'claude-sonnet', submitted_at: '2026-04-10T10:00:00' },
      { id: 'err-002', employee_id: 'EMP-002', work_date: '2026-04-11', extraction_status: 'needs_review', raw_message: 'Did some work today on the project', model_name: 'claude-sonnet', submitted_at: '2026-04-11T14:00:00' },
    ])
  ),

  http.post(`${BASE}/admin/reindex`, () =>
    HttpResponse.json({ indexed: 42, message: 'Reindex complete — 42 items indexed.' })
  ),

  http.post(`${BASE}/admin/seed-dummy-data`, () =>
    HttpResponse.json({ message: 'Dummy data seeded successfully.' })
  ),

  http.get(`${BASE}/admin/stats`, () =>
    HttpResponse.json({
      total_work_logs: 142, total_work_items: 487, total_users: 18,
      extraction_errors: 3, extraction_error_rate: 2.1,
    })
  ),

  http.get(`${BASE}/admin/activity-log`, () =>
    HttpResponse.json([
      { id: 'al-001', employee_name: 'Alice Smith',  employee_id: 'EMP-001', action: 'success',      work_date: '2026-04-21', submitted_at: '2026-04-21T09:12:00' },
      { id: 'al-002', employee_name: 'Bob Manager',  employee_id: 'EMP-MGR', action: 'success',      work_date: '2026-04-21', submitted_at: '2026-04-21T08:45:00' },
      { id: 'al-003', employee_name: 'Alice Smith',  employee_id: 'EMP-001', action: 'needs_review', work_date: '2026-04-20', submitted_at: '2026-04-20T17:30:00' },
      { id: 'al-004', employee_name: 'Carol Admin',  employee_id: 'EMP-ADM', action: 'success',      work_date: '2026-04-20', submitted_at: '2026-04-20T16:00:00' },
      { id: 'al-005', employee_name: 'Bob Manager',  employee_id: 'EMP-MGR', action: 'failed',       work_date: '2026-04-19', submitted_at: '2026-04-19T11:20:00' },
    ])
  ),

  http.post(`${BASE}/auth/change-password`, async ({ request }) => {
    const body = await request.json() as { current_password: string; new_password: string }
    if (body.current_password !== 'password123')
      return HttpResponse.json({ detail: 'Current password is incorrect' }, { status: 400 })
    if (!body.new_password || body.new_password.length < 8)
      return HttpResponse.json({ detail: 'New password must be at least 8 characters' }, { status: 400 })
    return HttpResponse.json({ message: 'Password changed successfully.' })
  }),

  http.put(`${BASE}/admin/users/:userId`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>
    return HttpResponse.json({
      id: params.userId, employee_id: 'EMP-001', full_name: 'Alice Smith',
      email: 'alice@example.com', role: body.role ?? 'employee',
      team_name: body.team_name ?? 'Engineering', department: 'Technology',
      is_active: body.is_active ?? true,
    })
  }),

  // ── Chat (Phase 7) ───────────────────────────────────────────────────────
  http.get(`${BASE}/chat/history`, () =>
    HttpResponse.json([
      {
        id: 'ch-001',
        question: 'How many hours did I log last week?',
        answer: 'You logged 32.5 hours last week across 14 work items.',
        query_source: 'sql',
        session_id: 'sess-001',
        created_at: '2026-04-13T09:00:00',
      },
    ])
  ),

  http.post(`${BASE}/chat/query`, async ({ request }) => {
    const body = await request.json() as { question: string; session_id?: string }
    return HttpResponse.json({
      answer: `Here is the answer to: "${body.question}"`,
      query_source: 'vector',
      session_id: body.session_id ?? 'sess-001',
      sources: [
        { work_item_id: 'wi-001', task_description: 'Fixed authentication bug in login flow', work_date: '2026-04-13', employee_name: 'Alice Smith' },
        { work_item_id: 'wi-002', task_description: 'Sprint planning meeting with engineering team', work_date: '2026-04-12', employee_name: 'Alice Smith' },
      ],
    })
  }),

  // ── Team Dashboard (Phase 6) ──────────────────────────────────────────────
  // Team summary — filtered by team_name when provided (managers scope to own team)
  http.get(`${BASE}/dashboard/team/summary`, ({ request }) => {
    const teamName = new URL(request.url).searchParams.get('team_name')
    const all = [
      { employee_id: 'EMP-001', full_name: 'Alice Smith',    team: 'Engineering', total_hours: 42.5, done_count: 12, blocked_count: 1, last_activity: '2026-04-13' },
      { employee_id: 'EMP-002', full_name: 'Bob Jones',      team: 'Data',        total_hours: 36.0, done_count: 10, blocked_count: 2, last_activity: '2026-04-12' },
      { employee_id: 'EMP-003', full_name: 'Carol Williams', team: 'Data',        total_hours: 28.5, done_count: 8,  blocked_count: 0, last_activity: '2026-04-11' },
    ]
    const rows = teamName ? all.filter(m => m.team === teamName) : all
    return HttpResponse.json(rows.map(({ team: _t, ...m }) => m))
  }),

  http.get(`${BASE}/dashboard/employees`, ({ request }) => {
    const teamName = new URL(request.url).searchParams.get('team_name')
    const all = [
      { employee_id: 'EMP-001', full_name: 'Alice Smith',    team: 'Engineering', total_hours: 42.5, done_count: 12, blocked_count: 1, last_activity: '2026-04-13' },
      { employee_id: 'EMP-002', full_name: 'Bob Jones',      team: 'Data',        total_hours: 36.0, done_count: 10, blocked_count: 2, last_activity: '2026-04-12' },
      { employee_id: 'EMP-003', full_name: 'Carol Williams', team: 'Data',        total_hours: 28.5, done_count: 8,  blocked_count: 0, last_activity: '2026-04-11' },
    ]
    const rows = teamName ? all.filter(m => m.team === teamName) : all
    return HttpResponse.json(rows.map(({ team: _t, ...m }) => m))
  }),

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
    const teamName   = url.searchParams.get('team_name')
    // EMP-001 = Engineering, EMP-002/EMP-003 = Data
    const teamMap: Record<string, string> = { 'EMP-001': 'Engineering', 'EMP-002': 'Data', 'EMP-003': 'Data' }
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
    let filtered = allItems
    if (teamName) filtered = filtered.filter(i => teamMap[i.employee_id] === teamName)
    if (employeeId) filtered = filtered.filter(i => i.employee_id === employeeId)
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

  // ── User Templates ────────────────────────────────────────────────────────
  // In-memory store for test session (resets between test files)
  ...(() => {
    let store: Array<{ id: string; user_id: string; label: string; text: string; created_at: string; updated_at: string }> = []
    const now = () => new Date().toISOString()
    return [
      http.get(`${BASE}/templates/`, () => HttpResponse.json(store)),
      http.post(`${BASE}/templates/`, async ({ request }) => {
        const body = await request.json() as { label: string; text: string }
        const t = { id: `tmpl-${Date.now()}`, user_id: 'uuid-alice-001', label: body.label, text: body.text, created_at: now(), updated_at: now() }
        store = [t, ...store]
        return HttpResponse.json(t, { status: 201 })
      }),
      http.put(`${BASE}/templates/:id`, async ({ request, params }) => {
        const body = await request.json() as { label?: string; text?: string }
        store = store.map(t => t.id === params.id ? { ...t, ...body, updated_at: now() } : t)
        const updated = store.find(t => t.id === params.id)
        if (!updated) return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
        return HttpResponse.json(updated)
      }),
      http.delete(`${BASE}/templates/:id`, ({ params }) => {
        store = store.filter(t => t.id !== params.id)
        return new HttpResponse(null, { status: 204 })
      }),
    ]
  })(),
]
