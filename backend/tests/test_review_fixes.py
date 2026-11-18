"""Regression tests for defects found in review: parser limits, run failures, missing data."""

from __future__ import annotations

import asyncio
import io
from datetime import date
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from openpyxl import Workbook

from app.config import load_settings
from app.engine import default_tolerance
from app.excel_io import MAX_ROWS, WorkbookError, parse_ledger_workbook
from app.excel_schema import LEDGER_COLUMNS, LEDGER_SHEET
from app.main import build_engine, create_app
from app.matching import reconcile
from app.models import AnomalyType, LedgerTransaction, MatchStatus, TaxCheck, TaxStatus

from .conftest import API

GOOD = ["TX-1", "INV-1", "Acme Test Ltd", 120, "2026-11-02", 0.2, 120, "2026-11-02", 1, "REGISTERED", 20, None]


def workbook_bytes(rows: list[list], extra_cell: tuple[int, int, object] | None = None) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = LEDGER_SHEET
    sheet.append([column.header for column in LEDGER_COLUMNS])
    for row in rows:
        sheet.append(row)
    if extra_cell:
        sheet.cell(row=extra_cell[0], column=extra_cell[1], value=extra_cell[2])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


@pytest.mark.parametrize(
    ("row", "fragment"),
    [
        (GOOD[:3] + [1e30] + GOOD[4:], "'ERP Amount GBP': must be a number between"),
        (GOOD[:6] + [-1e30] + GOOD[7:], "'Bank Amount GBP': must be a number between"),
        (GOOD[:8] + ["abc"] + GOOD[9:], "'Bank Settlements': must be a whole number"),
        (GOOD[:8] + ["1.0"] + GOOD[9:], "'Bank Settlements': must be a whole number"),
    ],
)
def test_out_of_range_cells_are_row_errors_not_crashes(client, row, fragment):
    content = workbook_bytes([row])
    with pytest.raises(WorkbookError) as raised:
        parse_ledger_workbook(content)
    assert fragment in str(raised.value)
    response = client.post(f"{API}/template/verify", content=content)
    assert response.status_code == 200
    assert response.json()["valid"] is False


def test_row_limit_counts_blank_rows_and_data_beyond_the_schema():
    # One far-away cell outside the 12 schema columns: every row up to it is blank
    # for the parser, and must still count against the limit.
    content = workbook_bytes([GOOD], extra_cell=(MAX_ROWS + 500, 20, "x"))
    with pytest.raises(WorkbookError) as raised:
        parse_ledger_workbook(content)
    message = str(raised.value)
    assert f"more than {MAX_ROWS} rows" in message
    # The user is told why a short-looking sheet is refused and what to do.
    assert "Blank and formatted rows count" in message


def _numbered_rows(count: int) -> list[list]:
    return [[f"TX-{index}"] + GOOD[1:] for index in range(count)]


def test_a_sheet_with_exactly_the_row_limit_is_accepted():
    assert len(parse_ledger_workbook(workbook_bytes(_numbered_rows(MAX_ROWS)))) == MAX_ROWS


def test_one_data_row_over_the_limit_is_refused():
    with pytest.raises(WorkbookError):
        parse_ledger_workbook(workbook_bytes(_numbered_rows(MAX_ROWS + 1)))


@pytest.mark.parametrize("cell", ["1", " 1 ", 1, 1.0])
def test_whole_numbers_typed_as_text_are_accepted(cell):
    # Text-formatted numerals are common in hand-edited workbooks.
    parsed = parse_ledger_workbook(workbook_bytes([GOOD[:8] + [cell] + GOOD[9:]]))
    assert parsed[0].bank_settlement_count == 1


