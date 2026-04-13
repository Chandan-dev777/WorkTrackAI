# WorkTrack AI — Frontend Documentation

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Shared Patterns](#shared-patterns)
5. [Page: Login / Register (`app.py`)](#page-login--register-apppy)
6. [Page: Submit Update (`1_Submit_Update.py`)](#page-submit-update-1_submit_updatepy)
7. [Page: My Dashboard (`2_My_Dashboard.py`)](#page-my-dashboard-2_my_dashboardpy)
8. [Page: Team Dashboard (`3_Team_Dashboard.py`)](#page-team-dashboard-3_team_dashboardpy)
9. [Page: Chat Assistant (`4_Chat_Assistant.py`)](#page-chat-assistant-4_chat_assistantpy)
10. [Page: Admin Panel (`5_Admin.py`)](#page-admin-panel-5_adminpy)
11. [Navigation & Session State](#navigation--session-state)
12. [Running the Frontend](#running-the-frontend)

---

## Overview

The WorkTrack AI frontend is a multi-page Streamlit application. It communicates exclusively with the FastAPI backend over HTTP using `httpx`. All state (JWT token, user profile, chat history) is held in `st.session_state` — there is no local database or persistent storage in the frontend.

**Page routing by role:**

| Role | Default landing page after login |
|---|---|
| `employee` | My Dashboard |
| `manager` | Team Dashboard |
| `admin` | Team Dashboard |

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Streamlit | ≥1.40 | UI framework |
| httpx | ≥0.27 | HTTP client for backend API calls |
| pandas | — | DataFrame manipulation and display |
| plotly.express | ≥5.24 | Interactive charts |

---

## Project Structure

```
frontend/
├── app.py                      # Entry point — Login / Register
└── pages/
    ├── 1_Submit_Update.py      # Two-step submit/confirm work update
    ├── 2_My_Dashboard.py       # Employee dashboard (KPIs, charts, item table)
    ├── 3_Team_Dashboard.py     # Manager/admin team dashboard
    ├── 4_Chat_Assistant.py     # Conversational RAG assistant
    └── 5_Admin.py              # Admin panel (users, system actions, error queue)
```

Streamlit uses the numeric prefix in filenames to control sidebar page ordering. The entry point `app.py` is the first page shown (login).

---

## Shared Patterns

### API Helper Function

Every page defines a local `_api(method, path, **kwargs)` helper that:
1. Builds the full URL from `API_BASE` (defaults to `http://localhost:8000`, overridden by `API_BASE_URL` env var).
2. Injects the `Authorization: Bearer <token>` header from `st.session_state["token"]`.
3. Passes all other `kwargs` (e.g. `json=`, `params=`) directly to `httpx.request`.

```python
API_BASE = os.getenv("API_BASE_URL", "http://localhost:8000")

def _auth_headers():
    return {"Authorization": f"Bearer {st.session_state['token']}"}

def _api(method, path, timeout: float = 30.0, **kwargs):
    return httpx.request(
        method, f"{API_BASE}{path}",
        headers=_auth_headers(),
        timeout=timeout,
        **kwargs,
    )
```

The `app.py` login page uses a version without auth headers (pre-login).

### Auth Guard

Every page except `app.py` starts with:

```python
if not st.session_state.get("token"):
    st.switch_page("app.py")
```

This redirects unauthenticated users back to the login page immediately.

### Sidebar Navigation

Each page provides consistent sidebar navigation buttons:
- Submit Update → `pages/1_Submit_Update.py`
- My Dashboard → `pages/2_My_Dashboard.py`
- Team Dashboard → `pages/3_Team_Dashboard.py` (manager/admin only)
- Admin Panel → `pages/5_Admin.py` (admin only)
- Logout → clears `st.session_state` and redirects to `app.py`

### Timeout Defaults

| Page | Default timeout | Reason |
|---|---|---|
| Login / Register | 30s | Fast auth endpoints |
| Submit Update | 120s | LLM extraction can be slow |
| Chat Assistant | 120s | Agent reasoning with multiple tool calls |
| My Dashboard | 30s | SQL queries |
| Team Dashboard | 30s | SQL queries |
| Admin Panel | 30s (reindex: 120s) | Reindex can be long |

---

## Page: Login / Register (`app.py`)

**Route:** `/` (Streamlit entry point)

### Purpose

Handles user authentication. On success, stores the JWT and user profile in `st.session_state` and redirects to the appropriate dashboard.

### Session State Written

| Key | Value |
|---|---|
| `token` | JWT access token string |
| `user` | `UserProfile` dict (`id`, `employee_id`, `full_name`, `email`, `role`, `team_name`, `department`, `is_active`) |

### Auto-Redirect

If `st.session_state["token"]` already exists (e.g. page refresh), the user is immediately redirected:
- Manager/admin → Team Dashboard
- Employee → My Dashboard

### UI Layout

`st.tabs(["Login", "Register"])` — two tabs side by side.

#### Login Tab

Form fields:
- `Email` (text input)
- `Password` (password input, masked)
- Submit button: **Login**

Flow:
1. `POST /auth/login` with `{email, password}`
2. On 200: extracts `access_token`, calls `GET /auth/me` to get profile
3. On success: calls `_store_session(token, profile)` and `st.rerun()`
4. On 401: shows "Incorrect email or password."
5. On other: shows the raw error text

#### Register Tab

Form fields:
- `Full Name`
- `Employee ID` (e.g. `EMP-001`)
- `Email`
- `Password` (min 8 chars)
- `Role` (selectbox: `employee`, `manager` — admin not selectable via UI)
- `Team Name` (optional)
- `Department` (optional)
- Submit button: **Create Account**

Flow:
1. Validates all required fields are filled
2. `POST /auth/register` with the full registration payload
3. On 201: extracts token, fetches profile, stores session, redirects
4. On 409: "That email is already registered."
5. On 422: iterates over Pydantic validation errors and shows each one
6. On other: shows raw error text

---

## Page: Submit Update (`1_Submit_Update.py`)

**Route:** `/Submit_Update`

### Purpose

Two-step workflow for submitting a work update:
1. **Step 1** — Employee types free-text → AI extracts structured items → preview returned.
2. **Step 2** — Employee reviews, edits, clarifies → clicks Confirm → items persisted.

### State Machine

The page uses `"preview"` in `st.session_state` to toggle between steps:

```
"preview" not in session_state  →  Step 1 (input form)
"preview" in session_state      →  Step 2 (review & confirm)
```

### Step 1: Input Form

**Layout:** Full-width form.

Fields:
- `Work update` — `st.text_area` with placeholder showing example format
- `Work date` — `st.date_input` defaulting to today

On submit:
1. Validates `raw_message` is not empty.
2. Shows spinner: "Analysing your update with AI..."
3. `POST /updates/submit` with `{raw_message, work_date}` (timeout: 120s)
4. On 200: stores `resp.json()` as `st.session_state["preview"]` and calls `st.rerun()` to switch to Step 2
5. On 422: "The AI could not parse your update. Try adding more detail."
6. On other: shows error text

### Step 2: Review & Confirm

**Source data:** `st.session_state["preview"]` — the `SubmitUpdateResponse` JSON.

**Header info displayed:**
- Work date from extraction
- Extraction status (`success`, `needs_review`, `failed`)
- Item count

#### Fallback Mode Warning

If `extraction_status == "needs_review"` AND `has_clarification_needed == True`:
```
⚠️ AI extraction is currently unavailable. Your message has been saved...
```
The user fills in all fields manually.

#### Total Hours Warning

If `total_hours_warning == True`:
```
⚠️ Total logged hours exceed 12 — please check the hours below.
```

#### Clarification Expanders

For each item where `clarification_needed == True`, an expanded `st.expander` is shown with:
- Caption showing `clarification_reason`
- `Hours spent` — `st.number_input` (step 0.5)
- `Status` — `st.selectbox` (planned / in_progress / blocked / done)

After the user fills these in, `clarification_needed` is set to `False` in the local items list.

#### Editable Preview Table

`st.data_editor` displaying extracted items with these columns:

| Column | Type | Config |
|---|---|---|
| Task | Text | Editable |
| Category | `SelectboxColumn` | 10 category options |
| Hours | `NumberColumn` | min=0.0, step=0.5 |
| Status | `SelectboxColumn` | 4 status options |
| Priority | `SelectboxColumn` | low / medium / high |
| Ticket | Text | Editable |
| Project | Text | Editable |
| Confidence | `ProgressColumn` | 0.0–1.0 visual bar |
| Needs Clarification | Checkbox | Editable |

`num_rows="dynamic"` allows the user to add or remove rows.

#### Action Buttons (side by side)

- **← Edit Message** — deletes `"preview"` from session state, `st.rerun()` to go back to Step 1
- **✅ Confirm & Save** (primary) — merges edits and calls `PUT /updates/{work_log_id}/confirm`

**Confirm flow:**
1. Iterates over edited DataFrame rows and merges values back into the `items` list.
2. `PUT /updates/{work_log_id}/confirm` with `{items, work_date}`
3. On 200: success message, `st.balloons()`, deletes preview from session, shows link to My Dashboard
4. On other: shows error

---

## Page: My Dashboard (`2_My_Dashboard.py`)

**Route:** `/My_Dashboard`

### Purpose

Personal analytics dashboard showing the employee's own work data for a selected date range.

### Sidebar Controls

**Date Range Presets** (radio):
- This Week (Mon → today)
- Last 7 Days
- Last 30 Days
- Custom (two date inputs)

**Navigation buttons:** Submit Update, Team Dashboard (manager/admin only), Logout.

### Data Fetching

Five parallel API calls with the selected date range params:

| Call | Endpoint | Data |
|---|---|---|
| `r_summary` | `GET /dashboard/summary` | KPI counts |
| `r_cats` | `GET /dashboard/categories` | Hours by category |
| `r_status` | `GET /dashboard/status` | Status distribution |
| `r_trend` | `GET /dashboard/trend` | Daily hours |
| `r_items` | `GET /worklogs/my` (limit=200) | Work item rows |

If any call returns non-200, shows an error and `st.stop()`.

### KPI Cards Row

Five `st.columns` with `st.metric`:

| Metric | Value |
|---|---|
| ⏱ Total Hours | `total_hours` formatted to 1 decimal |
| ✅ Done | `done_count` |
| 🔄 In Progress | `in_progress_count` |
| 🚫 Blocked | `blocked_count` |
| 📋 Total Tasks | `total_items` |

### Charts Row

Two columns (2:1 ratio):

**Hours by Category (bar chart)**
- `plotly.express.bar`, x=category, y=hours, colored by category
- Text labels on bars: `"Xh"` format
- Legend hidden

**Status Distribution (donut chart)**
- `plotly.express.pie`, hole=0.4
- Fixed color map:
  - done → `#00CC96` (green)
  - in_progress → `#636EFA` (blue)
  - blocked → `#EF553B` (red)
  - planned → `#FFA15A` (orange)

### Daily Hours Trend (line chart)

`plotly.express.line`, x=date, y=hours, with markers.

### Work Items Table

**Filters row (3 columns):**
- Category selectbox (All + unique categories in data)
- Status selectbox (All + non-null statuses)
- "Needs review only" checkbox

**`st.data_editor`** (editable) with columns:

| Column | Config |
|---|---|
| Date | Read-only |
| Task | Editable text |
| Category | SelectboxColumn (10 options) |
| Hours | NumberColumn (step 0.5) |
| Status | SelectboxColumn (4 options) |
| Priority | SelectboxColumn (3 options) |
| Ticket | Editable text |
| Project | Editable text |
| Needs Review | CheckboxColumn (disabled — read-only) |

`num_rows="fixed"` — rows cannot be added or deleted here.

### Inline Save

**"💾 Save Changes"** button iterates over edited rows, compares to original `filtered` DataFrame by index, and calls `PUT /worklogs/{item_id}` for each modified row.

- Success: `st.success(f"Saved {saved} item(s) successfully.")` + `st.rerun()`
- Per-item failure: `st.error` for each failed item
- Uses `pd.isna(v)` to convert NaN to `None` before sending to API

---

## Page: Team Dashboard (`3_Team_Dashboard.py`)

**Route:** `/Team_Dashboard`

### Access Control

```python
if user.get("role") not in ("manager", "admin"):
    st.error("Access denied — managers and admins only.")
    st.stop()
```

### Sidebar Controls

**Date Range Presets** — same as My Dashboard, defaults to "Last 30 Days".

**Team Filter:**
- Admin → free text input (blank = all teams)
- Manager → text input pre-filled with their own `team_name`

### Data Fetching

Three API calls:

| Call | Endpoint | Data |
|---|---|---|
| `r_team_summary` | `GET /dashboard/team/summary` | Per-employee summary |
| `r_team_cats` | `GET /dashboard/team/categories` | Category breakdown |
| `r_team_items` | `GET /worklogs/team` (limit=500) | All team work items |

### Team KPI Cards

Four columns:

| Metric | Value |
|---|---|
| ⏱ Total Hours | Sum of all employees' hours |
| ✅ Done Tasks | Sum of all done_count |
| 🚫 Blocked Tasks | Sum of all blocked_count |
| 👤 Active Members | Count of employees with total_hours > 0 |

### Employee Selector

`st.selectbox("Filter charts and tables by employee")` — "All Employees" or individual names. Used to filter all charts and tables below.

### Charts Row (3:2 ratio)

**Hours by Employee per Day (stacked bar chart)**
- Groups `team_items` by `work_date` and `employee_id`
- `plotly.express.bar`, barmode="stack", x=work_date, y=hours_spent, color=employee name
- Legend positioned horizontally above chart

**Hours by Category (horizontal bar chart)**
- `plotly.express.bar`, orientation="h", x=hours, y=category
- Text labels: `"Xh"` format

### Employee Summary Cards

Three-column grid of styled HTML cards per employee:

```html
<div style="border: 1px solid {border_color}; border-radius: 8px; padding: 12px">
  <b>Full Name</b>
  employee_id
  ⏱ Xh  ✅ N done  [🚫 N blocked — red border if blocked > 0]
  Last activity: YYYY-MM-DD
</div>
```

Cards with blocked items use a red (`#EF553B`) border; others use light grey (`#e0e0e0`).

### Blocked Items Panel

Separate API call: `GET /worklogs/team?status=blocked` (with current date/team filters).

Displays a read-only `st.dataframe` with columns:
- Date, Employee, Task, Hours, Ticket, Blockers

### All Team Work Items Table

Read-only `st.dataframe` (height=400px) with four filter dropdowns:
- Employee, Category, Status, Needs review (checkbox)

Displayed columns: Date, Employee, Task, Category, Hours, Status, Priority, Ticket, Project.

Footer caption: "Showing N of M items".

---

## Page: Chat Assistant (`4_Chat_Assistant.py`)

**Route:** `/Chat_Assistant`

### Purpose

Conversational interface backed by the LangGraph RAG agent. Supports both typed questions and example button clicks.

### Session State

| Key | Description |
|---|---|
| `chat_messages` | List of `{role, content, source, sources}` dicts — full conversation |
| `chat_session_id` | UUID passed to the backend to maintain conversation context |
| `_pending_question` | Temporary key set when an example button is clicked |

### Source Icons & Status Colors

```python
SOURCE_ICONS = {"sql": "🗄️ SQL", "vector": "🔍 Vector", "hybrid": "⚡ Hybrid"}
STATUS_COLORS = {"done": "🟢", "in_progress": "🔵", "blocked": "🔴", "planned": "⚪"}
```

### Header

Shows the user's name and role context:
- Employees: "My data only"
- Managers/admins: "Manager view"

### Sidebar

**Navigation:** My Dashboard, Submit Update, Logout.

**"🗑️ New Conversation"** — clears `chat_messages` and `chat_session_id`, calls `st.rerun()`.

**Example Questions:**
For all users:
- "How many hours did I log this week?"
- "What was I working on last month?"
- "Show me all blocked tasks from last week."
- "Which category did I spend the most time on?"
- "What did I do yesterday?"

Additional for managers/admins:
- "Show me team activity this week."
- "Which employee has the most blocked tasks?"

Clicking any example button sets `st.session_state["_pending_question"] = question`.

### Chat Area (`@st.fragment`)

The entire chat interaction is wrapped in `@st.fragment` to avoid re-rendering the sidebar on every message submission.

#### Layout

A `st.container()` is reserved for all messages before `st.chat_input` is rendered. This ensures the input box always appears at the bottom.

#### Question Input

```python
pending = st.session_state.pop("_pending_question", None)
question = st.chat_input("Ask about your work history…") or pending
```

Example button clicks and typed input are unified through this pattern.

#### Message Rendering

For each `msg` in `st.session_state.chat_messages`:

**User messages:**
```
👤 user bubble: message content (markdown)
```

**Assistant messages:**
```
🤖 assistant bubble:
  - markdown answer
  - caption: "Retrieved via 🗄️ SQL" (or Vector/Hybrid)
  - st.expander "📎 Sources (N items)" if sources exist
    - Each source: "**YYYY-MM-DD** 🟢 `category` — task description"
```

#### API Call

`POST /chat/query` with `{question, session_id}` (timeout: 120s).

Response handling:
- 200: extracts `answer`, `query_source`, `sources`, `session_id`
- Non-200: shows `"Error {status}: {text}"`
- `httpx.ReadTimeout`: shows retry suggestion
- Other exception: shows connection error message

#### History Persistence

Both the user message and assistant response are appended to `st.session_state.chat_messages` after each exchange. This persists within the Streamlit session (browser tab lifetime) even through fragment reruns.

The `session_id` returned by the backend is stored and passed back on subsequent calls, enabling the backend agent to load conversation history from SQLite.

---

## Page: Admin Panel (`5_Admin.py`)

**Route:** `/Admin`

### Access Control

```python
if user.get("role") != "admin":
    st.error("Access denied — admins only.")
    st.stop()
```

### Layout

`st.tabs(["👤 User Management", "⚙️ System Actions", "⚠️ Extraction Errors"])`

---

### Tab 1: User Management

**Summary metrics row (4 columns):**

| Metric | Value |
|---|---|
| Total Users | `len(df_users)` |
| Active | Count where `is_active == True` |
| Admins | Count where `role == "admin"` |
| Inactive | Count where `is_active == False` |

**Per-user edit cards** — grouped into three `st.expander` sections by role (Admins, Managers, Employees; Employees expanded by default):

For each user, a 5-column row:
1. **Identity** (cols[0]) — status icon (✅ active / 🚫 inactive), full name, employee_id, email, team, department (HTML with `unsafe_allow_html=True`)
2. **Role** (cols[1]) — `st.selectbox` with `["employee", "manager", "admin"]`, disabled if viewing self
3. **Team** (cols[2]) — `st.text_input` for team name
4. **Active** (cols[3]) — `st.checkbox`, disabled if viewing self
5. **Save** (cols[4]) — `st.button("💾 Save")`, replaced with `_(you)_` caption for self

**Save button logic:**
1. Compares new values to current user data
2. Only sends fields that actually changed
3. `PUT /admin/users/{user_id}` with changed fields
4. On 200: success message + `st.rerun()`
5. On error: shows `detail` from error JSON or raw text

Self-protection: the role selectbox and active checkbox are `disabled=True` for the logged-in admin's own row.

---

### Tab 2: System Actions

Two action cards (using `st.container(border=True)`):

**🌱 Seed Dummy Data**
- Description: "Populates the database with 16 sample users and 30 days of realistic work logs. Safe to run on an empty database — skips automatically if users already exist."
- Button: **Run Seed** (primary type)
- `POST /admin/seed-dummy-data`
- Shows success message or error

**🔍 Rebuild ChromaDB Index**
- Description: "Drops and rebuilds the entire ChromaDB vector index from SQLite. Use this if vector search results seem stale or out of sync."
- Button: **Reindex Now**
- `POST /admin/reindex` (timeout: 120s)
- On success: shows `"Reindex complete — N items indexed."`
- On error: shows error text

---

### Tab 3: Extraction Errors

Shows work log submissions that failed LLM extraction or were flagged for review.

**Summary metrics (2 columns):**
- Failed count
- Needs Review count

**Status filter radio:** All / failed / needs_review (horizontal)

**Error table** (`st.dataframe`) — read-only:

| Column | Source field |
|---|---|
| Date | `work_date` |
| Employee | `employee_id` |
| Status | `extraction_status` |
| Model | `model_name` |
| Submitted | `submitted_at` |

**Raw Message Inspector:**

`st.number_input("Row index")` → selects a row from the filtered table.

Shows:
- Employee ID, Work Date, Status as text
- `st.text_area("Raw submission", disabled=True)` — the original submission text

Useful for diagnosing why the LLM could not parse a particular submission.

---

## Navigation & Session State

### Global Session State Keys

| Key | Type | Set by | Read by |
|---|---|---|---|
| `token` | `str` | `app.py` login/register | All pages (auth header) |
| `user` | `dict` | `app.py` login/register | All pages (role checks, display) |
| `preview` | `dict` | `1_Submit_Update.py` submit | `1_Submit_Update.py` confirm |
| `raw_message` | `str` | `1_Submit_Update.py` submit | Deleted after confirm |
| `chat_messages` | `list[dict]` | `4_Chat_Assistant.py` | `4_Chat_Assistant.py` |
| `chat_session_id` | `str` | `4_Chat_Assistant.py` | `4_Chat_Assistant.py` |
| `_pending_question` | `str` | `4_Chat_Assistant.py` sidebar | `4_Chat_Assistant.py` chat area |

### Logout

Calling `st.session_state.clear()` removes all keys, then `st.switch_page("app.py")` redirects to login.

### Page Switching

`st.switch_page("pages/X_Name.py")` — Streamlit's programmatic navigation. Used for:
- Post-login redirect (role-based)
- Auth guard redirect (no token)
- Role guard redirect (wrong role)
- Sidebar navigation buttons
- Post-confirmation link to dashboard

---

## Running the Frontend

```bash
# 1. Ensure backend is running on port 8000
uvicorn backend.main:app --reload --port 8000

# 2. In a separate terminal, activate venv
source .venv/bin/activate

# 3. Start the Streamlit frontend
streamlit run frontend/app.py

# Frontend will open at: http://localhost:8501

# 4. Optional: point at a different backend
API_BASE_URL=http://my-backend:8000 streamlit run frontend/app.py
```

### First-time Setup

1. Register an account via the Register tab (or log in with seeded credentials after running seed data).
2. Seeded admin account: `admin@worktrack.ai` / `WorkTrack2026!`
3. Seeded employee example: `john.reese@worktrack.ai` / `WorkTrack2026!`
4. Seeded manager example: `sarah.connor@worktrack.ai` / `WorkTrack2026!`

### Environment Variable

| Variable | Default | Description |
|---|---|---|
| `API_BASE_URL` | `http://localhost:8000` | Backend API base URL |

---

## Page Dependency Map

```
app.py (Login/Register)
    │
    ├── POST /auth/login
    ├── POST /auth/register
    └── GET  /auth/me
            │
            ▼ (on success)
    ┌───────────────────────────────────┐
    │                                   │
    ▼                                   ▼
2_My_Dashboard.py               3_Team_Dashboard.py
    │                                   │
    ├── GET /dashboard/summary          ├── GET /dashboard/team/summary
    ├── GET /dashboard/categories       ├── GET /dashboard/team/categories
    ├── GET /dashboard/status           └── GET /worklogs/team
    ├── GET /dashboard/trend
    ├── GET /worklogs/my
    └── PUT /worklogs/{item_id}

1_Submit_Update.py
    ├── POST /updates/submit
    └── PUT  /updates/{id}/confirm

4_Chat_Assistant.py
    ├── POST /chat/query
    └── GET  /chat/history

5_Admin.py
    ├── GET  /admin/users
    ├── PUT  /admin/users/{id}
    ├── GET  /admin/extraction-errors
    ├── POST /admin/reindex
    └── POST /admin/seed-dummy-data
```
