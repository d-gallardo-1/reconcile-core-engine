"""Excel audit pack export, round-trip parsing and the template verifier."""

from __future__ import annotations

import io

import pytest
from openpyxl import Workbook, load_workbook

from app.excel_io import WorkbookError, export_audit_workbook, parse_ledger_workbook
from app.excel_schema import LEDGER_COLUMNS, LEDGER_SHEET
from app.mock_ledgers import SCENARIOS, base_transactions
from app.models import ResolutionAction

from .conftest import API, ledger_row, workbook_bytes

SHEETS = [
    "Summary", "Exact_Matches", "Tolerance_Matches",
    "Unresolved_Anomalies", "Resolved_Audit_Trail", "Ledger_Input",
]


def data_rows(workbook, sheet: str) -> list[tuple]:
    return list(workbook[sheet].iter_rows(min_row=2, values_only=True))


def test_round_trip_returns_identical_transactions(engine, tmp_path):
    for code in SCENARIOS:
        engine.inject(code)
    path = tmp_path / "audit-pack.xlsx"
    export_audit_workbook(engine.snapshot(), path)

    parsed = parse_ledger_workbook(path)

    expected = base_transactions() + [s.transaction("GBP") for s in SCENARIOS.values()]
    assert parsed == expected
    assert parsed == engine.transactions


def test_startup_batch_was_ingested_through_excel(engine):
    assert engine.transactions == base_transactions()


def test_audit_pack_sheets_follow_the_classification(engine, tmp_path):
    engine.inject("SCN-302")
    engine.resolve("TX-9013", ResolutionAction.APPROVE_VARIANCE, "=HYPERLINK(\"http://x\")")
    path = tmp_path / "audit-pack.xlsx"
    export_audit_workbook(engine.snapshot(), path)
    workbook = load_workbook(path)

    assert workbook.sheetnames == SHEETS
    assert len(data_rows(workbook, "Exact_Matches")) == 9
    assert {row[0] for row in data_rows(workbook, "Tolerance_Matches")} == {
        "TX-9010", "TX-9011", "TX-9012",
    }
    assert {row[0] for row in data_rows(workbook, "Unresolved_Anomalies")} == {
        "TX-9014", "TX-9015", "TX-9302",
    }
    resolved = data_rows(workbook, "Resolved_Audit_Trail")
    assert [row[0] for row in resolved] == ["TX-9013"]
    # A note that looks like a formula is stored as text, never as a formula.
    note_cell = workbook["Resolved_Audit_Trail"].cell(row=2, column=len(resolved[0]) - 1)
    assert note_cell.data_type == "s"
    assert note_cell.value.startswith("'=")
    summary = dict(workbook["Summary"].iter_rows(values_only=True))
    assert summary["Unresolved anomalies"] == 3
    assert summary["Resolved / audited"] == 1


def test_export_endpoint_downloads_a_parseable_workbook(client):
    client.post(f"{API}/reconcile/inject/SCN-304")
    response = client.get(f"{API}/export/excel")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert "attachment" in response.headers["content-disposition"]
    assert [tx.tx_id for tx in parse_ledger_workbook(response.content)][-1] == "TX-9304"


def test_template_verifier_accepts_the_template_and_keeps_the_batch(client):
    template = client.get(f"{API}/export/template").content
    verdict = client.post(f"{API}/template/verify", content=template).json()
    assert verdict == {"valid": True, "row_count": 3, "errors": []}
    assert client.get(f"{API}/batches/current").json()["kpis"]["total_records"] == 15


@pytest.mark.parametrize(
    ("content", "fragment"),
    [
        (b"not a workbook", "not a readable .xlsx"),
        (workbook_bytes([ledger_row()], header=["TX"]), "Header row must be exactly"),
        (workbook_bytes([]), "no data rows"),
        (workbook_bytes([ledger_row(), ledger_row()]), "duplicate TX ID"),
        (workbook_bytes([ledger_row(tx_id=None)]), "'TX ID': value is required"),
        (workbook_bytes([ledger_row(erp_amount="abc")]), "'ERP Amount': must be a number"),
        (workbook_bytes([ledger_row(erp_date="02/11/2026")]), "'ERP Date': must be a date"),
        (workbook_bytes([ledger_row(tax_status="PAID")]), "tax_status"),
        (workbook_bytes([ledger_row(currency="XXX")]), "Unsupported currency 'XXX'"),
        (workbook_bytes([ledger_row(currency=None)]), "'Currency': value is required"),
        (
            workbook_bytes([ledger_row(), ledger_row(tx_id="TX-2", currency="EUR")]),
            "mixes currencies (EUR, GBP)",
        ),
        # Yen has no decimals: an amount with a fraction does not fit the currency.
        (
            workbook_bytes([ledger_row(currency="JPY", erp_amount=120.5)]),
            "erp_amount has more decimals than JPY allows",
        ),
    ],
)
def test_parser_reports_malformed_workbooks(client, content, fragment):
    with pytest.raises(WorkbookError) as raised:
        parse_ledger_workbook(content)
    assert fragment in str(raised.value)
    verdict = client.post(f"{API}/template/verify", content=content).json()
    assert verdict["valid"] is False and verdict["errors"]


def test_verifier_rejects_empty_and_oversized_uploads(client):
    assert client.post(f"{API}/template/verify", content=b"").status_code == 400
    too_big = b"0" * (2 * 1024 * 1024 + 1)
    assert client.post(f"{API}/template/verify", content=too_big).status_code == 413


def test_schema_endpoint_matches_the_parser_columns(client):
    body = client.get(f"{API}/schema/ledger").json()
    assert body["sheet"] == LEDGER_SHEET
    assert [column["header"] for column in body["columns"]] == [c.header for c in LEDGER_COLUMNS]
