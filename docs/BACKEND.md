# WorkTrack AI — Backend Documentation

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Configuration & Environment](#configuration--environment)
5. [LLM Factory](#llm-factory)
6. [Database Layer](#database-layer)
7. [ORM Models](#orm-models)
8. [Pydantic Schemas](#pydantic-schemas)
9. [Routers (API Endpoints)](#routers-api-endpoints)
10. [Services](#services)
11. [Prompts](#prompts)
12. [Seed Data](#seed-data)
13. [Tests](#tests)
14. [Running the Backend](#running-the-backend)

---

## Overview

WorkTrack AI is a Python/FastAPI backend that receives free-text daily work updates from employees, runs them through an LLM extraction pipeline, stores structured records in SQLite, maintains a semantic vector index in ChromaDB, and exposes role-aware REST endpoints consumed by a Streamlit frontend.

**Core data flow:**

```
Employee submits free-text
        │
        ▼
POST /updates/submit
  → LangChain extraction chain (Claude Sonnet)
  → ExtractionResult preview returned (nothing persisted yet)
        │
        ▼
PUT /updates/{id}/confirm
  → WorkItems written to SQLite (source of truth)
  → WorkItems upserted into ChromaDB (semantic index)
        │
        ▼
Dashboard & Chat endpoints
  → SQL aggregation (dashboard_service)
  → LangGraph RAG agent (chat_service)
     ├─ sql_query tool  → SQLite via dashboard_service
     └─ vector_search tool → ChromaDB
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web framework | FastAPI 0.115+ |
| ASGI server | Uvicorn |
| Database ORM | SQLAlchemy 2.0 |
| Database | SQLite (file: `data/worktrack.db`) |
| Vector store | ChromaDB 0.5+ (persistent, cosine similarity) |
| LLM framework | LangChain 0.3+ / LangGraph 0.2+ |
| LLM provider | Azure OpenAI proxy (Claude via AWS Bedrock, GPT via NLP API) |
| Auth | JWT (python-jose) + bcrypt (passlib) |
| Validation | Pydantic v2 + pydantic-settings |
| HTTP client | httpx (for Azure TLS) |
| Testing | pytest + FastAPI TestClient |

---

## Project Structure

```
backend/
├── __init__.py
├── main.py                    # App entry point; registers all routers; --reindex CLI flag
├── config.py                  # Pydantic Settings; LLM factory; API key helper
├── database.py                # SQLAlchemy engine, session factory, Base class
├── dev_seed.py                # Development helper for quick seeding
├── seed_data.py               # Full seed: 16 users + 30 days of work logs
│
├── models/
│   ├── __init__.py
│   ├── user.py                # User ORM model
│   ├── work_log.py            # WorkLog ORM model
│   ├── work_item.py           # WorkItem ORM model
│   └── chat_history.py        # ChatHistory ORM model
│
├── schemas/
│   ├── __init__.py
│   ├── auth.py                # Register/Login/Token/UserProfile schemas
│   ├── extraction.py          # LLM extraction output schemas
│   ├── work_log.py            # Submit/Confirm/WorkLog response schemas
│   ├── work_item.py           # WorkItem update/response schemas
│   ├── dashboard.py           # Dashboard aggregation response schemas
│   └── chat.py                # Chat query/response/history schemas
│
├── routers/
│   ├── __init__.py
│   ├── auth.py                # /auth — register, login, /me
│   ├── updates.py             # /updates — submit/confirm/list/delete
│   ├── worklogs.py            # /worklogs — my items, team items, inline edit
│   ├── dashboard.py           # /dashboard — KPI, categories, status, trend, team
│   ├── chat.py                # /chat — query, history
│   └── admin.py               # /admin — users, seed, reindex, extraction errors
│
├── services/
│   ├── __init__.py
│   ├── auth_service.py        # JWT creation/decoding + bcrypt helpers
│   ├── extraction_service.py  # LangChain extraction chain + fallback
│   ├── chroma_service.py      # ChromaDB upsert/search/delete/reindex
│   ├── dashboard_service.py   # SQLAlchemy aggregation queries
│   └── chat_service.py        # LangGraph ReAct agent + 3 tools
│
└── prompts/
    ├── __init__.py
    └── extraction_prompt.py   # System + human prompt templates
```

---

## Configuration & Environment

### `backend/config.py`

Central configuration module. Responsibilities:

1. **`Settings` (Pydantic BaseSettings)** — reads from `.env`, with defaults:

| Setting | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./data/worktrack.db` | SQLite file path |
| `SECRET_KEY` | `change-me-…` | JWT signing key |
| `ALGORITHM` | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` (8 hours) | Token TTL |
| `LLM_PROVIDER` | `azure` | LLM provider identifier |
| `LLM_MODEL` | `Claude Sonnet 4.6` | Default model (fallback) |
| `LLM_MODEL_EXTRACTION` | `Claude Sonnet 4.6` | Model used by extraction chain |
| `LLM_MODEL_FIXING` | `Claude Haiku 4.5` | Model used by OutputFixingParser |
| `LLM_MODEL_CHAT` | `Claude Sonnet 4.6` | Model used by chat agent |
| `NLP_ENDPOINT` | `https://api.nlp.p.uptimize.merckgroup.com` | GPT model endpoint |
| `NLP_API_VERSION` | `2024-02-01` | GPT API version |
| `BEDROCK_ENDPOINT` | `https://api.nlp.p.uptimize.merckgroup.com/model` | Claude model endpoint |
| `BEDROCK_API_VERSION` | `2024-02-01` | Bedrock API version |
| `CHROMA_PATH` | `./data/chroma` | ChromaDB persistence directory |
| `EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for ChromaDB |

2. **`_resolve_cert()`** — locates the TLS certificate for Azure/Bedrock calls. Lookup order:
   - `backend/cacert.pem` (local)
   - `~/.ssh/cacert.pem` (user home)
   - `SSL_CERT_FILE` / `REQUESTS_CA_BUNDLE` env vars
   - `True` (system default)

3. **`get_api_key(key_name)`** — reads API keys from `APP_SERVICE_CONFIG` JSON blob first, then falls back to direct env var. Raises `ValueError` if not found.

4. **`get_llm(model)`** — LLM factory. Returns a fully configured `AzureChatOpenAI` instance.

### Environment Variables (`.env`)

```env
# Database
DATABASE_URL=sqlite:///./data/worktrack.db

# JWT
SECRET_KEY=<random 32+ char string>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

# LLM
LLM_PROVIDER=azure
LLM_MODEL=Claude Sonnet 4.6

# Azure endpoints
NLP_ENDPOINT=https://api.nlp.p.uptimize.merckgroup.com
NLP_API_VERSION=2024-02-01
BEDROCK_ENDPOINT=https://api.nlp.p.uptimize.merckgroup.com/model
BEDROCK_API_VERSION=2024-02-01

# API Keys (choose one format)
# Option A: JSON blob
APP_SERVICE_CONFIG={"AWS_BEDROCK_KEY": "...", "APP_SERVICE_NLP_API_KEY": "..."}
# Option B: direct vars
AWS_BEDROCK_KEY=your-key
APP_SERVICE_NLP_API_KEY=your-key

# ChromaDB
CHROMA_PATH=./data/chroma
EMBEDDING_MODEL=text-embedding-3-small
```

---

## LLM Factory

### `get_llm(model: str | None) -> AzureChatOpenAI`

Returns an `AzureChatOpenAI` configured for the given model display name. All models use `temperature=0` and `max_retries=0`.

**Model map:**

| Display Name | Model ID | Endpoint |
|---|---|---|
| `Claude Sonnet 4.6` | `eu.anthropic.claude-sonnet-4-6` | Bedrock |
| `Claude Opus 4.6` | `eu.anthropic.claude-opus-4-6-v1` | Bedrock |
| `Claude Haiku 4.5` | `eu.anthropic.claude-haiku-4-5-20251001-v1:0` | Bedrock |
| `Claude 4.5` | `eu.anthropic.claude-sonnet-4-5-20250929-v1:0` | Bedrock |
| `GPT-4o` | `gpt-4o` | NLP API |
| `GPT 5` | `gpt-5` | NLP API |
| `GPT 5.1` | `gpt-51` | NLP API |
| `GPT 5.2` | `gpt-52` | NLP API |
| `o1-mini` | `o1-mini` | NLP API |
| `o4-mini-gs` | `o4-mini-gs` | NLP API (api_version: `2024-09-12`, reasoning_effort: `medium`) |

**Bedrock calls** use an `httpx.Client` with the resolved `CERT_PATH` and an `openai-standard: True` header to satisfy the proxy.

**Unknown model names** fall back to Claude Sonnet 4.6 on Bedrock.

---

## Database Layer

### `backend/database.py`

| Component | Description |
|---|---|
| `engine` | SQLAlchemy `create_engine` with `check_same_thread=False` for SQLite |
| `SessionLocal` | `sessionmaker` factory — `autocommit=False`, `autoflush=False` |
| `Base` | `DeclarativeBase` — all ORM models extend this |
| `get_db()` | FastAPI dependency — yields a `Session`, closes on exit |
| `create_tables()` | Imports all models and calls `Base.metadata.create_all()` |

`_resolve_db_url()` ensures the parent directory for the SQLite file exists before the engine tries to open it.

`create_tables()` is called once during the FastAPI `lifespan` startup event.

---

## ORM Models

### `User` (`backend/models/user.py`)

**Table:** `users`

| Column | Type | Description |
|---|---|---|
| `id` | `String(36)` PK | UUID |
| `employee_id` | `String(50)` UNIQUE | e.g. `EMP-ENG-001` |
| `full_name` | `String(200)` | Display name |
| `email` | `String(200)` UNIQUE | Login email |
| `hashed_password` | `String(200)` | bcrypt hash |
| `role` | Enum(`employee`, `manager`, `admin`) | Access level |
| `team_name` | `String(100)` nullable | Team assignment |
| `manager_id` | FK → `users.id` nullable | Manager reference |
| `department` | `String(100)` nullable | Department |
| `is_active` | `Boolean` default `True` | Account status |
| `created_at` | `DateTime` | Creation timestamp |

**Relationships:**
- `work_logs` → list of `WorkLog`
- `chat_histories` → list of `ChatHistory`
- `direct_reports` → list of `User` (self-referential via `manager_id`)

---

### `WorkLog` (`backend/models/work_log.py`)

**Table:** `work_logs`

One row per natural-language submission. Acts as the parent container for extracted `WorkItem` records.

| Column | Type | Description |
|---|---|---|
| `id` | `String(36)` PK | UUID |
| `user_id` | FK → `users.id` | Submitting user |
| `work_date` | `Date` | Date the work was performed |
| `submitted_at` | `DateTime` | Server-side submission timestamp |
| `raw_message` | `Text` | Original NL submission (immutable) |
| `extraction_status` | Enum(`pending`, `success`, `failed`, `needs_review`) | LLM result |
| `model_name` | `String(100)` nullable | LLM model used |
| `parse_version` | `String(50)` nullable | Prompt version string |
| `is_deleted` | `Boolean` default `False` | Soft-delete flag |
| `superseded_by` | FK → `work_logs.id` nullable | Replacement log reference |

**Relationships:**
- `user` → `User`
- `work_items` → list of `WorkItem` (cascade delete)

**Lifecycle states:**

```
pending  →  success       (confirmed by user)
         →  failed        (LLM error, no items extracted)
         →  needs_review  (clarification required or fallback mode)
```

---

### `WorkItem` (`backend/models/work_item.py`)

**Table:** `work_items`

One row per individual task extracted from a `WorkLog`.

| Column | Type | Description |
|---|---|---|
| `id` | `String(36)` PK | UUID |
| `work_log_id` | FK → `work_logs.id` | Parent log |
| `employee_id` | `String(50)` | Employee identifier (denormalized) |
| `work_date` | `Date` | Date of work |
| `task_description` | `Text` | Extracted task description |
| `work_category` | Enum | Category (see values below) |
| `hours_spent` | `Float` nullable | Hours logged |
| `status` | Enum(`planned`, `in_progress`, `blocked`, `done`) nullable | Task status |
| `priority` | Enum(`low`, `medium`, `high`) nullable | Priority |
| `blockers` | `Text` nullable | Blocker description |
| `next_steps` | `Text` nullable | Next steps |
| `tags` | `JSON` nullable | Free-form string tags |
| `links` | `JSON` nullable | URLs |
| `project_name` | `String(200)` nullable | Project name |
| `ticket_id` | `String(50)` nullable | Ticket reference |
| `confidence_score` | `Float` nullable | LLM self-reported confidence (0.0–1.0) |
| `needs_review` | `Boolean` | Flagged for human review |
| `clarification_needed` | `Boolean` | LLM could not infer required fields |
| `clarification_reason` | `Text` nullable | Explanation of what's ambiguous |
| `is_user_corrected` | `Boolean` | User edited after extraction |
| `created_at` | `DateTime` | Creation timestamp |
| `updated_at` | `DateTime` | Last update timestamp |

**`work_category` allowed values:**

| Value | Meaning |
|---|---|
| `project` | Named project work (not ticket-tracked) |
| `ticket` | Work tracked in JIRA, ServiceNow, etc. |
| `polaris_classification` | Polaris classification or scoring tasks |
| `admin` | Administrative tasks |
| `meeting` | Meetings, standups, syncs |
| `learning` | Training, reading, self-development |
| `support` | Helping colleagues, on-call |
| `documentation` | Writing docs, wikis, runbooks |
| `review` | Code review, design review |
| `other` | Anything else |

---

### `ChatHistory` (`backend/models/chat_history.py`)

**Table:** `chat_history`

One row per chat turn (question + answer pair).

| Column | Type | Description |
|---|---|---|
| `id` | `String(36)` PK | UUID |
| `user_id` | FK → `users.id` | Querying user |
| `session_id` | `String(100)` | Groups turns into a conversation |
| `question` | `Text` | User's question |
| `answer` | `Text` | Agent's answer |
| `query_source` | Enum(`sql`, `vector`, `hybrid`) nullable | Tools used |
| `created_at` | `DateTime` | Timestamp |

---

## Pydantic Schemas

Schemas are the API contract between HTTP layer and service layer. They are distinct from ORM models.

### `schemas/auth.py`

| Schema | Direction | Fields |
|---|---|---|
| `RegisterRequest` | Request | `employee_id`, `full_name`, `email`, `password` (min 8), `role`, `team_name`, `department` |
| `LoginRequest` | Request | `email`, `password` |
| `TokenResponse` | Response | `access_token`, `token_type = "bearer"` |
| `UserProfile` | Response | `id`, `employee_id`, `full_name`, `email`, `role`, `team_name`, `department`, `is_active` |
| `TokenData` | Internal | Decoded JWT payload: `user_id`, `email`, `role`, `employee_id` |

`RegisterRequest` validators:
- `password_min_length`: raises if `len(password) < 8`
- `employee_id_not_empty`: strips and raises if blank

---

### `schemas/extraction.py`

LLM output contract. The extraction chain is instructed to return JSON matching `ExtractionResult` exactly.

**`WorkItemExtracted`:**

| Field | Type | Description |
|---|---|---|
| `task_description` | `str` | Required |
| `work_category` | `WorkCategory` | Required enum |
| `hours_spent` | `float` nullable | null if not mentioned |
| `status` | `StatusType` nullable | null if ambiguous |
| `priority` | `PriorityType` nullable | |
| `blockers` | `str` nullable | |
| `next_steps` | `str` nullable | |
| `tags` | `list[str]` nullable | |
| `links` | `list[str]` nullable | |
| `project_name` | `str` nullable | |
| `ticket_id` | `str` nullable | |
| `confidence_score` | `float` nullable | 0.0–1.0, LLM self-reported |
| `clarification_needed` | `bool` | True only if hours AND/OR status cannot be inferred |
| `clarification_reason` | `str` nullable | What is ambiguous |

Validators: `hours_non_negative`, `confidence_in_range` (0.0–1.0)

**`ExtractionResult`:**

| Field | Type | Description |
|---|---|---|
| `work_date` | `date` | Inferred from text or defaults to today |
| `items` | `list[WorkItemExtracted]` | At least one item required |
| `total_hours_warning` | `bool` | True if sum of hours > 12 |

---

### `schemas/work_log.py`

| Schema | Direction | Fields |
|---|---|---|
| `SubmitUpdateRequest` | Request | `raw_message`, `work_date` (optional) |
| `ConfirmUpdateRequest` | Request | `items: list[WorkItemExtracted]`, `work_date` |
| `WorkItemResponse` | Response | All WorkItem columns |
| `WorkLogResponse` | Response | All WorkLog columns + nested `work_items` list |
| `SubmitUpdateResponse` | Response | `work_log_id`, `work_date`, `extraction_status`, `items`, `total_hours_warning`, `has_clarification_needed` |

---

### `schemas/work_item.py`

| Schema | Direction | Fields |
|---|---|---|
| `WorkItemUpdate` | Request (PATCH-style) | `task_description`, `work_category`, `hours_spent`, `status`, `priority`, `blockers`, `next_steps`, `project_name`, `ticket_id` — all optional |
| `WorkItemResponse` | Response | All work item fields |

`WorkItemUpdate.hours_non_negative` validator rejects negative values.

---

### `schemas/dashboard.py`

| Schema | Fields |
|---|---|
| `HoursSummary` | `total_hours`, `done_count`, `in_progress_count`, `blocked_count`, `planned_count`, `total_items`, `start_date`, `end_date` |
| `CategoryHours` | `category`, `hours`, `item_count` |
| `StatusCount` | `status`, `count` |
| `DailyHours` | `date`, `hours`, `item_count` |
| `TeamMemberSummary` | `employee_id`, `full_name`, `total_hours`, `done_count`, `blocked_count`, `last_activity` |

---

### `schemas/chat.py`

| Schema | Fields |
|---|---|
| `ChatQueryRequest` | `question`, `session_id` (optional) |
| `SourceReference` | `work_item_id`, `work_date`, `task_description`, `work_category`, `employee_id` |
| `ChatResponse` | `answer`, `query_source`, `session_id`, `sources: list[SourceReference]` |
| `ChatHistoryItem` | `id`, `question`, `answer`, `query_source`, `session_id`, `created_at` |

---

## Routers (API Endpoints)

### Auth Router (`/auth`)

**File:** `backend/routers/auth.py`

Provides two reusable FastAPI dependencies:

**`get_current_user`** — Bearer token → `User` object. Raises `401` on invalid/expired token or inactive user.

**`require_role(*roles)`** — Dependency factory. Returns a dependency that raises `403` if the user's role is not in `roles`. Used as:
```python
Depends(require_role("manager", "admin"))
```

#### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Create account → returns JWT |
| `POST` | `/auth/login` | None | Authenticate → returns JWT |
| `GET` | `/auth/me` | Bearer | Returns `UserProfile` of current user |

**`POST /auth/register`**
- Validates `RegisterRequest`
- Checks for duplicate email (409 if exists)
- Hashes password with bcrypt
- Creates `User` row
- Returns `TokenResponse`

**`POST /auth/login`**
- Validates `LoginRequest`
- Calls `authenticate_user(db, email, password)`
- Returns 401 on wrong credentials
- Returns `TokenResponse` on success

**`GET /auth/me`**
- Requires valid Bearer token
- Returns `UserProfile` of the authenticated user

---

### Updates Router (`/updates`)

**File:** `backend/routers/updates.py`

Manages the two-step submit → confirm flow for work log submissions.

#### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/updates/submit` | Bearer | Run LLM extraction, return preview |
| `PUT` | `/updates/{work_log_id}/confirm` | Bearer | Persist confirmed items |
| `GET` | `/updates/` | Bearer | List own work logs (paginated) |
| `GET` | `/updates/{work_log_id}` | Bearer | Get a single work log with items |
| `PUT` | `/updates/{work_log_id}` | Bearer | Re-submit (soft-delete old, create new) |
| `DELETE` | `/updates/{work_log_id}` | Bearer | Soft-delete a work log |

**`POST /updates/submit`**

1. Creates a `WorkLog` with `extraction_status="pending"` and commits to SQLite.
2. Calls `run_extraction(raw_message, work_date)`.
3. If extraction fails, calls `fallback_extraction()` and sets status to `needs_review`.
4. Updates the `WorkLog` with final status and model name.
5. Returns `SubmitUpdateResponse` — the extraction preview. **Nothing is persisted yet beyond the pending log.**

**`PUT /updates/{work_log_id}/confirm`**

1. Looks up the pending `WorkLog` (must belong to current user, not deleted).
2. Raises `409` if already confirmed (status=success with items).
3. Deletes any previously created uncommitted items.
4. Creates `WorkItem` rows from the user's (possibly edited) `items` list.
5. Sets `WorkLog.extraction_status = "success"`.
6. Commits to SQLite — **this is the write to the source of truth**.
7. Upserts into ChromaDB (non-fatal: logs error and continues if ChromaDB fails).

**`PUT /updates/{work_log_id}` (resubmit)**

1. Soft-deletes the old `WorkLog` (`is_deleted=True`).
2. Removes old items from ChromaDB.
3. Creates a new pending `WorkLog`.
4. Runs extraction and returns a new `SubmitUpdateResponse` with the new `work_log_id`.

**`DELETE /updates/{work_log_id}`**

Sets `is_deleted=True` on the `WorkLog` and calls `delete_work_log()` to remove from ChromaDB.

---

### Worklogs Router (`/worklogs`)

**File:** `backend/routers/worklogs.py`

Manages individual `WorkItem` records after confirmation.

#### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/worklogs/my` | Bearer | Own items with filters |
| `GET` | `/worklogs/team` | Bearer (manager+) | Team items with filters |
| `PUT` | `/worklogs/{item_id}` | Bearer | Inline edit a single work item |

**`GET /worklogs/my`** — Query params:

| Param | Type | Description |
|---|---|---|
| `start_date` | `date` | Filter by work date (inclusive) |
| `end_date` | `date` | Filter by work date (inclusive) |
| `work_category` | `str` | Filter by category |
| `status` | `str` | Filter by status |
| `needs_review` | `bool` | Show only flagged items |
| `skip` | `int` default 0 | Pagination offset |
| `limit` | `int` default 50, max 200 | Page size |

Always filters to `WorkLog.user_id == current_user.id` and `WorkLog.is_deleted == False`.

**`GET /worklogs/team`** — Same filters plus:

| Param | Type | Description |
|---|---|---|
| `employee_id` | `str` | Filter to one employee |

Requires `manager` or `admin` role. Does **not** filter by `user_id` — returns all non-deleted items.

**`PUT /worklogs/{item_id}`** — Accepts `WorkItemUpdate` (all fields optional). Sets `is_user_corrected=True` on any change.

---

### Dashboard Router (`/dashboard`)

**File:** `backend/routers/dashboard.py`

All endpoints default to the current week (Mon–today) if no date range is provided.

#### Endpoints

| Method | Path | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/dashboard/summary` | Bearer | All | Hours + task counts |
| `GET` | `/dashboard/categories` | Bearer | All | Hours by category |
| `GET` | `/dashboard/status` | Bearer | All | Status distribution |
| `GET` | `/dashboard/trend` | Bearer | All | Daily hours over range |
| `GET` | `/dashboard/team/summary` | Bearer | manager+ | Per-employee summary |
| `GET` | `/dashboard/team/categories` | Bearer | manager+ | Team category breakdown |
| `GET` | `/dashboard/employees` | Bearer | manager+ | All employees (alias for team/summary) |

All endpoints accept `start_date` and `end_date` query params (ISO date strings). Team endpoints additionally accept `team_name`.

---

### Chat Router (`/chat`)

**File:** `backend/routers/chat.py`

#### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/chat/query` | Bearer | Run RAG agent, return answer |
| `GET` | `/chat/history` | Bearer | Retrieve past chat turns |

**`POST /chat/query`**

Calls `run_chat_query(question, user_id, user_role, db, session_id, team_name)`. Returns:
- `answer`: agent's synthesised text
- `query_source`: `"sql"` | `"vector"` | `"hybrid"`
- `session_id`: UUID identifying the conversation (auto-generated if not provided)
- `sources`: list of `SourceReference` from vector_search results

**`GET /chat/history`** — params: `session_id` (optional), `limit` (default 50, max 200).

---

### Admin Router (`/admin`)

**File:** `backend/routers/admin.py`

All endpoints require `admin` role.

#### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/users` | List all users |
| `GET` | `/admin/extraction-errors` | List failed/needs_review work logs |
| `POST` | `/admin/reindex` | Rebuild ChromaDB from SQLite |
| `PUT` | `/admin/users/{user_id}` | Update user role/status/team/dept |
| `POST` | `/admin/seed-dummy-data` | Seed demo data |

**`PUT /admin/users/{user_id}`** — accepts `UserUpdateRequest`:
- `role`: `employee` | `manager` | `admin`
- `is_active`: bool
- `team_name`: str
- `department`: str

Self-protection: admins cannot change their own role or deactivate themselves.

---

## Services

### `auth_service.py`

Pure utility functions — no business logic beyond authentication.

| Function | Description |
|---|---|
| `hash_password(plain)` | bcrypt hash via `passlib.CryptContext` |
| `verify_password(plain, hashed)` | bcrypt verify |
| `create_access_token(user_id, email, role, employee_id)` | Encodes JWT with `exp`, `sub`, `role`, `employee_id` |
| `decode_access_token(token)` | Decodes JWT → `TokenData`; raises `JWTError` on invalid/expired |
| `get_user_by_email(db, email)` | ORM query by email |
| `get_user_by_id(db, user_id)` | ORM query by UUID |
| `authenticate_user(db, email, password)` | Looks up user, verifies password; returns `None` on failure |

---

### `extraction_service.py`

Converts free-text to structured `ExtractionResult` using a two-model LangChain pipeline.

#### Chain Architecture

```
EXTRACTION_PROMPT
    |
    ▼
AzureChatOpenAI (LLM_MODEL_EXTRACTION — default: Claude Sonnet 4.6)
    |
    ▼
OutputFixingParser(
    PydanticOutputParser(ExtractionResult),
    llm=AzureChatOpenAI (LLM_MODEL_FIXING — default: Claude Haiku 4.5)
)
```

`OutputFixingParser` from `langchain_classic` retries malformed JSON using the fixing LLM before raising.

#### Functions

**`build_extraction_chain(model, fixing_model)`**
Constructs and returns `(chain, llm)`. Called by `run_extraction`.

**`run_extraction(raw_message, work_date, model)`**

Returns `(result, extraction_status, model_name)`:
- `result`: `ExtractionResult` or `None` on total failure
- `extraction_status`: `"success"` | `"needs_review"` | `"failed"`
- `model_name`: model display name used

Post-processing:
- Overrides `result.work_date` with the caller-specified `work_date` if provided.
- Sets `total_hours_warning=True` if sum of `hours_spent > 12`.
- Returns `"needs_review"` instead of `"success"` if any item has `clarification_needed=True`.

**`fallback_extraction(raw_message, work_date)`**

Used when the LLM is unavailable. Returns a single-item `ExtractionResult` where:
- `task_description` = first 1000 chars of raw message
- `work_category` = `"other"`
- `confidence_score` = 0.0
- `clarification_needed` = `True` with a message to the user

The user fills in fields manually in the frontend preview step.

#### `PARSE_VERSION`

String constant `"1.0"` stored in `WorkLog.parse_version` for tracking prompt changes over time.

---

### `chroma_service.py`

Manages the ChromaDB semantic index. SQLite is always the source of truth — ChromaDB is a derived index.

**Collection:** `work_items` (cosine similarity space)

#### Document Construction

Each work item is stored as a concatenated string document:
```
task_description | project: <name> | ticket: <id> | blockers: <text> | next_steps: <text> | tags: <csv>
```

#### Metadata Fields

| Field | Type | Purpose |
|---|---|---|
| `user_id` | str | Access control for employee scope |
| `employee_id` | str | Display in results |
| `work_log_id` | str | Enables `delete_work_log` |
| `work_date` | str | ISO date for display |
| `work_date_num` | int | YYYYMMDD integer for `$gte/$lte` range filtering |
| `work_category` | str | Category filter |
| `status` | str | Status filter |
| `priority` | str | Priority filter |
| `project_name` | str | Project filter |
| `ticket_id` | str | Ticket filter |
| `tags` | str | Comma-separated tags |
| `needs_review` | bool | Review flag |
| `hours_spent` | float | -1.0 if null |

**Note:** `work_date_num` exists because ChromaDB's `$gte`/`$lte` operators only support numeric comparisons. String date comparison is not supported.

#### Functions

| Function | Description |
|---|---|
| `upsert_work_items(work_items, user_id)` | Upserts a list of `WorkItem` ORM objects. Uses `work_item.id` as ChromaDB document ID. |
| `delete_work_log(work_log_id)` | Deletes all vectors where `metadata.work_log_id == work_log_id`. |
| `search_work_items(query, user_id, n_results, where)` | Semantic search. If `user_id` is set, enforces per-employee scope. Merges `user_id` filter with any additional `where` clauses using `$and`. |
| `reindex_from_sqlite(db)` | Drops and recreates the collection. Loads all non-deleted `WorkItem` rows via `selectinload(WorkItem.work_log)`. Processes in batches of 100. Returns item count. |

#### Filter Merging Logic

ChromaDB does not support direct dict merging for filters with operator keys. The service always constructs filters using `$and`:
```python
# Two conditions → {"$and": [{"user_id": {"$eq": uid}}, date_filter]}
# One condition  → condition directly
# Zero conditions → None
```

---

### `dashboard_service.py`

Pure SQLAlchemy aggregation queries. No ChromaDB involvement — uses SQLite directly.

All employee queries share a base query helper:

```python
def _employee_items_query(db, user_id, start_date, end_date):
    return (
        db.query(WorkItem)
        .join(WorkLog)
        .filter(
            WorkLog.user_id == user_id,
            WorkLog.is_deleted == False,
            WorkItem.work_date >= start_date,
            WorkItem.work_date <= end_date,
        )
    )
```

#### Functions

| Function | Returns | Description |
|---|---|---|
| `get_hours_summary(db, user_id, start, end)` | `HoursSummary` | Total hours + status counts |
| `get_hours_by_category(db, user_id, start, end)` | `list[CategoryHours]` | `GROUP BY work_category ORDER BY hours DESC` |
| `get_status_distribution(db, user_id, start, end)` | `list[StatusCount]` | `GROUP BY status` (excludes null status) |
| `get_daily_trend(db, user_id, start, end)` | `list[DailyHours]` | `GROUP BY work_date ORDER BY date` |
| `get_team_summary(db, start, end, team_name)` | `list[TeamMemberSummary]` | Per-employee summary for all active users, optionally filtered by team |
| `get_team_hours_by_category(db, start, end, team_name)` | `list[CategoryHours]` | Category breakdown across all team members |

`get_team_summary` also queries each employee's most recent `WorkLog.work_date` with `extraction_status="success"` to populate `last_activity`.

---

### `chat_service.py`

LangGraph ReAct agent that answers natural language questions about work data.

#### Architecture

```
run_chat_query()
    │
    ├── make_tools(user_id, user_role, db, team_name)
    │       ├── date_resolver  (pure Python, no LLM)
    │       ├── sql_query      (dashboard_service + list_items)
    │       └── vector_search  (chroma_service.search_work_items)
    │
    ├── get_llm(LLM_MODEL_CHAT)
    │
    ├── create_react_agent(llm, tools)
    │
    └── agent.invoke({messages: [system, history, question]})
```

#### Tool: `date_resolver`

Converts natural language date expressions to `{start_date, end_date}` JSON. Pure Python — no LLM call.

Supported expressions:
- `today`, `yesterday`
- `this week` / `current week`, `last week`
- `this month` / `current month`, `last month`
- `last N days`, `past N days`
- `last N weeks`, `last N months`
- Fallback: current week

#### Tool: `sql_query`

Queries structured data from SQLite. Parameters:

| Param | Description |
|---|---|
| `metric` | `list_items`, `total_hours_summary`, `hours_by_category`, `status_distribution`, `daily_trend`, `team_summary` |
| `start_date` | ISO date string |
| `end_date` | ISO date string |
| `category` | Optional category filter |
| `status` | Optional status filter |
| `target_employee_id` | Manager only — resolves employee_id or UUID to internal user_id |
| `team_name` | Manager only — filter team_summary |

`list_items` metric fetches actual `WorkItem` rows with descriptions (up to 20), enabling the agent to answer "what tasks did I do?" type questions.

Access control: employee queries always use `query_uid = user_id`. Managers can specify `target_employee_id` which resolves to a different `user_id`.

#### Tool: `vector_search`

Semantic similarity search over ChromaDB. Parameters: `query`, `n_results` (max 20), `start_date`, `end_date` (optional).

Scope: employees always search within their own data (`search_uid = user_id`). Managers/admins get `search_uid = None` (no user filter).

Date filtering uses `work_date_num` integer comparison via `$gte`/`$lte`.

#### System Prompt

Built dynamically per-request with:
- User's role context
- Team name (for manager-aware instructions)
- Today's date
- Tool usage guidelines

Key guidelines enforced:
- Always call `date_resolver` first for relative date queries
- Use `list_items` (not `vector_search`) when user wants to see specific tasks
- Follow up vague references with `list_items` using the prior date range
- Broaden date range if no data found and inform the user

#### Query Source Detection

After the agent completes, tool messages are inspected:
- Both `sql_query` and `vector_search` used → `"hybrid"`
- Only `vector_search` → `"vector"`
- Otherwise → `"sql"`

`date_resolver` is excluded from this classification.

#### Conversation History

Before each invocation, the last 10 turns from the same session are loaded from `ChatHistory` and injected as `HumanMessage`/`AIMessage` pairs so the agent has context for follow-up questions.

#### History Persistence

`_save_history()` saves each Q&A turn to `ChatHistory`. Failures are caught and logged without raising.

---

## Prompts

### `backend/prompts/extraction_prompt.py`

**System prompt key rules:**

1. Split compound updates into separate items.
2. Resolve relative dates (e.g. "yesterday") to absolute dates using the `{today}` variable.
3. `clarification_needed=true` only when `hours_spent` AND/OR `status` cannot be inferred — not for missing optional fields.
4. Use only allowed enum values.
5. Normalise status variants: `"ongoing"` → `"in_progress"`, `"completed"` → `"done"`, `"waiting"` → `"blocked"`.
6. `total_hours_warning=true` if sum of hours > 12.
7. `confidence_score` = extraction certainty (0.0–1.0).
8. Ignore non-work noise.

**Template variables:** `{today}` (ISO date), `{raw_message}` (employee submission).

**Prompt structure:**
```python
EXTRACTION_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),  # contains the schema and rules
    ("human", "{raw_message}"),
])
```

---

## Seed Data

### `backend/seed_data.py`

Creates a realistic dataset for development and demos.

**Users created:**

| Role | Count | Details |
|---|---|---|
| Admin | 1 | `ADMIN-001 / admin@worktrack.ai` |
| Manager | 3 | One per team (Engineering, Data, Support) |
| Employee | 12 | 4 per team |

**Work logs:**
- 30 days of history for each of the 12 employees
- Weekdays only (~10% chance of skipping a day for PTO simulation)
- 1–3 tasks per day chosen from team-specific task templates
- ~10% edge case entries (missing hours, vague descriptions, `needs_review` flag)

**Default password:** `WorkTrack2026!`

**Idempotent:** skips if users already exist. Called by `POST /admin/seed-dummy-data`.

**Task templates per team:**

| Team | Task types |
|---|---|
| Engineering | tickets, reviews, project work, meetings, documentation, bugs |
| Data | ETL pipelines, data quality, Polaris classification, ML models |
| Support | support tickets, escalations, documentation, admin |

**Deterministic:** uses `random.Random(42)` so seed output is reproducible.

---

## Tests

Tests live in `tests/` and mirror the `backend/` structure.

### `tests/conftest.py`

Shared fixtures:

| Fixture | Scope | Description |
|---|---|---|
| `setup_test_db` | `autouse=True` | Creates all tables before each test, drops after |
| `db` | Function | In-memory SQLite session via `StaticPool` |
| `client` | Function | `TestClient` with test DB injected via `app.dependency_overrides` |

`StaticPool` forces all connections to share the same `:memory:` database — required so that tables created in one connection are visible to queries on another.

Helper function `register_user(client, ...)` — registers a user and returns the JWT token string.

### Test Files

| File | What it tests |
|---|---|
| `test_auth_router.py` | Register (success, duplicate email, weak password), login (success, wrong password), /me |
| `test_auth_service.py` | `hash_password`, `verify_password`, `create_access_token`, `decode_access_token` |
| `test_extraction_service.py` | Extraction chain with mocked LLM, compound task splitting, fallback extraction |
| `test_extraction_schemas.py` | `ExtractionResult` and `WorkItemExtracted` validators |
| `test_updates_router.py` | Submit/confirm flow, pagination, soft delete, resubmit |
| `test_updates_crud.py` | CRUD operations on work logs and items |
| `test_worklogs_router.py` | Implicit in updates; inline edit via PUT /worklogs/{id} |  
| `test_dashboard_router.py` | All dashboard endpoints with seeded data |
| `test_dashboard_service.py` | Direct service function tests with SQLite sessions |
| `test_chroma_service.py` | upsert, search, delete, reindex (with mocked ChromaDB client) |
| `test_chat_router.py` | POST /chat/query, GET /chat/history |
| `test_chat_service.py` | run_chat_query with mocked agent |
| `test_chat_tools.py` | date_resolver expressions, sql_query metrics, vector_search |
| `test_admin_router.py` | All admin endpoints with role enforcement |
| `test_seed_data.py` | seed() idempotency, user counts, work log counts |

### Integration Tests (`tests/integration/`)

| File | Description |
|---|---|
| `test_extraction_integration.py` | Real LLM call — skipped if `AWS_BEDROCK_KEY` not set |
| `test_chat_integration.py` | Real agent invocation — skipped if `AWS_BEDROCK_KEY` not set |

---

## Running the Backend

```bash
# 1. Activate the virtualenv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy and configure environment
cp .env.example .env
# Edit .env — set SECRET_KEY, AWS_BEDROCK_KEY, APP_SERVICE_NLP_API_KEY

# 4. Start the API server (auto-creates tables on first run)
uvicorn backend.main:app --reload --port 8000

# 5. Seed demo data (run once — idempotent)
python -m backend.seed_data
# OR via API after login:
# POST /admin/seed-dummy-data

# 6. Rebuild ChromaDB index (after data changes)
python -m backend.main --reindex
# OR via API:
# POST /admin/reindex

# 7. Run tests
pytest
pytest --cov=backend --cov-report=term-missing

# 8. Interactive API docs
# http://localhost:8000/docs   (Swagger UI)
# http://localhost:8000/redoc  (ReDoc)
```

### Health Check

```
GET /health → {"status": "ok"}
```

---

## Key Design Contracts

1. **Identity from JWT only** — `user_id` on every record is always set server-side from the decoded JWT. The LLM output never determines who submitted what.

2. **SQLite first, ChromaDB second** — Every write commits to SQLite before touching ChromaDB. ChromaDB failures are non-fatal; SQLite is the source of truth.

3. **Pending → confirmed two-step** — `POST /updates/submit` creates a `pending` log and returns a preview. `PUT /updates/{id}/confirm` is the only call that persists `WorkItem` rows and indexes them in ChromaDB.

4. **Role enforcement in services** — Employee filters (`WorkLog.user_id == current_user.id`) are applied at the service/query level, not only at the router level.

5. **Soft delete only** — Work logs are never hard-deleted. `is_deleted=True` hides them from all queries and triggers ChromaDB cleanup.
