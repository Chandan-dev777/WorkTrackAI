# Step-by-Step Deployment Walkthrough

Follow these steps in order. Each step must succeed before moving to the next.

---

## Step 1: Verify the App Works Locally in Docker

**Goal:** Make sure the Docker image builds and runs correctly on your machine.

```bash
cd dailyops-ai

# Build the Docker image
docker build -t dailyops-ai .

# Run it with your local .env
docker run -p 8080:8080 --env-file .env dailyops-ai

# Open http://localhost:8080 in your browser
# → You should see the login page
# → Try logging in, submitting an update, etc.
```

**If this fails:** Fix the issue before proceeding. Common problems:
- Missing `requirements.txt` at repo root
- `npm run build` failing → run `cd frontend-react && npm install` locally first
- Python import errors → check all `backend/` files are committed

**Time:** ~5 minutes for first build, ~30 seconds for subsequent builds.

---

## Step 2: Request Uptimize App Slot ✅ DONE

**AppDestinationId:** `app-4bf3rraulo4umzs8`

---

## Step 3: Update the Pipeline YAML ✅ DONE

`azure-pipelines.yml` already contains the real App ID:

```yaml
AppDestinationId: "app-4bf3rraulo4umzs8"
```

---

## Step 4: Set Up Azure DevOps Pipeline

**Goal:** Connect the pipeline to the Azure DevOps Git repo so it builds automatically on push.

**Repo:** `https://dev.azure.com/Uptimize/factory-appservice-apps-p-nreg-ec1/_git/dailyops-ai-app-4bf3rraulo4umzs8`
**App URL:** `https://dailyops-ai.apps.p.uptimize.merckgroup.com/`

1. Go to `https://dev.azure.com/Uptimize/factory-appservice-apps-p-nreg-ec1`
2. Click **Pipelines** in the left sidebar
3. Click **New Pipeline**
4. Choose **Azure Repos Git** as the code source
5. Select `dailyops-ai-app-4bf3rraulo4umzs8`
6. Azure DevOps will find `azure-pipelines.yml` in your repo
7. Review and click **Run**

**First run:** It will build the Docker image and push to ECR. This takes ~5-10 minutes.

---

## Step 5: Configure Environment Variables on Uptimize

**Goal:** Give your running app the API keys it needs.

In the Uptimize app console for your app:

1. Go to Configuration / Environment section
2. Add these variables:

| Key | Value |
|-----|-------|
| `AWS_BEDROCK_KEY` | (your real key) |
| `APP_SERVICE_NLP_API_KEY` | (your real key) |
| `SECRET_KEY` | (run `openssl rand -hex 32` to generate) |
| `DATABASE_URL` | `sqlite:///./data/dailyops.db` |
| `CHROMA_PATH` | `./data/chroma` |

3. Save and trigger a restart/redeploy

---

## Step 6: Verify the Deployment

**Goal:** Confirm the app works on the real URL.

1. Open your app URL (e.g., `https://dailyops-ai-dev.app.uptimize.merckgroup.com`)
2. You should see the login page
3. Since the database is empty, seed it:
   - Register an admin account, OR
   - If you added a startup seed script, it runs automatically

**To seed data on the deployed app:**

Option A — Call the seed endpoint (if you have an admin account):
```bash
curl -X POST https://your-app-url/admin/seed-dummy-data \
  -H "Authorization: Bearer <admin-jwt-token>"
```

Option B — Add auto-seed on first startup (add to `backend/main.py` startup event):
```python
@app.on_event("startup")
async def seed_if_empty():
    # Only seeds if no users exist
    ...
```

---

## Step 7: Share with Team

**Goal:** Give your 20 team members access.

1. Share the URL with the team
2. They can register accounts via the register page, OR
3. You seed the demo accounts and share the credentials from `docs/TEST_CREDENTIALS.md`

Since this is on the internal Uptimize platform, anyone on the Merck network should be able to access the URL (no additional auth needed at the network level).

---

## Summary Timeline

| Step | Duration | Blocker? |
|------|----------|----------|
| 1. Test Docker locally | 10 minutes | No |
| 2. Request App Slot | 1-2 days (if ticket) | Yes — need ID before step 3 |
| 3. Update pipeline YAML | 2 minutes | No |
| 4. Set up Azure DevOps | 15 minutes | Need project access |
| 5. Configure env vars | 5 minutes | Need platform access |
| 6. Verify deployment | 5 minutes | No |
| 7. Share with team | 5 minutes | No |

**Total active work:** ~45 minutes (excluding wait for app slot approval).

---

## What Happens After?

Every time you push to `main`:
1. Pipeline auto-builds a new image
2. Pushes to ECR
3. Uptimize picks up the new image
4. App restarts with your latest code

No manual intervention needed. Just `git push` and wait ~5 minutes.

---

## Important Caveats for Internal Testing

| Issue | Impact | Workaround |
|-------|--------|-----------|
| SQLite resets on redeploy | All data lost when container restarts | Re-seed after each deploy, or add auto-seed on startup |
| Single container | If it crashes, app is down until restart | Fine for 20 users in testing |
| No backup | Database lives only inside the container | Export data before redeploying if needed |
| No custom domain | URL is whatever Uptimize assigns | Fine for internal testing |

These are all acceptable for a 20-person internal test. Address them before going to production.
