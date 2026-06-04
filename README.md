# DailyOps AI

Employees submit daily work updates in natural language. An LLM pipeline extracts structured records, stores them in SQLite + ChromaDB, and exposes them via a React dashboard and a conversational RAG assistant.

## Prerequisites

- Python 3.12+
- Node.js 18+
- Access to the internal NLP proxy (AWS Bedrock + NLP API keys)

## Setup

```bash
# 1. Create and activate Python virtual environment
python -m venv .venv
source .venv/bin/activate     # Linux/macOS
# .venv\Scripts\activate      # Windows

# 2. Install backend dependencies
pip install -r requirements.txt

# 3. Install frontend dependencies
cd frontend-react && npm install && cd ..

# 4. Configure environment
cp .env.example .env
# Edit .env — fill in: AWS_BEDROCK_KEY, APP_SERVICE_NLP_API_KEY, SECRET_KEY
```

## Running

**Option A — Single server (production-like)**

```bash
cd "/home/x288712/DailyOps AI/dailyops-ai" && source .venv/bin/activate && uvicorn backend.main:app --reload --port 8000
cd frontend-react && npm run build && cd ..
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000
# Visit http://localhost:8000
```

**Option B — Two servers (dev mode with hot-reload)**

```bash
# Terminal 1 — API
source .venv/bin/activate
uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend-react && npm run dev
# Visit http://localhost:5173
```

## Seed Demo Data

```bash
curl -X POST http://localhost:8000/admin/seed-dummy-data
```

All seeded users use password: `DailyOps2026!` — see `docs/TEST_CREDENTIALS.md` for the full list.

Quick logins: `admin@dailyops.ai` (admin), `sarah.connor@dailyops.ai` (manager), `john.reese@dailyops.ai` (employee).

## Tests

```bash
pytest                        # all tests (LLM calls are mocked)
pytest --cov=backend          # with coverage
```

## Project Structure

```
backend/          FastAPI — auth, CRUD, LLM extraction, RAG chat, dashboards
frontend-react/   React + Vite + Tailwind UI
frontend/         Legacy Streamlit UI (deprecated)
tests/            Backend unit & integration tests
docs/             Additional documentation
```
