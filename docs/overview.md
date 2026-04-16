# WorkTrack AI — Overview

## What It Is

WorkTrack AI is an AI-powered employee work progress tracker. Employees submit daily updates in plain English, and an LLM pipeline extracts structured work records from those updates. The result is a searchable, aggregated view of work activity across teams — with role-aware dashboards, a conversational assistant, and manager-level reporting.

---

## Core Workflow

```
Employee types free-text update
        ↓
LLM extracts structured work items
        ↓
Employee reviews and confirms
        ↓
Stored in SQLite + ChromaDB
        ↓
Dashboards / Chat Assistant / Team Reports
```

**Example input:**
> "Finished the auth bug fix, spent 2h on code review, attended sprint planning, still blocked on infra access"

**Extracted output:**
- Auth bug fix — 0h — done — project
- Code review — 2h — done — support
- Sprint planning — 1h — done — meeting
- Infra access — 0h — blocked — project

---

## User Roles

| Role | What they see |
|---|---|
| **Employee** | Submit updates, personal dashboard, chat assistant |
| **Manager** | All of the above + team dashboard for their direct reports |
| **Admin** | All of the above + user management, seed data, reindex tools |

Identity is always derived from the JWT — the LLM output never determines who submitted what.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python 3.12+) |
| Database | SQLite — source of truth |
| Vector Index | ChromaDB — semantic search |
| ORM | SQLAlchemy 2.0 |
| LLM Framework | LangChain 0.3 + LangGraph 0.2 |
| LLM Models | Claude Sonnet 4.6 (primary), Claude Haiku 4.5 (fallback/repair), GPT-4o |
| LLM Access | Enterprise NLP proxy (Azure OpenAI interface over AWS Bedrock) |
| Auth | JWT + bcrypt |
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Legacy Frontend | Streamlit (Python) |
| Testing | pytest + Vitest |

---

## Application Structure

```
worktrack-ai/
├── backend/
│   ├── main.py                  # FastAPI app entry point; serves React SPA
│   ├── config.py                # Settings + LLM factory; reads .env
│   ├── database.py              # SQLAlchemy engine and session
│   ├── models/                  # ORM: User, WorkLog, WorkItem, ChatHistory
│   ├── schemas/                 # Pydantic request/response models
│   ├── routers/                 # API routes (auth, updates, dashboard, chat, admin)
│   ├── services/
│   │   ├── extraction_service.py  # NL → structured JSON via LangChain
│   │   ├── chat_service.py        # LangGraph RAG agent (3 tools)
│   │   ├── chroma_service.py      # ChromaDB upsert / search / reindex
│   │   ├── dashboard_service.py   # SQL aggregation for KPIs and trends
│   │   └── auth_service.py        # JWT + password hashing
│   └── prompts/
│       └── extraction_prompt.py   # Versioned LLM prompt templates
│
├── frontend-react/              # Modern frontend (React + TypeScript)
│   └── src/
│       ├── pages/               # Login, Submit, Dashboard, Team, Chat, Admin, Settings
│       ├── components/          # Layout, Charts, Common UI, AI chat, Help widget
│       ├── api/                 # Axios-based API client
│       └── store/               # Zustand (auth, toasts) + React Query
│
├── frontend/                    # Legacy Streamlit frontend
│   ├── app.py
│   └── pages/
│
├── data/
│   ├── worktrack.db             # SQLite database
│   └── chroma/                  # ChromaDB vector index
│
├── tests/                       # pytest unit + integration tests (197+)
├── .env.example                 # Environment variable template
└── requirements.txt             # Python dependencies
```

---

## Key Features

**Extraction pipeline**
- Accepts free-text work updates via the Submit page
- LangChain chain calls Claude Sonnet to produce structured `ExtractionResult` JSON
- Parsed with Pydantic; falls back to Claude Haiku + `OutputFixingParser` on errors
- Returns a preview the employee can edit before confirming
- Confirmation writes to SQLite, then upserts into ChromaDB

**Dashboards**
- Personal: hours worked, task counts, category breakdown, status distribution, trends over time
- Team (managers/admins): per-employee summaries, cross-team aggregations, date-range filtering

**Chat assistant**
- LangGraph ReAct agent with three tools:
  - `date_resolver` — converts relative expressions ("last week") to date ranges
  - `sql_query` — runs aggregation queries via dashboard service
  - `vector_search` — semantic similarity search in ChromaDB
- Full conversation history per user

**Help widget**
- Floating assistant available on every page
- Two tabs: chat (FAQ via LLM) and notes (persistent user notes)

**Admin tools**
- Seed 16 realistic users across 3 teams × 30 days of work logs
- Rebuild ChromaDB index from SQLite (`--reindex` flag or admin endpoint)
- View and retry failed extraction jobs
- User management (create, deactivate, assign roles/teams)

---

## Running the Application

**1. Install dependencies**
```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cd frontend-react && npm install && cd ..
```

**2. Configure environment**
```bash
cp .env.example .env
# Edit .env — add API keys, JWT secret, LLM provider settings
```

**3. Start the backend**
```bash
uvicorn backend.main:app --reload --port 8000
# API available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

**4a. React frontend (recommended)**
```bash
cd frontend-react && npm run dev
# UI at http://localhost:5173
```

**4b. OR Streamlit frontend (legacy)**
```bash
streamlit run frontend/app.py
# UI at http://localhost:8501
```

**5. Seed demo data (optional)**
```bash
python -m backend.seed_data
# Creates 16 users with password: WorkTrack2026!
# admin@worktrack.ai (Admin), sarah.connor@worktrack.ai (Manager), etc.
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `APP_SERVICE_NLP_API_KEY` | Internal NLP API key (GPT models) |
| `AWS_BEDROCK_KEY` | AWS Bedrock key (Claude models) |
| `APP_SERVICE_CONFIG` | JSON string alternative to individual keys |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `LLM_PROVIDER` | `claude` or `openai` |
| `LLM_MODEL` | Display name, e.g. `Claude Sonnet 4.6` |
| `DATABASE_URL` | SQLite path, default `sqlite:///./data/worktrack.db` |
| `CHROMA_PATH` | ChromaDB persistence path, default `./data/chroma` |

---

## Data Architecture

**SQLite is always the source of truth.** All writes go to SQLite first. ChromaDB is a derived semantic index and can be fully rebuilt at any time:

```bash
python -m backend.main --reindex
```

**Submit → Confirm two-step flow:** Submitting a work update creates a `WorkLog` row with `extraction_status=pending` and returns an extraction preview. Nothing is confirmed until the employee explicitly approves (with optional edits). Abandoned pending rows are never surfaced in dashboards.

---

## LLM Access

All LLM calls go through an internal enterprise proxy — no direct OpenAI or Anthropic API keys are used. The proxy exposes an Azure OpenAI-compatible interface:

- **Claude models** — routed to AWS Bedrock endpoint at `https://api.nlp.p.uptimize.merckgroup.com/model`
- **GPT models** — routed to NLP API endpoint at `https://api.nlp.p.uptimize.merckgroup.com`

TLS certificate: `chatbot/cacert.pem` (fallback: `~/.ssh/cacert.pem`).

---

## Testing

```bash
# Python unit tests
pytest

# With coverage
pytest --cov=backend --cov-report=term-missing

# React tests
cd frontend-react && npm test
```

Tests mock LLM calls via `unittest.mock.patch` — no API keys required for the test suite.
