# Quick Guide

## Run in 4 steps

```bash
# 1. Clone
git clone https://github.com/yourorg/sre-agent
cd sre-agent

# 2. Copy env
cp .env.example .env

# 3. Fill your keys (minimum: GEMINI_API_KEY)
nano .env

# 4. Build and run
docker compose up --build
```

**Open** → http://localhost:3000

---

## Step 3 in detail — what to fill in `.env`

Open `.env` with any editor and set these values.
**Important:** no quotes, no spaces around `=`

```bash
# ✅ Correct
GEMINI_API_KEY=AIzaSyABC123...

# ❌ Wrong — Docker reads the quotes as part of the value
GEMINI_API_KEY="AIzaSyABC123..."
```

### Minimum required

```bash
GEMINI_API_KEY=AIzaSy...          # get free at https://aistudio.google.com/app/apikey
GEMINI_MODEL=gemini-2.0-flash     # or gemini-2.0-flash-lite
```

### Optional — Discord alerts

```bash
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

To get a Discord webhook:
1. Open your server → right-click channel → **Edit Channel**
2. **Integrations** → **Webhooks** → **New Webhook**
3. Copy the URL and paste it here

### Optional — Real ticketing

```bash
# Linear
TICKETING_PROVIDER=linear
LINEAR_API_KEY=lin_api_...
LINEAR_TEAM_ID=your-team-uuid

# Jira
TICKETING_PROVIDER=jira
JIRA_URL=https://yourorg.atlassian.net
JIRA_EMAIL=you@yourorg.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=SRE
```

### Optional — Real email

```bash
MOCK_EMAIL=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password    # Gmail: use an App Password, not your account password
FROM_EMAIL=aria@yourcompany.com
TEAM_EMAILS=oncall@yourcompany.com,lead@yourcompany.com
```

---

## Demo without any API keys (mock mode)

Everything works out of the box with an empty `GEMINI_API_KEY`.
ARIA falls back to keyword-based triage automatically:

```bash
# .env with no keys needed
TICKETING_PROVIDER=mock
MOCK_EMAIL=true
```

```bash
docker compose up --build
```

In mock mode:
- Triage runs keyword-based (checkout/payments/orders/search patterns)
- Emails are logged to stdout — check with `docker compose logs -f backend`
- Tickets stored in memory — visible at http://localhost:3000/dashboard
- Discord skipped if `DISCORD_WEBHOOK_URL` is empty

---

## OpenRouter support

If you prefer to use OpenRouter instead of Google AI Studio (useful for
accessing other models like `mistral`, `llama-3`, or `gpt-4o`):

**1. Create an account at https://openrouter.ai and get your API key**

**2. In `.env`, set:**
```bash
GEMINI_API_KEY=sk-or-v1-...your-openrouter-key...
GEMINI_MODEL=google/gemini-2.0-flash-lite-001
```

**3. In `backend/agents/triage_agent.py`, update the client initialization:**

```python
# Find this block (~line 45):
genai.configure(api_key=api_key)
self.model = genai.GenerativeModel(
    model_name=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
    system_instruction=SYSTEM_PROMPT,
)

# Replace with OpenRouter via httpx (add to imports: import httpx, json):
self._openrouter_key = api_key
self._openrouter_model = os.getenv("GEMINI_MODEL", "google/gemini-2.0-flash-lite-001")
```

And replace the `generate_content` call in `triage()`:

```python
# Replace self.model.generate_content(parts) with:
async with httpx.AsyncClient() as client:
    r = await client.post(
        "https://openrouter.ai/api/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {self._openrouter_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": self._openrouter_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": "\n\n".join(
                    p if isinstance(p, str) else "[image attached]"
                    for p in parts
                )},
            ],
        },
        timeout=30,
    )
    r.raise_for_status()
    raw = r.json()["choices"][0]["message"]["content"].strip()
```

OpenRouter-compatible models that work well for structured JSON triage:

| Model | OpenRouter ID | Notes |
|---|---|---|
| Gemini 2.0 Flash | `google/gemini-2.0-flash-lite-001` | Best for this use case |
| GPT-4o Mini | `openai/gpt-4o-mini` | Good JSON reliability |
| Llama 3.1 70B | `meta-llama/llama-3.1-70b-instruct` | Free tier available |
| Mistral 7B | `mistralai/mistral-7b-instruct` | Fastest, free |

---

## Test the full flow

### 1. Submit an incident

Go to http://localhost:3000 → click **Launch ARIA →**

Fill the form:
- **Title**: `Orders stuck in pending – Bull queue stalled after deploy`
- **Email**: `your@email.com`
- **Severity**: High
- **Component**: `orders`
- **Description**: `After deploy at 01:00 UTC all new orders stay in pending. Bull queue stalled. Customers not receiving confirmation emails.`
- **Attachment**: upload a `.txt` log file (see example below)

Watch the animated pipeline timeline light up stage by stage in real time.

### 2. Example log file to attach

Save as `test-incident.txt`:

```
[2026-04-09 01:03:52] WARN  BullError: Missing lock for job process-order#4821
[2026-04-09 01:04:21] WARN  BullError: Missing lock for job process-order#4822
[2026-04-09 01:05:00] ERROR subscribers/order.ts: Handler order.placed timeout after 30000ms
[2026-04-09 01:06:33] WARN  Bull queue: 47 jobs in stalled state
[2026-04-09 01:06:33] ERROR QueryFailedError: deadlock detected
[2026-04-09 01:08:01] ERROR ENOMEM Redis is running out of memory (used: 498MB / max: 512MB)
[2026-04-09 01:09:01] ERROR OrderService.updateStatus: Connection terminated unexpectedly
```

### 3. View the triage result

After ~2–4s (or ~0.5s in mock mode) you will see:
- Priority badge (P1–P4)
- AI summary and root cause hypothesis
- Recommended actions with runbook steps
- Affected services
- Ticket ID with link to detail page

### 4. Check Discord

If `DISCORD_WEBHOOK_URL` is set, a color-coded embed arrives in your channel
with full triage details. A green resolution notice follows when the ticket is closed.

### 5. Resolve the ticket

Go to http://localhost:3000/resolve → select the open incident →
fill in the resolution summary → click **Mark as Resolved**.

The reporter receives an email (or stdout log in mock mode) and Discord gets a
green ✅ resolution embed.

### 6. Explore observability

Go to http://localhost:3000/observability to see the full structured event log
covering all pipeline stages, or hit the API directly:

```bash
# All events
curl http://localhost:8000/logs?limit=50

# Metrics
curl http://localhost:8000/metrics

# All incidents
curl http://localhost:8000/incidents

# Health
curl http://localhost:8000/health
```

---

## Useful commands

```bash
# Start in background
docker compose up -d

# Watch all logs
docker compose logs -f

# Watch backend only
docker compose logs -f backend

# Verify env vars are loaded
docker compose exec backend printenv | grep GEMINI

# Restart without rebuild (after changing env vars)
docker compose down && docker compose up --force-recreate

# Rebuild after code changes
docker compose down && docker compose up --build

# Stop everything
docker compose down

# Full cleanup (removes images too)
docker compose down --rmi all
```

---

## Ports

| Service | Port | URL |
|---|---|---|
| Frontend (React + Nginx) | 3000 | http://localhost:3000 |
| Backend (FastAPI) | 8000 | http://localhost:8000 |
| Swagger UI | 8000 | http://localhost:8000/docs |
| ReDoc | 8000 | http://localhost:8000/redoc |