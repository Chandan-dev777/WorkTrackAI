# DailyOps AI

Employees submit daily work updates in natural language. An LLM pipeline extracts structured records, stores them in a database + ChromaDB, and exposes them via a React dashboard and a conversational RAG assistant.

## Prerequisites

- Python 3.12+
- Node.js 18+
- Access to Uptimize DBaaS (PostgreSQL) — ask the team lead for database access
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
# Edit .env — paste fresh AWS credentials from DBaaS console:
#   AWS_ACCESS_KEY_ID=...
#   AWS_SECRET_ACCESS_KEY=...
#   AWS_SESSION_TOKEN=...
# The database URL and IAM role are already pre-configured.
```

### Getting AWS Credentials (required for database access)

1. Go to the Uptimize DBaaS console
2. Open the `db_MbCaBw` database → "Get Credentials"
3. Copy `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
4. Paste them into your `.env` file
5. These credentials expire after ~1 hour — repeat when they expire

## Running Locally

**Option A — Single server (production-like)**

```bash
# Build frontend into static files served by FastAPI
cd frontend-react && npm run build && cd ..

# Start the server
source .venv/bin/activate
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
# Visit http://localhost:8000
```

**Option B — Two servers (dev mode with hot-reload)**

```bash
# Terminal 1 — API
source .venv/bin/activate
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000

# Terminal 2 — Frontend (Vite dev server with HMR)
cd frontend-react && npm run dev
# Visit http://localhost:5173
```

On first startup, the app automatically creates tables and seeds demo data if the database is empty.

## Database

Everyone connects to the same **Uptimize DBaaS PostgreSQL** database — both locally and on App Service. This means you always work with real data and avoids SQLite/PostgreSQL mismatches.

The database uses IAM authentication (rotating tokens via boto3). On App Service, the ECS task role provides credentials automatically. Locally, you provide them via `.env` (see setup above).

Tests use an in-memory SQLite database (via `conftest.py`) and don't touch production data.

## Seed Demo Data

Data is seeded automatically on first startup. To re-seed manually:

```bash
# Delete existing DB and restart (SQLite only)
rm data/dailyops.db
.venv/bin/python -m uvicorn backend.main:app --reload --port 8000
```

All seeded users use password: `DailyOps2026!` — see `docs/TEST_CREDENTIALS.md` for the full list.

Quick logins: `admin@dailyops.ai` (admin), `sarah.connor@dailyops.ai` (manager), `john.reese@dailyops.ai` (employee).

## Tests

```bash
source .venv/bin/activate
.venv/bin/python -m pytest                   # all tests (LLM calls are mocked)
.venv/bin/python -m pytest --cov=backend     # with coverage
```

## Deployment (Uptimize App Service)

The app deploys as a Docker container via Azure DevOps pipeline:

1. Push to `main` branch in the Azure DevOps repo
2. Pipeline builds Docker image and pushes to ECR
3. Uptimize App Service pulls and runs the container on port 8080
4. PostgreSQL (DBaaS) provides persistent storage with IAM auth

App URL: `https://dailyops-ai.apps.p.uptimize.merckgroup.com/`

## Project Structure

```
backend/          FastAPI — auth, CRUD, LLM extraction, RAG chat, dashboards
frontend-react/   React + Vite + Tailwind UI
tests/            Backend unit & integration tests
docs/             Additional documentation
data/             Local SQLite DB and ChromaDB (gitignored)
Dockerfile        Multi-stage build (Node frontend + Python backend)
azure-pipelines.yml   CI/CD pipeline for Uptimize App Service
```
