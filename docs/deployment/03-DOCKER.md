# Understanding the Dockerfile

The Dockerfile is a recipe that tells Docker how to package your application. Think of it like a cooking recipe — each line is a step.

---

## Our Dockerfile (line by line)

```dockerfile
FROM --platform=linux/amd64 python:3.12-slim
```
**What:** Start with a lightweight Linux machine that has Python 3.12 pre-installed.
**Why:** `linux/amd64` ensures it runs on Uptimize servers (which are Intel/AMD, not ARM). `slim` means a smaller image (fewer MB to transfer).

---

```dockerfile
RUN apt-get update && \
    apt-get install -y nodejs npm curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```
**What:** Install Node.js and npm (JavaScript tools).
**Why:** We need these to build the React frontend (`npm run build`). The cleanup at the end keeps the image small.

---

```dockerfile
WORKDIR /app
```
**What:** Set `/app` as the working directory inside the container.
**Why:** All subsequent commands run from this folder. Like doing `cd /app`.

---

```dockerfile
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
```
**What:** Copy the Python dependencies list and install them.
**Why:** We copy just `requirements.txt` first (before the rest of the code) so Docker can cache this step. If your code changes but dependencies don't, Docker skips re-installing — makes builds faster.

---

```dockerfile
COPY frontend-react/ frontend-react/
RUN cd frontend-react && npm install && npm run build && rm -rf node_modules
```
**What:** Copy the React frontend, install JS dependencies, build it, then delete `node_modules`.
**Why:** `npm run build` produces static HTML/JS/CSS in `frontend-react/dist/`. After building, we don't need the 200MB+ `node_modules` folder anymore — deleting it saves space.

---

```dockerfile
COPY backend/ backend/
COPY .env.example .env
```
**What:** Copy the backend Python code and a template `.env` file.
**Why:** The backend is what actually runs. The `.env.example` provides defaults — real secrets are injected via environment variables at runtime (not baked in).

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
**Why:** Uptimize convention. This doesn't actually open the port — it's informational. The `CMD` below is what actually starts the server on 8080.

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
docker build -t worktrack-ai .

# Run it (pass your .env file for secrets)
docker run -p 8080:8080 --env-file .env worktrack-ai

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
| Build fails at `npm install` | `package-lock.json` out of sync | Run `cd frontend-react && npm install` locally first, commit the updated lockfile |
| App starts but LLM calls fail | Missing API keys | Set environment variables in Uptimize config (not in Dockerfile) |
| Container exits immediately | Python error on startup | Run `docker logs <container-id>` to see the error |
| Image too large (>2GB) | `node_modules` not cleaned | Make sure `rm -rf node_modules` is in the Dockerfile after build |
