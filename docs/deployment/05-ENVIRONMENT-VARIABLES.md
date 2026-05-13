# Environment Variables — Configuring Secrets

## The Golden Rule

**Never put real API keys in your Docker image or Git repo.**

Instead, set them as environment variables in the Uptimize app configuration. The platform injects them into your container at runtime.

---

## How Environment Variables Work in Containers

```
Your Dockerfile has:    COPY .env.example .env     ← just defaults/placeholders
Uptimize injects:       AWS_BEDROCK_KEY=real-key   ← real secrets at runtime
Your app reads:         os.environ["AWS_BEDROCK_KEY"]  ← gets the real value
```

Environment variables set by the platform **override** what's in the `.env` file inside the container.

---

## Variables to Configure on Uptimize

Set these in your Uptimize app configuration (usually: App Console → Configuration → Environment Variables):

### Required

| Variable | Value | Purpose |
|----------|-------|---------|
| `AWS_BEDROCK_KEY` | Your Bedrock API key | Authenticates calls to Claude models |
| `APP_SERVICE_NLP_API_KEY` | Your NLP API key | Authenticates calls to GPT models |
| `SECRET_KEY` | A random string (64+ chars) | Signs JWT tokens for user authentication |
| `DATABASE_URL` | `sqlite:///./data/worktrack.db` | Where SQLite stores data |
| `CHROMA_PATH` | `./data/chroma` | Where ChromaDB stores vectors |

### Optional (have sensible defaults)

| Variable | Default | Purpose |
|----------|---------|---------|
| `LLM_PROVIDER` | `azure` | Which LLM backend to use |
| `LLM_MODEL` | `Claude Sonnet 4.6` | Default model for extraction |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `480` | How long login sessions last (8 hours) |
| `NLP_ENDPOINT` | `https://api.nlp.p.uptimize.merckgroup.com` | GPT endpoint URL |
| `BEDROCK_ENDPOINT` | `https://api.nlp.p.uptimize.merckgroup.com/model` | Claude endpoint URL |

---

## Where to Get the Keys

| Key | Source |
|-----|--------|
| `AWS_BEDROCK_KEY` | Same key used in the existing chatbot (`chatbot/chatbot.py`). Ask your team lead or check the chatbot's environment config. |
| `APP_SERVICE_NLP_API_KEY` | Same as above — it's the NLP platform API key. |
| `SECRET_KEY` | Generate one yourself: `openssl rand -hex 32` or `python -c "import secrets; print(secrets.token_hex(32))"` |

---

## How to Set Them on Uptimize

This varies by how your Uptimize app is configured, but typically:

1. Log into the Uptimize console
2. Find your app (`worktrack-ai`)
3. Go to **Configuration** or **Environment** tab
4. Add each variable as a key-value pair
5. Mark sensitive ones (API keys) as **Secret** so they're not visible in logs
6. Save and restart the app

Ask the person who deployed the other app: "Where do I set environment variables for my Uptimize app?"

---

## Testing Locally (Simulating Production)

To test with the same setup as production:

```bash
# Create a .env file with real keys (never commit this!)
cp .env.example .env
# Edit .env with real values

# Run Docker with that env file
docker run -p 8080:8080 --env-file .env worktrack-ai
```

---

## Security Checklist

- [ ] `.env` is in `.gitignore` (it is)
- [ ] No real keys in the Dockerfile
- [ ] No real keys committed to Git (check: `git log -p | grep -i "key\|secret\|password"`)
- [ ] API keys marked as "Secret" in Uptimize config
- [ ] `SECRET_KEY` is unique per environment (don't reuse your local one)
