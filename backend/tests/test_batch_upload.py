"""Loading an uploaded workbook as the active batch."""

from __future__ import annotations

from urllib.parse import quote

import pytest
from fastapi.testclient import TestClient

from app.excel_io import parse_ledger_workbook
from app.main import build_engine, create_app

from .conftest import API, ledger_row, workbook_bytes

ROWS = [
    ledger_row(tx_id="UP-1", currency="EUR"),
    ledger_row(tx_id="UP-2", currency="EUR", bank_amount=110, counterparty="Second Supplier"),
    ledger_row(tx_id="UP-3", currency="EUR", bank_amount=None, bank_date=None, bank_settlement_count=0),
]


def upload(client, content=None, label="ledger march.xlsx"):
    headers = {"Content-Type": "application/octet-stream"}
    if label is not None:
        headers["X-Batch-Label"] = quote(label)
    body = workbook_bytes(ROWS) if content is None else content
    return client.post(f"{API}/batches/upload", content=body, headers=headers)


def test_an_uploaded_workbook_becomes_the_active_batch(client):
    client.post(f"{API}/reconcile/inject/SCN-301")
    note = {"resolution_note": "Checked.", "action": "APPROVE_VARIANCE"}
    client.post(f"{API}/anomalies/TX-9301/resolve", json=note)
    before = client.get(f"{API}/batches/current").json()
    assert before["source"]["kind"] == "SYNTHETIC"

    response = upload(client)

    assert response.status_code == 200, response.text
    state = response.json()
    assert state["source"]["kind"] == "UPLOADED"
    assert state["source"]["label"] == "ledger march.xlsx"
    assert state["source"]["loaded_at"]
    # The batch takes the currency of the workbook and that currency's default rules.
    assert state["currency"]["code"] == "EUR"
    assert state["tolerance"] == {"amount_tolerance": 15.0, "date_window_days": 2}
    by_id = {record["tx_id"]: record for record in state["records"]}
    assert list(by_id) == ["UP-1", "UP-2", "UP-3"]
    assert by_id["UP-1"]["status"] == "EXACT_MATCH"
    assert (by_id["UP-2"]["status"], by_id["UP-2"]["variance"]) == ("TOLERANCE_MATCH", -10.0)
    assert by_id["UP-3"]["anomaly_type"] == "ORPHAN_ERP_ACCRUAL"
    # Nothing of the previous batch survives: no scenario, no resolution.
    assert state["kpis"]["resolved_count"] == 0
    assert not any(scenario["active"] for scenario in state["scenarios"])
    assert state["sequence"] == before["sequence"] + 1  # one broadcast to every client
    assert client.get(f"{API}/batches/current").json()["source"]["kind"] == "UPLOADED"


def test_the_uploaded_batch_is_what_gets_exported(client):
    upload(client)
    exported = parse_ledger_workbook(client.get(f"{API}/export/excel").content)
    assert [tx.tx_id for tx in exported] == ["UP-1", "UP-2", "UP-3"]
    assert {tx.currency for tx in exported} == {"EUR"}


@pytest.mark.parametrize(
    ("content", "fragment"),
    [
        (b"not a workbook", "not a readable .xlsx"),
        (workbook_bytes([ledger_row(), ledger_row(tx_id="TX-2", currency="EUR")]), "mixes currencies"),
        (workbook_bytes([ledger_row(erp_amount="abc")]), "'ERP Amount': must be a number"),
    ],
)
def test_an_invalid_workbook_is_refused_and_the_batch_is_kept(client, content, fragment):
    response = upload(client, content)
    assert response.status_code == 422
    body = response.json()
    assert body["code"] == "INVALID_WORKBOOK"
    assert any(fragment in error for error in body["errors"])
    current = client.get(f"{API}/batches/current").json()
    assert (current["source"]["kind"], current["kpis"]["total_records"]) == ("SYNTHETIC", 15)


def test_empty_and_oversized_uploads_are_refused(client):
    assert upload(client, b"").status_code == 400
    assert upload(client, b"0" * (2 * 1024 * 1024 + 1)).status_code == 413
    assert client.get(f"{API}/batches/current").json()["source"]["kind"] == "SYNTHETIC"


@pytest.mark.parametrize(
    ("label", "expected"),
    [
        (None, "uploaded workbook"),
        ("   ", "uploaded workbook"),
        ("a" * 200, "a" * 80),
        ("evil\r\nname\x00.xlsx", "evilname.xlsx"),
        ("libro mayor año.xlsx", "libro mayor año.xlsx"),
    ],
)
def test_the_label_is_cleaned_before_it_is_shown_to_every_client(client, label, expected):
    assert upload(client, label=label).json()["source"]["label"] == expected


def test_reset_and_currency_change_go_back_to_the_synthetic_batch(client):
    upload(client)
    reset = client.post(f"{API}/reconcile/reset").json()
    # Reset means "the default batch", in the currency that is active.
    assert (reset["source"]["kind"], reset["source"]["label"]) == ("SYNTHETIC", None)
    assert (reset["currency"]["code"], reset["kpis"]["total_records"]) == ("EUR", 15)

    upload(client)
    switched = client.post(f"{API}/batches/currency", json={"currency": "JPY"}).json()
    assert (switched["source"]["kind"], switched["currency"]["code"]) == ("SYNTHETIC", "JPY")


def test_scenarios_and_resolutions_work_on_an_uploaded_batch(client):
    upload(client)
    injected = client.post(f"{API}/reconcile/inject/SCN-302").json()
    assert injected["records"][-1]["currency"] == "EUR"
    assert injected["source"]["kind"] == "UPLOADED"
    note = {"resolution_note": "Supplier confirmed.", "action": "FLAG_FOR_CREDIT_NOTE"}
    resolved = client.post(f"{API}/anomalies/UP-3/resolve", json=note).json()
    assert resolved["kpis"]["resolved_count"] == 1


def test_upload_is_refused_during_a_run():
    engine = build_engine(step_seconds=30)
    with TestClient(create_app(engine)) as client:
        client.post(f"{API}/reconcile/run")
        response = upload(client)
        assert (response.status_code, response.json()["code"]) == (409, "RUN_IN_PROGRESS")
        assert client.get(f"{API}/batches/current").json()["source"]["kind"] == "SYNTHETIC"
