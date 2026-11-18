"""FastAPI application (orchestrator): wires the engine and the routers.

Run with a single worker so the in-memory batch is shared by every client::

    uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
"""

from __future__ import annotations

import contextlib
import io
from typing import AsyncIterator

from fastapi import FastAPI

from . import __version__
from .api.errors import install_error_handlers
from .api.export_routes import build_export_router
from .api.read_routes import build_read_router
from .api.reconcile_routes import build_reconcile_router
from .config import API_PREFIX, Settings, load_settings
from .engine import ReconciliationEngine
from .excel_io import export_template_workbook, parse_ledger_workbook
from .mock_ledgers import BATCH_ID, DATA_NOTICE, ENTITY_NAME, SCENARIOS, base_transactions
from .models import LedgerTransaction


def load_batch_via_excel(transactions: list[LedgerTransaction]) -> list[LedgerTransaction]:
    """Ingest the batch through the same Excel path an uploaded ledger would take."""
    buffer = io.BytesIO()
    export_template_workbook(transactions, buffer)
    return parse_ledger_workbook(buffer.getvalue())


def build_engine(*, step_seconds: float = 0.15) -> ReconciliationEngine:
    return ReconciliationEngine(
        entity=ENTITY_NAME,
        batch_id=BATCH_ID,
        data_notice=DATA_NOTICE,
        transactions=load_batch_via_excel(base_transactions()),
        scenarios=SCENARIOS,
        step_seconds=step_seconds,
    )


def create_app(
    engine: ReconciliationEngine | None = None, *, settings: Settings | None = None
) -> FastAPI:
    settings = settings or load_settings()
    engine = engine or build_engine(step_seconds=settings.step_seconds)

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        try:
            yield
        finally:
            await engine.shutdown()

    app = FastAPI(
        title="Reconcile Core Engine API",
        version=__version__,
        description=(
            "Reference demo. Every ledger, bank and tax record is synthetic; the "
            "service is not connected to any real financial system."
        ),
        lifespan=lifespan,
        # The interactive docs page loads its assets from a public CDN, which
        # would break the offline, on-premises promise. The schema stays available.
        docs_url=None,
        redoc_url=None,
        openapi_url=f"{API_PREFIX}/openapi.json",
    )
    app.state.engine = engine
    install_error_handlers(app)
    app.include_router(build_read_router(engine), prefix=API_PREFIX)
    app.include_router(build_reconcile_router(engine), prefix=API_PREFIX)
    app.include_router(build_export_router(engine), prefix=API_PREFIX)
    return app


app = create_app()
