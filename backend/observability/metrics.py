"""Simple in-memory metrics collector."""
import time
from collections import defaultdict


class MetricsCollector:
    def __init__(self):
        self._start = time.time()
        self._counters: dict[str, int] = defaultdict(int)
        self._latencies: dict[str, list[float]] = defaultdict(list)

    def inc(self, key: str, amount: int = 1) -> None:
        self._counters[key] += amount

    def record_latency(self, key: str, seconds: float) -> None:
        self._latencies[key].append(seconds)
        # Keep last 1000 measurements
        if len(self._latencies[key]) > 1000:
            self._latencies[key] = self._latencies[key][-1000:]

    def uptime(self) -> float:
        return round(time.time() - self._start, 2)

    def summary(self) -> dict:
        e2e = self._latencies.get("e2e_pipeline", [])
        avg_latency = round(sum(e2e) / len(e2e), 2) if e2e else 0.0
        return {
            "incidents_received": self._counters.get("incidents_received", 0),
            "triages_completed": self._counters.get("triages_completed", 0),
            "triage_errors": self._counters.get("triage_errors", 0),
            "tickets_created": self._counters.get("tickets_created", 0),
            "tickets_resolved": self._counters.get("tickets_resolved", 0),
            "notifications_sent": self._counters.get("notifications_sent", 0),
            "guardrail_blocks": self._counters.get("guardrail_blocks", 0),
            "avg_e2e_latency_seconds": avg_latency,
            "uptime_seconds": self.uptime(),
        }