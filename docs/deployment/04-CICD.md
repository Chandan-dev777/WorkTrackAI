# Understanding the CI/CD Pipeline

CI/CD stands for **Continuous Integration / Continuous Deployment**. It means: every time you push code, a robot automatically builds and deploys it for you.

---

## What is Azure DevOps Pipelines?

It's Microsoft's automation tool. You write a YAML file (`azure-pipelines.yml`) that describes what to do, and Azure DevOps executes it on a fresh Linux machine every time you push.

Think of it as: "When I push code, run these shell commands for me on a server."

---

## Our Pipeline Explained

### The Header

```yaml
trigger:
  branches:
    include:
      - main
```
**What:** Only run this pipeline when code is pushed to the `main` branch.
**Why:** You don't want every feature branch push to deploy. Only `main` = ready to deploy.

---

```yaml
pool:
  vmImage: "ubuntu-22.04"
```
**What:** Use an Ubuntu 22.04 machine to run the build.
**Why:** That's where Docker runs. Azure DevOps spins up a fresh VM for each build.

---

```yaml
resources:
  repositories:
    - repository: templates
      name: "factory-appservice-nreg-ec1/factory-appservice-nreg-ec1"
      type: git
      ref: refs/heads/master
```
**What:** Pull in shared pipeline templates from another repo.
**Why:** The platform team has pre-built templates that handle AWS login, Docker registry login, etc. You don't need to write that yourself.

---

### The Build Steps

```yaml
- template: pipeline-templates/aws-login.yml@templates
  parameters:
    AppDestinationId: "YOUR-APP-DESTINATION-ID-HERE"
```
**What:** Log into AWS using the platform's service account.
**Why:** You need AWS credentials to push to ECR. This template handles it — you just provide your App ID.

**This is where you put your `AppDestinationId`** (from the Uptimize app slot request).

---

```yaml
- template: pipeline-templates/docker-login.yml@templates
```
**What:** Log into the Docker registry (ECR).
**Why:** So the `docker push` command later knows where to send the image.

---

```yaml
- bash: |
    docker build \
      --pull \
      --cache-from $(AWS_ACCOUNT_ID).dkr.ecr.eu-central-1.amazonaws.com/$(APP_ID):main \
      -t $(AWS_ACCOUNT_ID).dkr.ecr.eu-central-1.amazonaws.com/$(APP_ID):main \
      -t docker-image:snapshot \
      .
  displayName: "Build Docker Image"
```
**What:** Build the Docker image from your Dockerfile.
**Why:** This creates the "box" containing your app. The `--cache-from` flag speeds up builds by reusing layers from the previous build.

The variables like `$(AWS_ACCOUNT_ID)` and `$(APP_ID)` are automatically set by the template steps above.

---

```yaml
- bash: |
    docker tag docker-image:snapshot $(AWS_ACCOUNT_ID).dkr.ecr.eu-central-1.amazonaws.com/$(APP_DESTINATION_ID):main
    docker push $(AWS_ACCOUNT_ID).dkr.ecr.eu-central-1.amazonaws.com/$(APP_DESTINATION_ID):main
  displayName: "Push to ECR"
  condition: and(succeeded(), eq(variables.isMain, 'true'))
```
**What:** Tag the image with the ECR URL and push it.
**Why:** This uploads your built image to Amazon's container registry. Uptimize then pulls it from there. The `condition` ensures this only happens on the `main` branch (not feature branches).

---

## Multi-Environment (Dev → QA → Prod)

The reference pipeline has 3 stages with manual approval gates:

```
Dev (auto-deploy on push)
  → Manual approval → QA
  → Manual approval → Prod
```

**For your internal testing (20 members), you only need the Dev stage.** The pipeline I created has just that one stage. You can add QA/Prod stages later when going to production.

---

## How to Set Up the Pipeline

1. Go to Azure DevOps → your project
2. Click **Pipelines** → **New Pipeline**
3. Select **GitHub** as the source
4. Select your repo (`Chandan-dev777/WorkTrackAI`)
5. It will detect `azure-pipelines.yml` in your repo
6. Click **Run** to trigger the first build

---

## Pipeline Variables

Some values shouldn't be in your YAML file (they're secrets or environment-specific). Set these in Azure DevOps:

**Pipelines → Your Pipeline → Edit → Variables**

For now, you probably don't need to add any — the templates handle AWS auth. But if needed later:

| Variable | Purpose | Secret? |
|----------|---------|---------|
| `AWS_BEDROCK_KEY` | Only if injecting at build time (don't — use Uptimize config instead) | Yes |

---

## Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| "Template not found" | Can't access the `factory-appservice-nreg-ec1` repo | Ask DevOps admin to grant your project access to that repo |
| "docker push denied" | Wrong `AppDestinationId` or no ECR permissions | Verify the App ID matches what Uptimize gave you |
| Build times out | Image too large or npm install slow | Add a `.dockerignore` file to exclude unnecessary files |
| Pipeline doesn't trigger | Trigger not set to `main`, or service connection missing | Check the YAML trigger and GitHub service connection |
