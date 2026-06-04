# Understanding the Dockerfile

The Dockerfile is a recipe that tells Docker how to package your application. We use a **multi-stage build** — one stage builds the frontend, another runs the app. This keeps the final image small.

---

## Our Dockerfile (line by line)

### Stage 1: Build the React Frontend

```dockerfile
FROM --platform=linux/amd64 node:20-slim AS frontend-build
```
**What:** Use Node.js 20 to build the frontend.
**Why:** Vite 5 requires Node 18+. This stage is temporary — it only exists during the build process, not in the final image.

---

```dockerfile
WORKDIR /build
COPY frontend-react/package.json frontend-react/package-lock.json ./
RUN npm ci
```
**What:** Copy the lockfile and install JS dependencies using `npm ci`.
**Why:** `npm ci` is faster and more reliable than `npm install` — it uses the exact versions from `package-lock.json`. Copying just these files first allows Docker to cache this step.

---

```dockerfile
COPY frontend-react/ .
RUN npm run build
```
**What:** Copy all frontend source code and build it.
**Why:** `npm run build` produces static HTML/JS/CSS in a `dist/` folder. This is all we need for production.

---

### Stage 2: Production Image

```dockerfile
FROM --platform=linux/amd64 python:3.12-slim
```
**What:** Start the final image with Python 3.12 (no Node.js!).
**Why:** `linux/amd64` ensures it runs on Uptimize servers. `slim` means a smaller image. Node is gone — we only need the built static files.

---

```dockerfile
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
```
**What:** Install Python dependencies.
**Why:** Copied separately for Docker layer caching — if `requirements.txt` doesn't change, Docker skips this step on rebuilds.

---

```dockerfile
COPY backend/ backend/
COPY .env.example .env
```
**What:** Copy the backend Python code and a template `.env` file.
**Why:** The backend is what actually runs. The `.env.example` provides defaults — real secrets are injected via environment variables at runtime (not baked in).

---

```dockerfile
COPY --from=frontend-build /build/dist frontend-react/dist
```
**What:** Copy the built frontend files from Stage 1 into the final image.
**Why:** We only need the output (`dist/` folder with HTML/JS/CSS), not the source code or `node_modules`. This makes the final image ~500MB smaller.

---

```dockerfile
RUN mkdir -p data
```
**What:** Create the `data/` directory.
**Why:** SQLite and ChromaDB write files here when the app starts.

---

```dockerfile
EXPOSE 8080
```
**What:** Document that the container listens on port 8080.
**Why:** Uptimize convention. This is informational — the `CMD` below actually starts the server on 8080.

---

```dockerfile
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
```
**What:** The command that runs when the container starts.
**Why:** Starts our FastAPI backend server. `0.0.0.0` means "accept connections from anywhere" (needed inside Docker). Port 8080 matches what Uptimize expects.

---

## How to Test Locally

Before pushing to the pipeline, test the Docker image on your machine:

```bash
# Build the image (takes 2-5 minutes first time)
docker build -t dailyops-ai .

# Run it (pass your .env file for secrets)
docker run -p 8080:8080 --env-file .env dailyops-ai

# Visit http://localhost:8080 in your browser
```

If it works locally, it will work on Uptimize.

---

## .dockerignore

To keep the image small and avoid accidentally including secrets, we have a `.dockerignore` file that excludes:
- `.env` (real secrets)
- `.venv/` (local virtual environment — we install fresh in Docker)
- `node_modules/` (installed fresh in Docker)
- `data/` (local database files)
- `.git/` (git history, not needed at runtime)

---

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Build fails at `npm ci` | `package-lock.json` out of sync | Run `cd frontend-react && npm install` locally first, commit the updated lockfile |
| App starts but LLM calls fail | Missing API keys | Set environment variables in Uptimize config (not in Dockerfile) |
| Container exits immediately | Python error on startup | Run `docker logs <container-id>` to see the error |
| Image too large (>1.5GB) | Something wrong with multi-stage | Verify `COPY --from=frontend-build` only copies `dist/`, not full source |
