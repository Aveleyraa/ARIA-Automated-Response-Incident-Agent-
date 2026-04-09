# Scaling

## Current Architecture: Single Instance, In-Memory State

ARIA v1 is intentionally designed for simplicity and demo-ability. All state lives in memory within the FastAPI process — the observability ring buffer, metrics counters, and incident list are Python objects that reset on restart. This is a conscious trade-off: zero external dependencies, one `docker compose up --build` and everything works.

The architecture is stateless at the request level — every HTTP request is self-contained. Only the two collector objects (`ObservabilityLogger`, `MetricsCollector`) and the ticketing client's incident list hold state. Swapping these for persistent backends requires no changes to the pipeline logic.

---

## Scaling Path

### Stage 1 — Persistent State (0 → ~500 incidents/day)

Replace in-memory objects with persistent storage without touching any pipeline logic:

```
ObservabilityLogger (ring buffer)  →  PostgreSQL events table
MetricsCollector (counters)        →  Redis counters (INCR/INCRBY)
TicketingClient._incidents (list)  →  PostgreSQL incidents table
```

The FastAPI app already runs with Uvicorn workers, so horizontal scaling is possible as soon as state is externalized. Add a `DATABASE_URL` env var and swap the two collector constructors — nothing else changes.

For the `CodebaseClient`, GitHub source files are fetched on every triage request. At higher volumes this becomes a bottleneck and an unnecessary repeated network call. The fix is a simple TTL cache (Redis or in-memory `functools.lru_cache`) per file path — Medusa.js source files change infrequently so a 24-hour TTL is safe.

### Stage 2 — Async Queue (500 → 10,000 incidents/day)

The dominant latency in the pipeline is the Gemini API call (~2–4s) and the GitHub fetch (~0.3–0.8s). At higher volumes, blocking the HTTP request for both is wasteful.

```
POST /incidents (sync, returns 202 immediately)
        │
        └─► Enqueue job → Celery + Redis broker
                │
                ├─► Worker 1: CodebaseClient.fetch()
                ├─► Worker 2: TriageAgent.triage()
                ├─► Worker 3: TicketingClient.create_ticket()
                └─► Worker 4: NotifierClient.notify_team()

Reporter polls GET /incidents/{id}/status
or receives WebSocket push when job completes
```

The WebSocket infrastructure is already in place — the WS endpoint per incident just needs to be fed from the queue worker instead of the HTTP handler.

### Stage 3 — Horizontal Scale (10,000+ incidents/day)

Multiple FastAPI replicas behind a load balancer. The WebSocket connection per incident needs sticky sessions or a Redis Pub/Sub relay so any replica can push to any connected browser.

The triage worker pool scales independently of the API tier — during an incident storm you scale workers up, not the API servers.

Gemini API rate limits become relevant here. The free tier allows 15 RPM. At higher volumes:
- Implement a token bucket rate limiter in front of `TriageAgent.triage()`
- Use Gemini `gemini-2.0-flash-lite` for P3/P4 incidents (cheaper, faster)
- Reserve `gemini-2.0-flash` or higher models for P1/P2 (more accurate, worth the cost)

### Stage 4 — Enterprise (multi-tenant, SLA guarantees)

- **Tenant isolation**: separate queues, DB schemas, and notification channels per customer
- **SLA tiers**: P1 incidents bypass the queue and go to a dedicated high-priority worker
- **Codebase context**: extend `CodebaseClient` to support customer-specific private repos via GitHub App auth — each tenant gets triage grounded in their own codebase, not just Medusa.js
- **Observability**: export events to Datadog / Grafana / OpenTelemetry collector instead of in-memory ring buffer
- **Audit log**: immutable append-only event store for compliance

---

## Assumptions

**1. Triage latency is acceptable as async for non-P1**
A 2–4s response is fine for P2/P3/P4. P1 incidents can get a synchronous fast path with a timeout fallback to mock triage if Gemini takes too long.

**2. GitHub raw API is stable and public**
`CodebaseClient` fetches from `raw.githubusercontent.com` with no auth. This works for public repos. For private e-commerce codebases in production, the fetch would use a GitHub App token stored as an env var.

**3. In-memory state is acceptable for hackathon scope**
The evaluator can demo the full pipeline including observability, metrics, and ticket history within a single session. Data loss on restart is a known and accepted limitation of v1.

**4. Single Gemini model for all incidents**
`gemini-2.0-flash` handles all priorities in v1. At scale, a model routing layer (fast/cheap for P3/P4, accurate for P1/P2) reduces cost by ~60% with minimal quality trade-off.

**5. Mock ticketing is production-equivalent behavior**
The `TicketingClient` interface is identical whether using mock, Linear, or Jira. Switching providers is a one-line env var change — the pipeline, observability, and notifications are unaffected.

**6. Email at low volume is fine synchronous**
SMTP sends are blocking in v1. At >1,000 emails/day, replace with SendGrid or Mailgun async API calls. The `NotifierClient._send_email()` method is the only thing that changes.

---

## Cost Estimates (Gemini API)

Each triage call sends approximately:
- ~1,500 tokens in (system prompt + incident + codebase context)
- ~400 tokens out (structured JSON response)

| Volume | Model | Estimated Daily Cost |
|---|---|---|
| 100 incidents/day | gemini-2.0-flash | ~$0.10–0.30 |
| 1,000 incidents/day | gemini-2.0-flash | ~$1–3 |
| 1,000 incidents/day | flash for P3/P4 + pro for P1/P2 | ~$0.50–1.50 |
| 10,000 incidents/day | Tiered routing | ~$5–15 |

Gemini free tier (Google AI Studio): 1,500 requests/day, 1M tokens/minute — sufficient for development and demo purposes.

---

## Infrastructure Diagram (Target Production)

```
                         ┌─────────────────┐
                         │   Load Balancer  │
                         └────────┬────────┘
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
             ┌──────────┐  ┌──────────┐  ┌──────────┐
             │ FastAPI  │  │ FastAPI  │  │ FastAPI  │  ← API replicas
             │ replica 1│  │ replica 2│  │ replica 3│
             └────┬─────┘  └────┬─────┘  └────┬─────┘
                  └─────────────┼──────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
             ┌──────────┐ ┌─────────┐ ┌─────────────┐
             │  Redis   │ │ Celery  │ │ PostgreSQL  │
             │ (broker  │ │ workers │ │ (events +   │
             │ +cache)  │ │ (triage)│ │  incidents) │
             └──────────┘ └────┬────┘ └─────────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
             ┌──────────┐ ┌────────┐ ┌────────┐
             │  Gemini  │ │GitHub  │ │Discord │
             │    AI    │ │raw API │ │/Slack  │
             └──────────┘ └────────┘ └────────┘
```