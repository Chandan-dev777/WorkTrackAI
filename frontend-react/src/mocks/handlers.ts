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
    HttpResponse.json({ total_hours: 42.5, total_items: 18, done: 12, in_progress: 4, blocked: 2 })
  ),
  http.get(`${BASE}/dashboard/categories`, () =>
    HttpResponse.json([
      { category: 'Development', total_hours: 20 },
      { category: 'Testing', total_hours: 8 },
      { category: 'Meeting', total_hours: 6 },
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
      { date: '2026-04-07', total_hours: 6 },
      { date: '2026-04-08', total_hours: 7.5 },
      { date: '2026-04-09', total_hours: 5 },
    ])
  ),
]
