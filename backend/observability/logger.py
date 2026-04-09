"""Structured observability logger for all pipeline stages."""
import json
import logging
import time
from collections import deque
from typing import Any

logger = logging.getLogger("sre-agent.obs")


class ObservabilityLogger:
    """In-memory ring buffer of structured events + stdout logging."""

    def __init__(self, max_events: int = 2000):
        self._buffer: deque[dict] = deque(maxlen=max_events)

    def log_event(self, stage: str, event: str, data: dict[str, Any] = {}) -> None:
        entry = {
            "ts": time.time(),
            "stage": stage,
            "event": event,
            "data": data,
        }
        self._buffer.append(entry)
        logger.info(json.dumps(entry))

    def recent(self, limit: int = 100) -> list[dict]:
        events = list(self._buffer)
        return events[-limit:]