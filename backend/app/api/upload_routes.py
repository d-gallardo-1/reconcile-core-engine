"""Workbook uploads: verification only, or loading as the active batch."""

from __future__ import annotations

from urllib.parse import unquote

from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from ..batch_models import BatchState
from ..config import MAX_UPLOAD_BYTES
from ..engine import ReconciliationEngine
from ..errors import InvalidRequestError
from ..excel_io import WorkbookError, parse_ledger_workbook
from .schemas import VerifyResponse

TOO_LARGE = f"Workbook is larger than {MAX_UPLOAD_BYTES // (1024 * 1024)} MB."
DEFAULT_LABEL = "uploaded workbook"
MAX_LABEL_LENGTH = 80


async def read_workbook_body(request: Request) -> bytes:
    """The raw request body, refused as soon as it exceeds the upload limit."""
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
    return bytes(content)


def clean_label(raw: str | None) -> str:
    """A display name for the batch. It is shown to every connected client, so
    control characters are dropped and the length is bounded."""
    text = unquote(raw or "")
    printable = "".join(character for character in text if character.isprintable())
    return printable.strip()[:MAX_LABEL_LENGTH] or DEFAULT_LABEL


def build_upload_router(engine: ReconciliationEngine) -> APIRouter:
    router = APIRouter(tags=["upload"])

    @router.post("/template/verify", response_model=VerifyResponse)
    async def verify_template(request: Request) -> VerifyResponse:
        """Validate an uploaded workbook (raw body). The active batch is not changed."""
        content = await read_workbook_body(request)
        try:
            # Parsing is CPU-bound: off the event loop, so SSE clients keep receiving.
            transactions = await run_in_threadpool(parse_ledger_workbook, content)
        except WorkbookError as error:
            return VerifyResponse(valid=False, row_count=0, errors=error.errors)
        return VerifyResponse(valid=True, row_count=len(transactions), errors=[])

    @router.post("/batches/upload", response_model=BatchState)
    async def upload_batch(request: Request) -> BatchState:
        """Replace the active batch with an uploaded workbook (raw body).

        The batch lives in memory and is broadcast to every connected client.
        """
        content = await read_workbook_body(request)
        try:
            transactions = await run_in_threadpool(parse_ledger_workbook, content)
        except WorkbookError as error:
            raise InvalidRequestError(
                "INVALID_WORKBOOK", "The workbook cannot be loaded.", details=error.errors
            ) from None
        return engine.load_uploaded(transactions, clean_label(request.headers.get("x-batch-label")))

    return router
