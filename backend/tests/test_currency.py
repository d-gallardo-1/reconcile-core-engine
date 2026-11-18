"""One currency per batch: switching, decimals, tolerance range and translatable codes."""

from __future__ import annotations

import io

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from app.currencies import CURRENCIES
from app.excel_io import export_audit_workbook, parse_ledger_workbook
from app.main import build_engine, create_app

from .conftest import API


def switch(client, code: str):
    return client.post(f"{API}/batches/currency", json={"currency": code})


@pytest.mark.parametrize("code", list(CURRENCIES))
def test_every_currency_gives_the_same_reconciliation_result(code, tmp_path):
    engine = build_engine(step_seconds=0, currency=code)
    state = engine.snapshot()
    kpis = state.kpis
    assert state.currency.code == code
    assert (kpis.exact_count, kpis.tolerance_count, kpis.anomaly_count) == (9, 3, 3)
    assert {record.currency for record in state.records} == {code}
    # Each amount fits the smallest unit of the currency.
    currency = CURRENCIES[code]
    for record in state.records:
        for amount in (record.erp_amount, record.bank_amount, record.tax_vat_amount, record.variance):
            assert amount is None or amount == currency.round(amount)
    # The Excel round trip keeps the currency and every amount.
    path = tmp_path / "pack.xlsx"
    export_audit_workbook(state, path)
    assert parse_ledger_workbook(path) == engine.transactions


def test_switching_currency_reloads_the_batch_in_that_currency(client):
    client.post(f"{API}/reconcile/inject/SCN-301")
    note = {"resolution_note": "Checked.", "action": "APPROVE_VARIANCE"}
    assert client.post(f"{API}/anomalies/TX-9301/resolve", json=note).status_code == 200

    response = switch(client, "jpy")  # codes are case-insensitive
    assert response.status_code == 200, response.text
    state = response.json()

    assert state["currency"] == {
        "code": "JPY", "minor_units": 0,
        "max_amount_tolerance": 10000.0, "amount_tolerance_step": 100.0,
    }
    assert "JPY" in state["available_currencies"] and "GBP" in state["available_currencies"]
    assert state["tolerance"] == {"amount_tolerance": 3000.0, "date_window_days": 2}
    kpis = state["kpis"]
    # A fresh batch: the injected scenario and its resolution do not carry over.
    assert (kpis["total_records"], kpis["resolved_count"], kpis["anomaly_count"]) == (15, 0, 3)
    assert kpis["total_ledger_volume"] == 162264 * 200
    by_id = {record["tx_id"]: record for record in state["records"]}
    assert by_id["TX-9010"]["variance"] == -3000.0
    assert by_id["TX-9010"]["status"] == "TOLERANCE_MATCH"
    assert client.get(f"{API}/batches/current").json()["currency"]["code"] == "JPY"

    # Scenarios and reset stay in the batch currency.
    injected = client.post(f"{API}/reconcile/inject/SCN-301").json()["records"][-1]
    assert (injected["currency"], injected["variance"]) == ("JPY", -360000.0)
    assert client.post(f"{API}/reconcile/reset").json()["currency"]["code"] == "JPY"


@pytest.mark.parametrize("body", [{"currency": "XXX"}, {"currency": "GB"}, {"currency": 5}, {}])
def test_unknown_or_malformed_currency_is_refused(client, body):
    response = client.post(f"{API}/batches/currency", json=body)
    assert response.status_code == 422
    if body == {"currency": "XXX"}:
        assert response.json()["code"] == "UNKNOWN_CURRENCY"
    assert client.get(f"{API}/batches/current").json()["currency"]["code"] == "GBP"


def test_tolerance_limit_follows_the_currency(client):
    def set_tolerance(amount):
        body = {"amount_tolerance": amount, "date_window_days": 2}
        return client.post(f"{API}/reconcile/tolerance", json=body)

    assert set_tolerance(50).status_code == 200
    refused = set_tolerance(50.01)
    assert (refused.status_code, refused.json()["code"]) == (422, "TOLERANCE_OUT_OF_RANGE")
    switch(client, "CLP")
    assert set_tolerance(50000).status_code == 200  # refused in GBP, in range in CLP
    assert set_tolerance(50001).status_code == 422
    assert client.get(f"{API}/batches/current").json()["tolerance"]["amount_tolerance"] == 50000.0


