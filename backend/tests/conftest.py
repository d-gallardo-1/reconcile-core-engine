"""Shared fixtures. Live runs use a zero step delay so tests stay fast."""

from __future__ import annotations

import io
import json

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.engine import ReconciliationEngine
from app.excel_schema import LEDGER_COLUMNS, LEDGER_SHEET
from app.main import build_engine, create_app

API = "/api/v1"


@pytest.fixture()
def engine() -> ReconciliationEngine:
    return build_engine(step_seconds=0)


@pytest.fixture()
def client(engine: ReconciliationEngine):
    with TestClient(create_app(engine)) as test_client:
        yield test_client


def parse_sse(frame: str) -> tuple[str, dict]:
    """Split one SSE frame into ``(event name, decoded data)``."""
    fields = dict(line.split(": ", 1) for line in frame.strip().splitlines())
    return fields["event"], json.loads(fields["data"])


def statuses(state: dict) -> dict[str, str]:
    return {record["tx_id"]: record["status"] for record in state["records"]}


#: One valid input row, by field name, so a test names the cell it changes.
GOOD_ROW = {
    "tx_id": "TX-1", "invoice_ref": "INV-1", "counterparty": "Acme Test Ltd", "currency": "GBP",
    "erp_amount": 120, "erp_date": "2026-11-02", "vat_rate": 0.2,
    "bank_amount": 120, "bank_date": "2026-11-02", "bank_settlement_count": 1,
    "tax_status": "REGISTERED", "tax_vat_amount": 20, "scenario_code": None,
}


def ledger_row(**overrides) -> list:
    """Cells of one row in sheet order, with the named fields replaced."""
    unknown = set(overrides) - set(GOOD_ROW)
    assert not unknown, f"unknown fields: {unknown}"
    values = {**GOOD_ROW, **overrides}
    return [values[column.field] for column in LEDGER_COLUMNS]


def workbook_bytes(
    rows: list[list],
    header: list[str] | None = None,
    extra_cell: tuple[int, int, object] | None = None,
) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = LEDGER_SHEET
    sheet.append(header or [column.header for column in LEDGER_COLUMNS])
    for row in rows:
        sheet.append(row)
    if extra_cell:
        sheet.cell(row=extra_cell[0], column=extra_cell[1], value=extra_cell[2])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
