# Deployment Overview

## What Are We Doing?

We're putting our DailyOps AI application on the **Uptimize cloud platform** so that ~20 team members can access it via:

**https://dailyops-ai.apps.p.uptimize.merckgroup.com/**

---

## How Does It Work? (Big Picture)

```
Your Code (Azure DevOps Git)
       │
       ▼  push to main
Azure DevOps Pipeline (CI/CD)
       │
       ▼  builds a Docker image
AWS ECR (Container Registry)
       │
       ▼  Uptimize pulls the image
Uptimize Cloud (runs your container)
       │
       ▼
Users access via browser URL
```

### Explanation of each piece:

| Component | What it is | Why we need it |
|-----------|-----------|----------------|
| **Docker** | A tool that packages your app + all its dependencies into a single "box" (image) | So the app runs the same way everywhere — no "works on my machine" issues |
| **Dockerfile** | A recipe file that tells Docker how to build that box | Defines what goes inside: Python, Node, your code, dependencies |
| **AWS ECR** | Amazon's container storage (like DockerHub but private) | A place to store your built Docker images so Uptimize can pull them |
| **Azure DevOps** | Microsoft's CI/CD tool (like GitHub Actions) | Automates the build-and-deploy process every time you push code |
| **Uptimize** | Merck's internal cloud platform | Runs your container and gives it a URL, handles scaling, SSL, etc. |

---

## What Happens When You Push Code?

1. You `git push` to the `main` branch
2. Azure DevOps detects the push (via a "trigger")
3. It spins up a temporary Linux machine
4. It logs into AWS (using shared templates — no manual AWS setup)
5. It runs `docker build` → creates an image of your app
6. It pushes that image to ECR (Amazon's container registry)
7. Uptimize detects the new image and restarts your app with it
8. Your app is live at its URL within ~2-3 minutes

---

## Our Application in Docker

DailyOps AI has two parts that need to be packaged:

| Part | What it does | How it's packaged |
|------|-------------|-------------------|
| **React frontend** | The UI your team sees in the browser | Built at Docker build time (`npm run build`) → static HTML/JS/CSS files |
| **FastAPI backend** | The API server (auth, LLM extraction, chat, dashboards) | Runs as the main process inside the container (`uvicorn`) |

The backend serves the built frontend files directly — so we only need **one container**, not two.

---

## Port 8080

Uptimize expects all apps to listen on port **8080**. This is a platform convention. Our Dockerfile sets this, and the backend starts on that port.

---

## Next Steps

1. [02-PREREQUISITES.md](./02-PREREQUISITES.md) — What access and credentials you need
2. [03-DOCKER.md](./03-DOCKER.md) — Understanding the Dockerfile
3. [04-CICD.md](./04-CICD.md) — Understanding the Azure DevOps pipeline
4. [05-ENVIRONMENT-VARIABLES.md](./05-ENVIRONMENT-VARIABLES.md) — Configuring secrets on the platform
5. [06-DEPLOY-STEPS.md](./06-DEPLOY-STEPS.md) — Step-by-step deployment walkthrough
