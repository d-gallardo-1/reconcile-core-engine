"""Excel downloads: audit pack, input template and the sheet schema."""

from __future__ import annotations

import io

from fastapi import APIRouter
from fastapi.responses import Response

from .. import excel_schema
from ..config import MAX_UPLOAD_BYTES
from ..engine import ReconciliationEngine
from ..excel_io import MAX_ROWS, export_audit_workbook, export_template_workbook
from ..mock_ledgers import base_transactions
from .schemas import LedgerSchemaResponse, SchemaColumn

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _download(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type=XLSX,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


def build_export_router(engine: ReconciliationEngine) -> APIRouter:
    router = APIRouter(tags=["excel"])

    @router.get("/export/excel")
    async def export_excel() -> Response:
        state = engine.snapshot()
        buffer = io.BytesIO()
        export_audit_workbook(state, buffer)
        return _download(buffer.getvalue(), f"audit-pack-{state.batch_id}.xlsx")

    @router.get("/export/template")
    async def export_template() -> Response:
        buffer = io.BytesIO()
        export_template_workbook(base_transactions(engine.currency_code)[:3], buffer)
        return _download(buffer.getvalue(), "ledger-input-template.xlsx")

    @router.get("/schema/ledger", response_model=LedgerSchemaResponse)
    async def ledger_schema() -> LedgerSchemaResponse:
        return LedgerSchemaResponse(
            sheet=excel_schema.LEDGER_SHEET,
            columns=[
                SchemaColumn(
                    header=c.header, kind=c.kind, required=c.required, description=c.description
                )
                for c in excel_schema.LEDGER_COLUMNS
            ],
            max_rows=MAX_ROWS,
            max_upload_bytes=MAX_UPLOAD_BYTES,
        )

    return router
