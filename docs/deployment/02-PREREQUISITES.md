# Prerequisites — Access & Credentials You Need

Before you can deploy, you need to request access to several systems. Here's exactly what to ask for and who to ask.

---

## 1. Uptimize App Slot

**What:** A registered application on the Uptimize cloud platform.

**Why:** This creates your app's identity — gives you an `AppDestinationId`, a URL, and a place to configure environment variables.

**How to get it:**
- Go to the Uptimize portal (or ask your platform team)
- Request a new "App Service" for your project
- Specify: app name (`dailyops-ai`), team, environment (dev for now)

**What you'll receive:**
- `AppDestinationId` — something like `app-cbh1a76flzz9bvjj`
- App URL — something like `https://dailyops-ai.app.uptimize.merckgroup.com`

---

## 2. Azure DevOps Project Access

**What:** Access to an Azure DevOps project where your CI/CD pipeline will live.

**Why:** This is where the automated build-and-deploy pipeline runs.

**How to get it:**
- Ask your team lead or the person who set up the other app's pipeline
- You need access to the project that has the `factory-appservice-nreg-ec1` templates
- You need permission to create pipelines and connect to GitHub

**What you'll need to know:**
- The Azure DevOps organization URL (e.g., `https://dev.azure.com/your-org`)
- The project name
- Whether there's an existing service connection to GitHub (or you'll create one)

---

## 3. AWS ECR Access (Handled Automatically)

**What:** Container registry where Docker images are stored.

**Why:** Uptimize pulls your app image from here.

**How it works:** You do NOT need personal AWS credentials. The `factory-appservice-nreg-ec1` pipeline templates handle AWS authentication automatically using service principals. Once you have the `AppDestinationId`, the templates know which ECR repo to push to.

---

## 4. GitHub Repository Access

**What:** Your repo needs to be accessible from Azure DevOps.

**Why:** The pipeline needs to pull your source code to build it.

**How to set up:**
- In Azure DevOps → Project Settings → Service Connections
- Create a "GitHub" service connection (or use an existing one)
- Authorize it to access `Chandan-dev777/DailyOpsAI`

---

## 5. NLP API Keys (For the App Itself)

**What:** The API keys your app uses to call the LLM.

**Why:** Your app needs these at runtime to do extraction and chat.

**These are NOT baked into the Docker image.** They are set as environment variables in the Uptimize app configuration (see [05-ENVIRONMENT-VARIABLES.md](./05-ENVIRONMENT-VARIABLES.md)).

| Key | Purpose | Where to get it |
|-----|---------|----------------|
| `AWS_BEDROCK_KEY` | Claude models via Bedrock | From your team's existing setup (check the chatbot config) |
| `APP_SERVICE_NLP_API_KEY` | GPT models via NLP API | Same — already used in the chatbot |
| `SECRET_KEY` | JWT signing for user auth | Generate any random string (e.g., `openssl rand -hex 32`) |

---

## Summary Checklist

| # | Item | Who to ask | Status |
|---|------|-----------|--------|
| 1 | Uptimize App Slot + AppDestinationId | Platform team / Uptimize portal | ☐ |
| 2 | Azure DevOps project access | Team lead / DevOps admin | ☐ |
| 3 | GitHub service connection in Azure DevOps | DevOps admin | ☐ |
| 4 | NLP API keys for runtime | Your existing team config / chatbot setup | ☐ |
| 5 | Know the `factory-appservice-nreg-ec1` template repo is accessible | DevOps admin | ☐ |

---

## Who To Ask

The person who deployed the other app on Uptimize is your best resource. They already have:
- The Azure DevOps project set up
- The template repo connected
- Knowledge of how to request app slots

Ask them: "Can you show me how you requested your app slot and set up the pipeline? I need the same for DailyOps AI."