def _tx(**overrides) -> LedgerTransaction:
    values = dict(
        tx_id="TX-1", invoice_ref="INV-1", counterparty="Acme Test Ltd",
        erp_amount_gbp=Decimal("120.00"), erp_date=date(2026, 11, 2), vat_rate=Decimal("0.20"),
        bank_amount_gbp=Decimal("120.00"), bank_date=date(2026, 11, 2), bank_settlement_count=1,
        tax_status=TaxStatus.REGISTERED, tax_vat_amount_gbp=Decimal("20.00"),
    )
    return LedgerTransaction(**{**values, **overrides})


@pytest.mark.parametrize("missing", ["erp_date", "bank_date"])
def test_a_record_without_a_date_is_an_anomaly_with_an_explanation(missing):
    record = reconcile(_tx(**{missing: None}), default_tolerance())
    assert record.status is MatchStatus.ANOMALY
    # Absent data is its own category, not a shift that was measured.
    assert record.anomaly_type is AnomalyType.INCOMPLETE_SOURCE_DATA
    assert "date is missing" in record.explanation


@pytest.mark.parametrize("registry_vat", [Decimal("20.00"), None])
def test_a_missing_vat_rate_is_reported_as_missing_not_as_a_mismatch(registry_vat):
    record = reconcile(_tx(vat_rate=None, tax_vat_amount_gbp=registry_vat), default_tolerance())
    assert record.tax_check is TaxCheck.RATE_MISSING
    assert record.status is MatchStatus.ANOMALY
    assert record.anomaly_type is AnomalyType.INCOMPLETE_SOURCE_DATA
    assert "no VAT rate" in record.explanation


def test_a_real_vat_difference_is_still_a_mismatch():
    record = reconcile(_tx(tax_vat_amount_gbp=Decimal("5.71")), default_tolerance())
    assert record.tax_check is TaxCheck.VAT_MISMATCH
    assert record.anomaly_type is AnomalyType.VAT_MISMATCH


def test_complete_record_still_matches_exactly():
    assert reconcile(_tx(), default_tolerance()).status is MatchStatus.EXACT_MATCH


def test_a_run_that_fails_midway_is_reported_as_failed(engine, caplog):
    calls = 0

    def explode(_: str) -> None:
        nonlocal calls
        calls += 1
        if calls == 3:
            raise RuntimeError("boom")

    engine._live._publish_progress = explode

    async def scenario():
        engine.start_run()
        await engine.wait_for_run()

    asyncio.run(scenario())
    run = engine.snapshot().run
    assert run.status.value == "FAILED"
    assert run.processed < run.total
    assert "Live run" in caplog.text
    # A failed run does not lock the batch.
    assert engine.reset().run.status.value == "IDLE"


def test_changes_are_refused_while_a_run_is_in_progress():
    # A long step keeps the run in progress for the whole test; leaving the
    # client context cancels it, so no assertion depends on timing.
    engine = build_engine(step_seconds=30)
    engine.inject("SCN-301")
    with TestClient(create_app(engine)) as client:
        assert client.post(f"{API}/reconcile/run").json()["status"] == "RUNNING"
        note = {"resolution_note": "Checked.", "action": "APPROVE_VARIANCE"}
        tolerance = {"amount_tolerance_gbp": 1, "date_window_days": 1}
        for path, body in (
            ("/reconcile/run", None),
            ("/reconcile/reset", None),
            ("/reconcile/inject/SCN-302", None),
            ("/reconcile/tolerance", tolerance),
            ("/anomalies/TX-9301/resolve", note),
        ):
            assert client.post(f"{API}{path}", json=body).status_code == 409, path
        assert client.get(f"{API}/batches/current").json()["kpis"]["resolved_count"] == 0


@pytest.mark.parametrize(
    ("raw", "expected"),
    [("0.5", 0.5), ("-3", 0.0), ("99", 2.0), ("nan", 0.15), ("inf", 0.15), ("abc", 0.15)],
)
def test_step_seconds_setting_is_clamped_and_rejects_non_finite(monkeypatch, raw, expected):
    monkeypatch.setenv("RECONCILE_STEP_SECONDS", raw)
    assert load_settings().step_seconds == expected
