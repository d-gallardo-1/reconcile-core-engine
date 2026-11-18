"""Excel routes: audit pack download, input template, schema and verifier."""

from __future__ import annotations

import io

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response

from .. import excel_schema
from ..config import MAX_UPLOAD_BYTES
from ..engine import ReconciliationEngine
from ..excel_io import (
    MAX_ROWS,
    WorkbookError,
    export_audit_workbook,
    export_template_workbook,
    parse_ledger_workbook,
)
from ..mock_ledgers import base_transactions
from .schemas import LedgerSchemaResponse, SchemaColumn, VerifyResponse

TOO_LARGE = f"Workbook is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
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

    @router.post("/template/verify", response_model=VerifyResponse)
    async def verify_template(request: Request) -> VerifyResponse:
        """Validate an uploaded workbook (raw body). The active batch is not changed."""
        declared = request.headers.get("content-length", "")
        if declared.isdigit() and int(declared) > MAX_UPLOAD_BYTES:
            raise HTTPException(413, TOO_LARGE)
        content = bytearray()
        async for chunk in request.stream():
            content.extend(chunk)
            if len(content) > MAX_UPLOAD_BYTES:
                raise HTTPException(413, TOO_LARGE)
        if not content:
            raise HTTPException(400, "The request body is empty.")
        try:
            # Parsing is CPU-bound: off the event loop, so SSE clients keep receiving.
            transactions = await run_in_threadpool(parse_ledger_workbook, bytes(content))
        except WorkbookError as error:
            return VerifyResponse(valid=False, row_count=0, errors=error.errors)
        return VerifyResponse(valid=True, row_count=len(transactions), errors=[])

    return router
