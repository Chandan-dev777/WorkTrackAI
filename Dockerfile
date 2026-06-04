# ── Stage 1: Build React frontend ─────────────────────────────────────────────
FROM --platform=linux/amd64 node:20-slim AS frontend-build

WORKDIR /build
COPY frontend-react/package.json frontend-react/package-lock.json ./
RUN npm ci
COPY frontend-react/ .
RUN npm run build


# ── Stage 2: Production image ─────────────────────────────────────────────────
FROM --platform=linux/amd64 python:3.12-slim

WORKDIR /app

# Install Python dependencies (cached layer — only rebuilds if requirements.txt changes)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ backend/
COPY .env.example .env

# Copy built frontend from stage 1
COPY --from=frontend-build /build/dist frontend-react/dist

# Create data directory for ChromaDB (SQLite replaced by DBaaS PostgreSQL)
RUN mkdir -p data

# Uptimize expects port 8080
EXPOSE 8080

# Start the FastAPI server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
