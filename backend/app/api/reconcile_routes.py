"""Routes that change the batch: live run, tolerance, reset, scenarios, resolution.

Static paths are declared before the parameterised ones so that a literal
segment such as ``/reconcile/reset`` can never be captured as a parameter.
"""

from __future__ import annotations

from fastapi import APIRouter, Path

from ..engine import ReconciliationEngine
from ..models import BatchState, RunState
from .schemas import ResolveRequest, ToleranceRequest

_CODE = r"^[A-Za-z0-9-]{1,32}$"


def build_reconcile_router(engine: ReconciliationEngine) -> APIRouter:
    router = APIRouter(tags=["reconcile"])

    @router.post("/reconcile/run", response_model=RunState, status_code=202)
    async def run() -> RunState:
        return engine.start_run()

    @router.post("/reconcile/tolerance", response_model=BatchState)
    async def tolerance(body: ToleranceRequest) -> BatchState:
        return engine.set_tolerance(body.amount_tolerance_gbp, body.date_window_days)

    @router.post("/reconcile/reset", response_model=BatchState)
    async def reset() -> BatchState:
        return engine.reset()

    @router.post("/reconcile/inject/{scenario_code}", response_model=BatchState)
    async def inject(scenario_code: str = Path(pattern=_CODE)) -> BatchState:
        return engine.inject(scenario_code)

    @router.post("/anomalies/{tx_id}/resolve", response_model=BatchState)
    async def resolve(body: ResolveRequest, tx_id: str = Path(pattern=_CODE)) -> BatchState:
        return engine.resolve(tx_id, body.action, body.resolution_note)

    return router
