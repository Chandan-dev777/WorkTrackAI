# WorkTrack AI

AI-powered employee work progress tracker. Employees submit daily updates in natural language; an LLM pipeline extracts structured work records, stores them in SQLite + ChromaDB, and exposes them via a role-aware Streamlit dashboard and a conversational RAG assistant.

---

## Requirements

- Python 3.12+
- Access to the internal NLP proxy (AWS Bedrock key + NLP API key)

---

## Setup

**1. Create and activate the virtual environment**

```bash
python -m venv .venv
source .venv/bin/activate     # Linux/macOS
.venv\Scripts\activate        # Windows
```

**2. Install dependencies**

```bash
pip install -r backend/requirements.txt
pip install -r frontend/requirements.txt
```

**3. Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` — minimum required variables:

| Variable | Description |
|---|---|
| `AWS_BEDROCK_KEY` | AWS Bedrock API key (for Claude models) |
| `APP_SERVICE_NLP_API_KEY` | Internal NLP API key (for GPT models) |
| `JWT_SECRET` | Random string for JWT signing (any long random value) |
| `LLM_PROVIDER` | `claude` (default) or `openai` |
| `LLM_MODEL` | Display name — e.g. `Claude Sonnet 4.6` |
| `DB_PATH` | SQLite path — default `data/worktrack.db` |
| `CHROMA_PATH` | ChromaDB path — default `data/chroma` |

Alternatively, set `APP_SERVICE_CONFIG` as a JSON blob containing both keys:

```bash
APP_SERVICE_CONFIG='{"AWS_BEDROCK_KEY": "...", "APP_SERVICE_NLP_API_KEY": "..."}'
```

The TLS certificate for Bedrock calls is loaded automatically from `backend/cacert.pem` or `~/.ssh/cacert.pem`.

---

## Running the App

Start the backend and frontend in two separate terminals.

  How it works now:                                                                                                                                                                                                
                                                                                                                                                                                                                   
  One-command mode (what you asked for)                                                                                                                                                                            
                                                                                                                                                                                                                   
  # 1. Build React once (or after any frontend change)                                                                                                                                                             
  cd worktrack-ai/frontend-react && npm run build

  # 2. Start backend — it now serves the React app too
  source worktrack-ai/.venv/bin/activate
  uvicorn backend.main:app --reload --port 8000
  Visit http://localhost:8000 → you see the React frontend.

  Two-server dev mode (for active frontend development)

  # Terminal 1 — backend API
  uvicorn backend.main:app --reload --port 8000

  # Terminal 2 — Vite hot-reload dev server
  cd worktrack-ai/frontend-react && npm run dev
  Visit http://localhost:5173 → instant hot-reload on every save.

**Terminal 1 — FastAPI backend**

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

- API: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`

**Terminal 2 — Streamlit frontend**

```bash
source .venv/bin/activate
streamlit run frontend/app.py
```

- UI: `http://localhost:8501`

---

## Seed Data

Populate the database with 16 sample users (1 admin + 3 managers + 12 employees across Engineering, Data, and Support teams) plus 30 days of realistic work logs:

```bash
python -m backend.seed_data
```

Or trigger via the admin UI endpoint after logging in as admin:

```
POST /admin/seed-dummy-data
```

**Default credentials after seeding:**

| Email | Password | Role |
|---|---|---|
| `admin@worktrack.ai` | `WorkTrack2026!` | admin |
| `sarah.connor@worktrack.ai` | `WorkTrack2026!` | manager (Engineering) |
| `grace.hopper@worktrack.ai` | `WorkTrack2026!` | manager (Data) |
| `linus.torvalds@worktrack.ai` | `WorkTrack2026!` | manager (Support) |
| `john.reese@worktrack.ai` | `WorkTrack2026!` | employee (Engineering) |
| `alan.turing@worktrack.ai` | `WorkTrack2026!` | employee (Data) |
| `guido.vanrossum@worktrack.ai` | `WorkTrack2026!` | employee (Support) |

All 16 users share the same default password `WorkTrack2026!`.

---

## Admin Endpoints

All `/admin/*` routes require the `admin` role.

| Method | Path | Description |
|---|---|---|
| `POST` | `/admin/seed-dummy-data` | Seed users + work logs (idempotent) |
| `GET` | `/admin/extraction-errors` | List `failed` / `needs_review` work logs |
| `POST` | `/admin/reindex` | Rebuild ChromaDB index from SQLite |
| `GET` | `/admin/users` | List all registered users |

