# ⚡ ARIA – Automated Response & Incident Agent

Solution Introduction
ARIA (Automated Response & Incident Agent) is an AI-powered SRE pipeline that automates the first-response layer of e-commerce incident management. When something breaks in production, engineering teams waste critical minutes manually reading logs, assigning priorities, creating tickets, and notifying the right people. ARIA eliminates that manual overhead by handling the entire workflow automatically — from the moment an incident is reported to the moment the team is notified and the reporter receives confirmation.
The core of ARIA is a multimodal triage agent powered by Google Gemini. What makes it unique is that before analyzing each incident, ARIA fetches real TypeScript source files directly from the Medusa.js GitHub repository — the open-source e-commerce platform used as the codebase reference. This means the AI doesn't rely on generic knowledge; it grounds its root cause hypotheses in actual production code, identifying specific service methods, file paths, and failure patterns. The agent accepts text descriptions, screenshots, and log files, and returns a structured analysis including priority level (P1–P4), a severity score from 0 to 100 with a six-factor breakdown, recommended actions, and a step-by-step runbook for the on-call engineer.
The full pipeline runs end-to-end in under 3 seconds: incident ingestion with input guardrails and prompt injection protection, AI triage with real codebase context, automatic ticket creation (Linear, Jira, or mock), team notification via email and Discord with priority color-coded embeds, and a closed-loop resolution notification back to the original reporter. Everything is fully observable through a structured JSON event log covering all pipeline stages, a real-time WebSocket log stream in the UI, and a metrics endpoint tracking latency, triage accuracy, and guardrail blocks. The entire system runs with a single docker compose up --build command with zero external dependencies required in demo mode.

---

## What is ARIA?

ARIA is an end-to-end incident management pipeline built for e-commerce operations teams.
When something breaks in production, ARIA:

1. **Ingests** the report — text, screenshots, or log files
2. **Triages** it with Gemini AI, reading real Medusa.js source code from GitHub
3. **Creates** a ticket automatically (Linear, Jira, or mock)
4. **Notifies** the on-call team via email and Discord
5. **Closes the loop** by emailing the original reporter when the ticket is resolved

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          REPORTER BROWSER                            │
│   React UI (port 3000) · Landing page · Animated pipeline timeline  │
│   WebSocket live log stream per incident                             │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ POST /incidents (multipart/form-data)
                                │ WS   /ws/logs/{incident_id}
                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      FastAPI Backend (port 8000)                     │
│                                                                      │
│  1. INGEST      Guardrails: sanitize · validate email ·              │
│                 prompt injection detection · attachment allow-list   │
│                                                                      │
│  2. CODEBASE    CodebaseClient → GitHub raw API                      │
│                 Fetches real Medusa.js v1.20.6 source files          │
│                 relevant to the affected component                   │
│                                                                      │
│  3. TRIAGE      TriageAgent → Gemini AI (multimodal)                 │
│                 Input: text + image/log + real Medusa.js code        │
│                 Output: priority · summary · root cause ·            │
│                         actions · runbook · blast radius             │
│                                                                      │
│  4. TICKET      TicketingClient                                      │
│                 Linear (GraphQL) · Jira (REST) · Mock                │
│                                                                      │
│  5. NOTIFY      NotifierClient                                       │
│                 ├─ Team:     SMTP email + Discord embed              │
│                 ├─ Slack:    Slack webhook (optional)                │
│                 └─ Reporter: SMTP confirmation email                 │
│                                                                      │
│  6. RESOLVE     POST /webhooks/ticket-resolved                       │
│                 └─ Reporter: resolution email + Discord notice       │
│                                                                      │
│  Observability: structured JSON event log · ring buffer · metrics   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## E-commerce Codebase: Medusa.js