def test_explanations_carry_a_code_parameters_and_an_english_sentence(client):
    switch(client, "BRL")
    by_id = {r["tx_id"]: r for r in client.get(f"{API}/batches/current").json()["records"]}
    exact, fee, lag, variance, late = (by_id[f"TX-90{n}"] for n in ("01", "10", "11", "13", "14"))
    assert (exact["explanation_code"], exact["explanation_params"]) == ("EXACT", {})
    assert (fee["explanation_code"], fee["explanation_params"]) == ("TOLERANCE_AMOUNT", {"delta": -75.0})
    assert fee["explanation"] == "Auto-matched within tolerance: amount variance -75.00 BRL."
    assert (lag["explanation_code"], lag["explanation_params"]) == ("TOLERANCE_DATE", {"shift": 2})
    assert variance["explanation_params"] == {"delta": -900.0, "tolerance": 75.0}
    assert variance["explanation"] == "Amount variance -900.00 BRL exceeds the 75.00 BRL tolerance."
    assert late["explanation_params"] == {"shift": 9, "window": 2}
    # No decimals are shown for a currency without minor units.
    switch(client, "JPY")
    by_id = {r["tx_id"]: r for r in client.get(f"{API}/batches/current").json()["records"]}
    assert by_id["TX-9013"]["explanation"] == "Amount variance -36,000 JPY exceeds the 3,000 JPY tolerance."


def test_errors_carry_a_stable_code(client):
    def code(response, status):
        assert response.status_code == status, response.text
        body = response.json()
        assert isinstance(body["detail"], str) and body["detail"]
        return body["code"]

    note = {"resolution_note": "Checked.", "action": "APPROVE_VARIANCE"}
    assert code(client.post(f"{API}/reconcile/inject/SCN-999"), 404) == "UNKNOWN_SCENARIO"
    client.post(f"{API}/reconcile/inject/SCN-302")
    assert code(client.post(f"{API}/reconcile/inject/SCN-302"), 409) == "SCENARIO_ACTIVE"
    assert code(client.post(f"{API}/anomalies/TX-0000/resolve", json=note), 404) == "UNKNOWN_TRANSACTION"
    assert code(client.post(f"{API}/anomalies/TX-9001/resolve", json=note), 409) == "NOT_AN_OPEN_ANOMALY"
    client.post(f"{API}/anomalies/TX-9302/resolve", json=note)
    assert code(client.post(f"{API}/anomalies/TX-9302/resolve", json=note), 409) == "ALREADY_RESOLVED"


def test_currency_cannot_change_during_a_run():
    engine = build_engine(step_seconds=30)
    with TestClient(create_app(engine)) as client:
        client.post(f"{API}/reconcile/run")
        response = switch(client, "EUR")
        assert (response.status_code, response.json()["code"]) == (409, "RUN_IN_PROGRESS")
        assert client.get(f"{API}/batches/current").json()["currency"]["code"] == "GBP"


def test_audit_pack_follows_the_batch_currency(client):
    switch(client, "JPY")
    workbook = load_workbook(io.BytesIO(client.get(f"{API}/export/excel").content))
    summary = dict(workbook["Summary"].iter_rows(values_only=True))
    assert summary["Currency"] == "JPY"
    assert summary["Amount tolerance (JPY)"] == 3000
    sheet = workbook["Exact_Matches"]
    headers = [cell.value for cell in sheet[1]]
    assert "ERP Amount" in headers and "Currency" in headers
    amount_cell = sheet.cell(row=2, column=headers.index("ERP Amount") + 1)
    assert amount_cell.number_format == "#,##0;[Red]-#,##0"
    # The template offered for download is in the batch currency too.
    template = parse_ledger_workbook(client.get(f"{API}/export/template").content)
    assert {tx.currency for tx in template} == {"JPY"}
