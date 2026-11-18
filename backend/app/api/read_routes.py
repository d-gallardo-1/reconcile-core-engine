"""Read-only routes: health, current batch and the SSE stream."""

from __future__ import annotations

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from .. import __version__
from ..engine import ReconciliationEngine
from ..batch_models import BatchState
from ..sse import event_stream
from .schemas import HealthResponse


def build_read_router(engine: ReconciliationEngine) -> APIRouter:
    router = APIRouter(tags=["read"])

    @router.get("/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        return HealthResponse(
            status="ok", version=__version__, subscribers=engine.broadcaster.subscriber_count
        )

    @router.get("/batches/current", response_model=BatchState)
    async def current_batch() -> BatchState:
        return engine.snapshot()

    @router.get("/stream")
    async def stream(
        max_events: int | None = Query(
            default=None, ge=1, le=1000,
            description="Close the stream after this many events (used by tests).",
        ),
    ) -> StreamingResponse:
        return StreamingResponse(
            event_stream(engine, max_events=max_events),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                # Tells Nginx not to buffer this response even if its config would.
                "X-Accel-Buffering": "no",
            },
        )

    return router
