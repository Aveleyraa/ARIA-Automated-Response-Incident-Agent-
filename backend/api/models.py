"""API data models."""
from typing import Optional
from pydantic import BaseModel, EmailStr


class HealthResponse(BaseModel):
    status: str
    version: str
    uptime_seconds: float


class IncidentResponse(BaseModel):
    incident_id: str
    ticket_id: str
    ticket_url: str
    priority: str
    severity_score: int = 0
    severity_factors: dict = {}
    summary: str
    root_cause_hypothesis: str
    recommended_actions: list[str]
    affected_services: list[str]
    elapsed_seconds: float
    status: str


class TicketStatusUpdate(BaseModel):
    ticket_id: str
    reporter_email: str
    resolution_summary: str
    resolved_by: str


class MetricsSummary(BaseModel):
    incidents_received: int
    triages_completed: int
    triage_errors: int
    tickets_created: int
    tickets_resolved: int
    notifications_sent: int
    guardrail_blocks: int
    avg_e2e_latency_seconds: float
    uptime_seconds: float