"""
In-memory event bus for the OmniAI sidecar.

When an OS-level command is requested, the approval loop broadcasts a
"pending" event so a human (or the Next.js UI) can see that something is
waiting. This is intentionally local-only: events live in this process and
are forgotten when the sidecar restarts.
"""

from __future__ import annotations

import asyncio
import json
from collections import deque
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Deque, Dict, List


# Keep a short history so a UI that connects a moment late still sees
# the latest pending commands.
_MAX_HISTORY = 50
_history: Deque[Dict[str, Any]] = deque(maxlen=_MAX_HISTORY)
_subscribers: List[asyncio.Queue] = []


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def broadcast(event_type: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Publish an event to every live subscriber and store it in history.

    Returns the event dict so callers can include it in HTTP responses.
    """
    event = {
        "type": event_type,
        "created_at": _now_iso(),
        "payload": payload,
    }
    _history.append(event)

    # put_nowait is safe here because each subscriber queue is unbounded
    # for this lightweight sidecar. If a client is too slow, it simply
    # lags behind; we never block the request that created the event.
    for queue in list(_subscribers):
        try:
            queue.put_nowait(event)
        except Exception:
            continue

    return event


def recent_events() -> List[Dict[str, Any]]:
    """Return a snapshot of recent events for GET /api/system/events."""
    return list(_history)


async def subscribe() -> AsyncIterator[str]:
    """
    Server-Sent Events generator.

    Each connected browser/server keeps an asyncio.Queue. When broadcast()
    runs, every queue receives the same event and this generator yields it
    as an SSE `data:` line.
    """
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.append(queue)
    try:
        # Send a hello so the client knows the stream is alive.
        hello = json.dumps({"type": "connected", "created_at": _now_iso(), "payload": {}})
        yield f"data: {hello}\n\n"
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
    finally:
        if queue in _subscribers:
            _subscribers.remove(queue)