ARIA is grounded in **[Medusa.js v1.20.6](https://github.com/medusajs/medusa/tree/v1.20.6)** — a production-grade open-source headless commerce platform used by thousands of companies worldwide. It was chosen because:

- **Medium/high complexity** — real microservice architecture with 15+ core services
- **Well-known failure patterns** — documented production issues around Bull queues, Stripe webhooks, PostgreSQL deadlocks, and Redis OOM
- **Active GitHub repo** — source files accessible via raw API for real-time context injection

When an incident is submitted, ARIA's `CodebaseClient` fetches the actual TypeScript source files from GitHub that are most relevant to the affected component:

| Component | Files fetched from Medusa.js repo |
|---|---|
| `payments` | `services/payment-provider.ts` · `services/cart.ts` |
| `orders` | `services/order.ts` · `subscribers/order.ts` |
| `checkout` | `services/cart.ts` · `api/routes/store/carts/create-cart.ts` |
| `auth` | `services/auth.ts` |
| `inventory` | `services/product-variant-inventory.ts` |
| `fulfillment` | `services/fulfillment.ts` |

Gemini receives the **real source code** alongside the incident report, enabling precise root cause hypotheses that reference actual line numbers and service methods — not just generic advice.

---

## Features

| Requirement | Implementation |
|---|---|
| **Multimodal input** | Text + image (PNG/JPEG/WebP) + log files (TXT/JSON/CSV) via Gemini multimodal API |
| **AI Triage** | Gemini AI with real Medusa.js source code context — structured JSON output |
| **E-commerce codebase** | Medusa.js v1.20.6 — real source fetched from GitHub per incident |
| **Ticketing** | Linear (GraphQL API) · Jira (REST API) · In-memory mock |
| **Email** | SMTP real send · mock mode logs to stdout |
| **Communicator** | Discord native embeds (color-coded by priority) · Slack webhooks |
| **Guardrails** | Prompt injection detection (12+ patterns) · HTML sanitization · email validation · attachment allow-list · 10MB size limit |
| **Observability** | Structured JSON events covering all stages · ring buffer · metrics endpoint · live WebSocket stream |
| **Resolution loop** | Webhook triggers reporter email + Discord notice on ticket close |
| **UI** | Landing page · Animated pipeline timeline · Live log terminal · Dashboard · Observability view |
| **Docker** | Full stack via `docker compose up --build` · no external dependencies required |

---

## Project Summary

ARIA demonstrates a production-realistic SRE automation pipeline that reduces mean time to triage (MTTT) by automating the first-response layer of incident management. The system is fully demoable with zero external dependencies in mock mode, and fully functional with real integrations via environment variables.

**Tech stack:**
- **AI**: Google Gemini (multimodal, structured JSON output)
- **Backend**: Python 3.12 · FastAPI · WebSockets
- **Frontend**: React 18 · Vite · React Router
- **E-commerce**: Medusa.js v1.20.6 (open-source, GitHub)
- **Ticketing**: Linear · Jira · Mock
- **Notifications**: Discord webhooks · Slack webhooks · SMTP email
- **Infra**: Docker Compose · Nginx

---

## Quick Start

```bash
# 1. Clone
git clone https://github.com/Aveleyraa/ARIA-Automated-Response-Incident-Agent-.git
cd sre-agent

# 2. Configure
cp .env.example .env
# Edit .env — minimum: set GEMINI_API_KEY

# 3. Run
docker compose up --build

# 4. Open
# → http://localhost:3000
```

> **No API key?** Leave `GEMINI_API_KEY` blank and ARIA runs in mock mode —
> keyword-based triage, emails logged to stdout, tickets stored in memory.
> Fully demoable without any external accounts.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | _(empty)_ | Google AI Studio key — get free at [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini model to use |
| `TICKETING_PROVIDER` | `mock` | `mock` · `linear` · `jira` |
| `MOCK_EMAIL` | `true` | `true` logs emails · `false` sends via SMTP |
| `DISCORD_WEBHOOK_URL` | _(empty)_ | Discord channel webhook URL |
| `SLACK_WEBHOOK_URL` | _(empty)_ | Slack incoming webhook URL |
| `TEAM_EMAILS` | `oncall@yourcompany.com` | Comma-separated on-call emails |

See `.env.example` for the full list with descriptions.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check |
| `POST` | `/incidents` | Submit incident (multipart form) |
| `GET` | `/incidents` | List all incidents |
| `POST` | `/webhooks/ticket-resolved` | Trigger resolution notification |
| `GET` | `/metrics` | Pipeline metrics (counters + latency) |
| `GET` | `/logs?limit=N` | Recent observability events |
| `WS` | `/ws/logs/{id}` | Live pipeline log stream |
| `GET` | `/docs` | Swagger UI (FastAPI auto-generated) |

---

## Repository Structure

```
sre-agent/
├── docker-compose.yml
├── .env.example
├── README.md
├── AGENTS_USE.md          # Agent documentation + observability evidence
├── SCALING.md             # Scaling assumptions and decisions
├── QUICKGUIDE.md          # Clone → configure → run in 4 steps
├── LICENSE                # MIT
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py            # FastAPI app + pipeline orchestration
│   ├── agents/
│   │   └── triage_agent.py        # Gemini AI triage with Medusa.js context
│   ├── integrations/
│   │   ├── ticketing.py           # Linear · Jira · Mock
│   │   └── notifier.py            # Email · Discord · Slack
│   ├── observability/
│   │   ├── logger.py              # Structured event ring buffer
│   │   └── metrics.py             # In-memory counters + latency
│   └── utils/
│       ├── guardrails.py          # Input validation + injection detection
│       └── codebase_client.py     # Medusa.js GitHub source fetcher
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx                # Layout + routing
        ├── index.css              # Design system + CSS variables
        └── pages/
            ├── Landing.jsx        # ARIA landing page with pipeline animation
            ├── SubmitIncident.jsx # Report form + animated timeline result
            ├── Dashboard.jsx      # Incident list + metrics
            ├── Observability.jsx  # Structured event log viewer
            ├── ResolveTicket.jsx  # Resolution webhook trigger
            └── TicketDetail.jsx   # Individual ticket view
```
