"""
Ticketing Integration
Supports: Linear (real), Jira (real), or In-Memory mock
Controlled by TICKETING_PROVIDER env var.
"""
import logging
import os
import time
import uuid
from dataclasses import dataclass

import httpx

logger = logging.getLogger("sre-agent.ticketing")

PRIORITY_MAP = {
    "P1": {"linear": "urgent", "jira": "Highest", "label": "🔴 P1 – Critical"},
    "P2": {"linear": "high",   "jira": "High",    "label": "🟠 P2 – High"},
    "P3": {"linear": "medium", "jira": "Medium",  "label": "🟡 P3 – Medium"},
    "P4": {"linear": "low",    "jira": "Low",     "label": "🟢 P4 – Low"},
}


@dataclass
class Ticket:
    ticket_id: str
    url: str
    title: str
    provider: str
    reporter_email: str


class TicketingClient:
    def __init__(self, obs_logger):
        self.obs_logger = obs_logger
        self.provider = os.getenv("TICKETING_PROVIDER", "mock").lower()
        # In-memory store for mock + incident listing
        self._incidents: list[dict] = []

        if self.provider == "linear":
            self.linear_api_key = os.getenv("LINEAR_API_KEY", "")
            self.linear_team_id = os.getenv("LINEAR_TEAM_ID", "")
            logger.info("Ticketing: Linear")
        elif self.provider == "jira":
            self.jira_url = os.getenv("JIRA_URL", "")
            self.jira_email = os.getenv("JIRA_EMAIL", "")
            self.jira_token = os.getenv("JIRA_API_TOKEN", "")
            self.jira_project = os.getenv("JIRA_PROJECT_KEY", "SRE")
            logger.info("Ticketing: Jira")
        else:
            logger.info("Ticketing: In-Memory Mock")

    async def create_ticket(self, incident_id: str, triage_result, reporter_email: str) -> Ticket:
        title = f"[{triage_result.priority}] Incident {incident_id}: {triage_result.summary[:80]}"

        body = self._format_body(incident_id, triage_result, reporter_email)

        if self.provider == "linear":
            ticket = await self._create_linear(incident_id, title, body, triage_result.priority, reporter_email)
        elif self.provider == "jira":
            ticket = await self._create_jira(incident_id, title, body, triage_result.priority, reporter_email)
        else:
            ticket = self._create_mock(incident_id, title, reporter_email)

        # Store for listing
        self._incidents.append({
            "incident_id": incident_id,
            "ticket_id": ticket.ticket_id,
            "ticket_url": ticket.url,
            "title": title,
            "priority": triage_result.priority,
            "reporter_email": reporter_email,
            "affected_services": triage_result.affected_services,
            "summary": triage_result.summary,
            "root_cause_hypothesis": triage_result.root_cause_hypothesis,
            "recommended_actions": triage_result.recommended_actions,
            "runbook_steps": triage_result.runbook_steps,
            "estimated_blast_radius": triage_result.estimated_blast_radius,
            "confidence": triage_result.confidence,
            "severity_score": triage_result.severity_score,
            "severity_factors": triage_result.severity_factors,
            "created_at": time.time(),
            "status": "open",
        })

        self.obs_logger.log_event("ticketing", "created", {
            "incident_id": incident_id,
            "ticket_id": ticket.ticket_id,
            "provider": self.provider,
        })
        return ticket

    def _format_body(self, incident_id: str, triage_result, reporter_email: str) -> str:
        actions = "\n".join(f"- {a}" for a in triage_result.recommended_actions)
        runbook = "\n".join(f"{i+1}. {s}" for i, s in enumerate(triage_result.runbook_steps))
        services = ", ".join(triage_result.affected_services) or "Unknown"
        code_paths = "\n".join(f"- `{p}`" for p in triage_result.relevant_code_paths)

        return f"""## 🚨 Incident Report – {incident_id}

**Priority**: {triage_result.priority}
**Reporter**: {reporter_email}
**Confidence**: {triage_result.confidence}

---

### Summary
{triage_result.summary}

### Root Cause Hypothesis
{triage_result.root_cause_hypothesis}

### Affected Services
{services}

### Blast Radius
{triage_result.estimated_blast_radius or 'Under assessment'}

---

### Recommended Immediate Actions
{actions}

### Runbook
{runbook}

### Relevant Code Paths
{code_paths or 'N/A'}

---
*Ticket auto-created by SRE Agent*"""

    async def _create_linear(self, incident_id: str, title: str, body: str, priority: str, reporter_email: str) -> Ticket:
        priority_val = {"P1": 1, "P2": 2, "P3": 3, "P4": 4}.get(priority, 3)
        query = """
        mutation CreateIssue($title: String!, $description: String!, $teamId: String!, $priority: Int!) {
          issueCreate(input: { title: $title, description: $description, teamId: $teamId, priority: $priority }) {
            success
            issue { id identifier url }
          }
        }
        """
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.linear.app/graphql",
                json={"query": query, "variables": {
                    "title": title, "description": body,
                    "teamId": self.linear_team_id, "priority": priority_val
                }},
                headers={"Authorization": self.linear_api_key, "Content-Type": "application/json"},
                timeout=15,
            )
            r.raise_for_status()
            data = r.json()
            issue = data["data"]["issueCreate"]["issue"]
            return Ticket(
                ticket_id=issue["identifier"],
                url=issue["url"],
                title=title,
                provider="linear",
                reporter_email=reporter_email,
            )

    async def _create_jira(self, incident_id: str, title: str, body: str, priority: str, reporter_email: str) -> Ticket:
        jira_priority = PRIORITY_MAP.get(priority, {}).get("jira", "Medium")
        payload = {
            "fields": {
                "project": {"key": self.jira_project},
                "summary": title,
                "description": {"version": 1, "type": "doc", "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": body}]}
                ]},
                "issuetype": {"name": "Bug"},
                "priority": {"name": jira_priority},
            }
        }
        import base64
        creds = base64.b64encode(f"{self.jira_email}:{self.jira_token}".encode()).decode()
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.jira_url}/rest/api/3/issue",
                json=payload,
                headers={"Authorization": f"Basic {creds}", "Content-Type": "application/json"},
                timeout=15,
            )
            r.raise_for_status()
            data = r.json()
            return Ticket(
                ticket_id=data["key"],
                url=f"{self.jira_url}/browse/{data['key']}",
                title=title,
                provider="jira",
                reporter_email=reporter_email,
            )

    def _create_mock(self, incident_id: str, title: str, reporter_email: str) -> Ticket:
        ticket_id = f"MOCK-{incident_id}"
        return Ticket(
            ticket_id=ticket_id,
            url=f"http://localhost:3000/tickets/{ticket_id}",
            title=title,
            provider="mock",
            reporter_email=reporter_email,
        )

    def list_incidents(self) -> list[dict]:
        return sorted(self._incidents, key=lambda x: x["created_at"], reverse=True)