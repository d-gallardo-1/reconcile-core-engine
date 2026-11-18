"""Server-Sent Events framing for one client connection."""

from __future__ import annotations

import asyncio
from typing import AsyncIterator

from .config import HEARTBEAT_SECONDS
from .engine import ReconciliationEngine

#: Milliseconds the browser waits before reconnecting after a dropped stream.
RETRY_MS = 3000

#: A named event (not an SSE comment) so the browser can observe it and detect
#: a silently dead connection, for example behind a proxy that keeps the client
#: side open after the backend has gone away.
HEARTBEAT_FRAME = "event: heartbeat\ndata: {}\n\n"


def format_sse(event: str, sequence: int, data: str) -> str:
    return f"id: {sequence}\nevent: {event}\ndata: {data}\n\n"


async def event_stream(
    engine: ReconciliationEngine,
    *,
    max_events: int | None = None,
    heartbeat_seconds: float = HEARTBEAT_SECONDS,
) -> AsyncIterator[str]:
    """Yield SSE frames for one client.

    Order: reconnection hint, an immediate ``snapshot`` with the current state,
    then ``state_update`` and ``reconciliation_progress`` events as they happen.
    When nothing is published for ``heartbeat_seconds`` a ``heartbeat`` event is
    sent instead, so a client always receives something within that interval.
    """
    queue = engine.broadcaster.subscribe()
    try:
        yield f"retry: {RETRY_MS}\n\n"
        state = engine.snapshot()
        yield format_sse("snapshot", state.sequence, state.model_dump_json())
        sent = 1
        while max_events is None or sent < max_events:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=heartbeat_seconds)
            except asyncio.TimeoutError:
                yield HEARTBEAT_FRAME
                continue
            yield format_sse(event.name, event.sequence, event.data)
            sent += 1
    finally:
        engine.broadcaster.unsubscribe(queue)
