"""
SRE Agent - Main FastAPI Application
E-commerce Incident Management with AI Triage
"""
import asyncio
import base64
import logging
import time
import uuid
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from agents.triage_agent import TriageAgent
from integrations.ticketing import TicketingClient
from integrations.notifier import NotifierClient
from observability.logger import ObservabilityLogger
from observability.metrics import MetricsCollector
from api.models import (TicketStatusUpdate, HealthResponse,
    IncidentResponse, MetricsSummary
)

# ── Logging Setup ────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s – %(message)s")
logger = logging.getLogger("sre-agent")

# ── Global State ─────────────────────────────────────────────────────────────
obs_logger = ObservabilityLogger()
metrics = MetricsCollector()
triage_agent = TriageAgent(obs_logger, metrics)
ticketing = TicketingClient(obs_logger)
notifier = NotifierClient(obs_logger)

# WebSocket connections for live log streaming
active_connections: dict[str, WebSocket] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("SRE Agent starting up…")
    obs_logger.log_event("system", "startup", {"version": "1.0.0"})
    yield
    logger.info("SRE Agent shutting down…")
    obs_logger.log_event("system", "shutdown", {})


app = FastAPI(
    title="SRE Agent – E-commerce Incident Management",
    description="AI-powered incident triage, ticketing, and notification system",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── WebSocket for live logs ──────────────────────────────────────────────────
@app.websocket("/ws/logs/{incident_id}")
async def websocket_logs(websocket: WebSocket, incident_id: str):
    await websocket.accept()
    active_connections[incident_id] = websocket
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        active_connections.pop(incident_id, None)


async def stream_log(incident_id: str, stage: str, message: str, level: str = "info"):
    """Push a log entry to the WebSocket client if connected."""
    ws = active_connections.get(incident_id)
    if ws:
        try:
            await ws.send_json({"stage": stage, "message": message, "level": level, "ts": time.time()})
        except Exception:
            active_connections.pop(incident_id, None)


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok", version="1.0.0", uptime_seconds=metrics.uptime())


# ── Submit Incident ───────────────────────────────────────────────────────────
@app.post("/incidents", response_model=IncidentResponse)
async def submit_incident(
    title: str = Form(...),
    description: str = Form(...),
    reporter_email: str = Form(...),
    severity: str = Form("medium"),
    affected_component: str = Form("unknown"),
    attachment: Optional[UploadFile] = File(None),
):
    incident_id = str(uuid.uuid4())[:8].upper()
    start_ts = time.time()

    obs_logger.log_event("ingest", "received", {
        "incident_id": incident_id,
        "reporter": reporter_email,
        "severity": severity,
        "has_attachment": attachment is not None,
    })
    metrics.inc("incidents_received")

    # ── Input Guardrails ──────────────────────────────────────────────────────
    from utils.guardrails import sanitize_input, validate_email, check_injection
    title = sanitize_input(title, max_len=200)
    description = sanitize_input(description, max_len=5000)

    if not validate_email(reporter_email):
        raise HTTPException(status_code=400, detail="Invalid reporter email address.")

    injection_risk = check_injection(title + " " + description)
    if injection_risk:
        obs_logger.log_event("guardrail", "injection_blocked", {"incident_id": incident_id})
        metrics.inc("guardrail_blocks")
        raise HTTPException(status_code=400, detail="Input contains potentially unsafe content.")

    await stream_log(incident_id, "ingest", "✅ Incident received and validated")

    # ── Process Attachment ────────────────────────────────────────────────────
    attachment_data = None
    attachment_type = None
    if attachment:
        raw = await attachment.read()
        # Limit attachment size to 10 MB
        if len(raw) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Attachment too large (max 10 MB).")
        attachment_data = base64.b64encode(raw).decode()
        attachment_type = attachment.content_type
        obs_logger.log_event("ingest", "attachment_processed", {
            "incident_id": incident_id,
            "type": attachment_type,
            "size_bytes": len(raw),
        })
        await stream_log(incident_id, "ingest", f"📎 Attachment processed: {attachment.filename} ({attachment_type})")

    # ── AI Triage ─────────────────────────────────────────────────────────────
    await stream_log(incident_id, "triage", "🤖 Running AI triage…")
    try:
        triage_result = await triage_agent.triage(
            incident_id=incident_id,
            title=title,
            description=description,
            severity=severity,
            affected_component=affected_component,
            reporter_email=reporter_email,
            attachment_data=attachment_data,
            attachment_type=attachment_type,
        )
        metrics.inc("triages_completed")
        await stream_log(incident_id, "triage", f"✅ Triage complete – priority: {triage_result.priority}")
    except Exception as e:
        logger.error(f"Triage failed: {e}")
        obs_logger.log_event("triage", "error", {"incident_id": incident_id, "error": str(e)})
        metrics.inc("triage_errors")
        raise HTTPException(status_code=500, detail=f"Triage failed: {e}")

    # ── Create Ticket ─────────────────────────────────────────────────────────
    await stream_log(incident_id, "ticketing", "🎫 Creating ticket…")
    try:
        ticket = await ticketing.create_ticket(incident_id, triage_result, reporter_email)
        metrics.inc("tickets_created")
        await stream_log(incident_id, "ticketing", f"✅ Ticket created: {ticket.ticket_id}")
    except Exception as e:
        logger.error(f"Ticket creation failed: {e}")
        obs_logger.log_event("ticketing", "error", {"incident_id": incident_id, "error": str(e)})
        raise HTTPException(status_code=500, detail=f"Ticket creation failed: {e}")

    # ── Notify Team ───────────────────────────────────────────────────────────
    await stream_log(incident_id, "notify", "📣 Notifying engineering team…")
    try:
        await notifier.notify_team(ticket, triage_result)
        await notifier.notify_reporter(reporter_email, ticket, triage_result)
        metrics.inc("notifications_sent")
        await stream_log(incident_id, "notify", "✅ Team and reporter notified")
    except Exception as e:
        logger.warning(f"Notification failed (non-fatal): {e}")
        obs_logger.log_event("notify", "warning", {"incident_id": incident_id, "error": str(e)})

    elapsed = round(time.time() - start_ts, 2)
    obs_logger.log_event("pipeline", "complete", {
        "incident_id": incident_id,
        "ticket_id": ticket.ticket_id,
        "elapsed_seconds": elapsed,
    })
    metrics.record_latency("e2e_pipeline", elapsed)

    await stream_log(incident_id, "complete", f"🏁 Pipeline complete in {elapsed}s")

    return IncidentResponse(
        incident_id=incident_id,
        ticket_id=ticket.ticket_id,
        ticket_url=ticket.url,
        priority=triage_result.priority,
        severity_score=triage_result.severity_score,
        severity_factors=triage_result.severity_factors,
        summary=triage_result.summary,
        root_cause_hypothesis=triage_result.root_cause_hypothesis,
        recommended_actions=triage_result.recommended_actions,
        affected_services=triage_result.affected_services,
        elapsed_seconds=elapsed,
        status="created",
    )


# ── Ticket Webhook (resolve notification) ────────────────────────────────────
@app.post("/webhooks/ticket-resolved")
async def ticket_resolved(update: TicketStatusUpdate):
    """Called by the ticketing system when a ticket is resolved."""
    obs_logger.log_event("webhook", "ticket_resolved", {
        "ticket_id": update.ticket_id,
        "resolved_by": update.resolved_by,
    })
    metrics.inc("tickets_resolved")

    try:
        await notifier.notify_reporter_resolved(
            reporter_email=update.reporter_email,
            ticket_id=update.ticket_id,
            resolution_summary=update.resolution_summary,
            resolved_by=update.resolved_by,
        )
        return {"status": "ok", "message": "Reporter notified of resolution."}
    except Exception as e:
        logger.error(f"Resolution notification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Metrics Endpoint ──────────────────────────────────────────────────────────
@app.get("/metrics", response_model=MetricsSummary)
async def get_metrics():
    return MetricsSummary(**metrics.summary())


# ── Observability Logs ────────────────────────────────────────────────────────
@app.get("/logs")
async def get_logs(limit: int = 100):
    return {"logs": obs_logger.recent(limit)}


# ── List Incidents ────────────────────────────────────────────────────────────
@app.get("/incidents")
async def list_incidents():
    return {"incidents": ticketing.list_incidents()}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)