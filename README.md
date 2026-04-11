# WorkTrack AI

AI-powered employee work progress tracker. Employees submit daily updates in natural language; an LLM pipeline extracts structured work records, stores them in SQLite + ChromaDB, and exposes them via a role-aware Streamlit dashboard and a conversational RAG assistant.

---

## Requirements

- Python 3.12+
- Access to the internal NLP proxy (AWS Bedrock / NLP API keys)

---

## Setup

**1. Create and activate the virtual environment**

```bash
python -m venv .venv
source .venv/bin/activate
```

**2. Install dependencies**

```bash
pip install -r requirements.txt
```

**3. Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` and set your API credentials. The minimum required is one of:

- `APP_SERVICE_CONFIG` — JSON blob containing `AWS_BEDROCK_KEY` and `APP_SERVICE_NLP_API_KEY`
- Or set `AWS_BEDROCK_KEY` and `APP_SERVICE_NLP_API_KEY` directly

The TLS certificate for Bedrock calls is loaded automatically from `backend/cacert.pem` or `~/.ssh/cacert.pem`.

---

## Running the App

Start the backend and frontend in two separate terminals.

**Terminal 1 — FastAPI backend**

```bash
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

API available at `http://localhost:8000`
Interactive docs at `http://localhost:8000/docs`

**Terminal 2 — Streamlit frontend**

```bash
source .venv/bin/activate
streamlit run frontend/app.py
```

UI available at `http://localhost:8501`

---

## Seed Data

Populate the database with 15 sample employees (3 managers + 12 employees across Engineering, Data, and Support teams):

```bash
python backend/seed_data.py
```

---

## Running Tests

```bash
# All tests
pytest

# Single file
pytest tests/test_extraction_service.py

# Single test
pytest tests/test_extraction_service.py::TestRunExtractionSuccess::test_returns_extraction_result

# With coverage
pytest --cov=backend --cov-report=term-missing
```

All LLM and ChromaDB calls are mocked in tests — no API keys needed to run the test suite.

---

## Project Structure

```
backend/
  config.py             LLM factory + settings (reads .env)
  database.py           SQLAlchemy engine and session
  main.py               FastAPI app entry point
  models/               ORM models: User, WorkLog, WorkItem, ChatHistory
  schemas/              Pydantic I/O schemas
  routers/              Route handlers (auth, updates)
  services/
    auth_service.py     JWT + bcrypt helpers
    extraction_service.py  LangChain NL → structured extraction
    chroma_service.py   ChromaDB upsert / search / delete
  prompts/              LLM prompt templates
  seed_data.py          Sample data generator

frontend/
  app.py                Streamlit login/register page
  pages/
    1_Submit_Update.py  Submit daily work update
    2_My_Dashboard.py   Personal work history
    3_Team_Dashboard.py Team overview (managers only)
    4_Chat_Assistant.py RAG chat interface

tests/
  conftest.py           Shared fixtures (in-memory DB, test client)
  test_auth_service.py
  test_auth_router.py
  test_extraction_schemas.py
  test_extraction_service.py
  test_chroma_service.py
  test_updates_router.py

data/
  worktrack.db          SQLite database (auto-created on first run)
  chroma/               ChromaDB vector index
```

---

## Rebuilding the ChromaDB Index

If ChromaDB gets out of sync with SQLite:

```bash
python -m backend.main --reindex
```

---

## User Roles

| Role | Access |
|---|---|
| `employee` | Submit updates, view own dashboard, use chat |
| `manager` | All employee access + team dashboard |
| `admin` | Full access |