---

## Running Tests

```bash
# All unit tests (no LLM keys required — all LLM calls are mocked)
pytest

# Single file
pytest tests/test_extraction_service.py

# Single test
pytest tests/test_chat_tools.py::TestDateResolver::test_last_week

# With coverage report
pytest --cov=backend --cov-report=term-missing

# Integration tests (real LLM calls — requires API keys)
pytest -m integration tests/integration/
```

**Current test count:** 197 unit tests + 21 integration tests

---

## Rebuilding the ChromaDB Index

If ChromaDB gets out of sync with SQLite (e.g. after a schema change or manual DB edit):

```bash
python -m backend.main --reindex
```

---

## Project Structure

```
backend/
  config.py               LLM factory + settings (reads .env)
  database.py             SQLAlchemy engine and session
  main.py                 FastAPI app entry point + --reindex CLI flag
  seed_data.py            Seeds 16 users + 30 days of work logs
  models/
    user.py               User ORM model (roles: employee/manager/admin)
    work_log.py           WorkLog ORM model (one per NL submission)
    work_item.py          WorkItem ORM model (one per extracted task)
    chat_history.py       ChatHistory ORM model
  schemas/                Pydantic I/O schemas
  routers/
    auth.py               POST /auth/register, /auth/login, GET /auth/me
    updates.py            POST /updates/submit, PUT /updates/{id}/confirm
    worklogs.py           GET /worklogs/my, /worklogs/team, PUT /worklogs/{id}
    dashboard.py          GET /dashboard/summary, /categories, /status, /trend,
                                /team/summary, /team/categories, /employees
    chat.py               POST /chat/query, GET /chat/history
    admin.py              POST /admin/seed-dummy-data, /admin/reindex,
                                GET /admin/extraction-errors, /admin/users
  services/
    auth_service.py       JWT + bcrypt helpers
    extraction_service.py LangChain NL → structured WorkItem extraction
    chroma_service.py     ChromaDB upsert / search / delete / reindex
    dashboard_service.py  SQL aggregation queries
    chat_service.py       LangGraph RAG agent (date_resolver, sql_query, vector_search tools)
  prompts/
    extraction_prompt.py  System + human prompt templates (versioned)

frontend/
  app.py                  Streamlit login/register page
  pages/
    1_Submit_Update.py    Submit daily work update (NL → preview → confirm)
    2_My_Dashboard.py     Personal KPIs, charts, inline-editable work items table
    3_Team_Dashboard.py   Team overview — stacked bar, category bar, summary cards,
                          blocked items panel, filterable table (manager/admin only)
    4_Chat_Assistant.py   RAG chat interface with session history

tests/
  conftest.py                 Shared fixtures (StaticPool in-memory DB, test client)
  test_auth_service.py
  test_auth_router.py
  test_extraction_schemas.py
  test_extraction_service.py
  test_chroma_service.py
  test_updates_router.py
  test_updates_crud.py
  test_dashboard_service.py
  test_dashboard_router.py
  test_worklogs_router.py
  test_chat_tools.py
  test_chat_router.py
  test_chat_service.py
  test_admin_router.py
  test_seed_data.py
  integration/
    conftest.py
    test_extraction_integration.py
    test_chat_integration.py

data/
  worktrack.db            SQLite — source of truth (auto-created on first run)
  chroma/                 ChromaDB vector index (derived from SQLite)
```

---

## User Roles

| Role | Access |
|---|---|
| `employee` | Submit updates, view own dashboard and work items, use chat assistant |
| `manager` | All employee access + team dashboard (all team members' data) |
| `admin` | Full access + admin endpoints (seed, reindex, error queue, user list) |

---

## Architecture Notes

- **Extraction flow:** `POST /updates/submit` runs the LLM and returns a preview — nothing is persisted yet. `PUT /updates/{id}/confirm` persists to SQLite then upserts into ChromaDB.
- **SQLite is source of truth.** ChromaDB is a derived semantic index. Use `--reindex` to rebuild if they diverge.
- **Identity is server-side.** `user_id` on every record is set from the JWT — the LLM output never determines who submitted what.
- **Chat agent tools:** `date_resolver` → `sql_query` (structured data) or `vector_search` (semantic recall), or both combined (hybrid).
- **ChromaDB date filtering** uses integer `work_date_num` (YYYYMMDD format) because `$gte`/`$lte` operators only accept numeric values.
