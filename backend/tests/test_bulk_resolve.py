"""Resolving several anomalies of one cause with a single decision and note."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import build_engine, create_app

from .conftest import API, statuses


def resolve_many(client, tx_ids, action="APPROVE_VARIANCE", note="Wire fees accepted for the quarter."):
    body = {"tx_ids": tx_ids, "action": action, "resolution_note": note}
    return client.post(f"{API}/anomalies/resolve-batch", json=body)


@pytest.fixture()
def fee_anomalies(client):
    """With no tolerance, the three tolerance cases become anomalies; two share a cause."""
    client.post(f"{API}/reconcile/tolerance", json={"amount_tolerance": 0, "date_window_days": 5})
    state = client.get(f"{API}/batches/current").json()
    by_id = {record["tx_id"]: record for record in state["records"]}
    assert by_id["TX-9010"]["anomaly_type"] == by_id["TX-9012"]["anomaly_type"] == "AMOUNT_VARIANCE"
    return client


def test_several_anomalies_are_resolved_with_one_decision(fee_anomalies):
    client = fee_anomalies
    before = client.get(f"{API}/batches/current").json()

    response = resolve_many(client, ["TX-9010", "TX-9012", "TX-9013"])

    assert response.status_code == 200, response.text
    state = response.json()
    by_id = {record["tx_id"]: record for record in state["records"]}
    resolutions = [by_id[tx]["resolution"] for tx in ("TX-9010", "TX-9012", "TX-9013")]
    assert {by_id[tx]["status"] for tx in ("TX-9010", "TX-9012", "TX-9013")} == {"RESOLVED"}
    assert {r["action"] for r in resolutions} == {"APPROVE_VARIANCE"}
    assert {r["resolution_note"] for r in resolutions} == {"Wire fees accepted for the quarter."}
    # One decision, one moment: every entry carries the same audit timestamp.
    assert len({r["resolved_at"] for r in resolutions}) == 1
    # Each entry keeps its own variance.
    assert [r["variance"] for r in resolutions] == [-15.0, -0.6, -180.0]
    assert state["kpis"]["resolved_count"] == 3
    # A single state change was published for the whole batch.
    assert state["sequence"] == before["sequence"] + 1


def test_a_mixed_selection_is_refused_and_nothing_changes(fee_anomalies):
    client = fee_anomalies
    before = statuses(client.get(f"{API}/batches/current").json())

    # TX-9015 is a VAT mismatch, a different cause from the amount variances.
    response = resolve_many(client, ["TX-9010", "TX-9015"])

    assert (response.status_code, response.json()["code"]) == (409, "MIXED_ANOMALY_TYPES")
    assert statuses(client.get(f"{API}/batches/current").json()) == before


@pytest.mark.parametrize(
    ("tx_ids", "status", "code"),
    [
        (["TX-9010", "TX-0000"], 404, "UNKNOWN_TRANSACTION"),
        (["TX-9010", "TX-9001"], 409, "NOT_AN_OPEN_ANOMALY"),
    ],
)
def test_one_bad_record_refuses_the_whole_selection(fee_anomalies, tx_ids, status, code):
    client = fee_anomalies
    response = resolve_many(client, tx_ids)
    assert (response.status_code, response.json()["code"]) == (status, code)
    # All or nothing: the valid record of the selection was not resolved either.
    assert client.get(f"{API}/batches/current").json()["kpis"]["resolved_count"] == 0


def test_an_already_resolved_record_refuses_the_whole_selection(fee_anomalies):
    client = fee_anomalies
    assert resolve_many(client, ["TX-9010"]).status_code == 200
    response = resolve_many(client, ["TX-9010", "TX-9012"], action="REJECT")
    assert (response.status_code, response.json()["code"]) == (409, "ALREADY_RESOLVED")
    by_id = {r["tx_id"]: r for r in client.get(f"{API}/batches/current").json()["records"]}
    assert by_id["TX-9010"]["resolution"]["action"] == "APPROVE_VARIANCE"  # unchanged
    assert by_id["TX-9012"]["status"] == "ANOMALY"


@pytest.mark.parametrize(
    "body",
    [
        {"tx_ids": [], "action": "REJECT", "resolution_note": "x"},
        {"tx_ids": ["TX-9010", "TX-9010"], "action": "REJECT", "resolution_note": "x"},
        {"tx_ids": ["TX-9010"], "action": "REJECT", "resolution_note": "   "},
        {"tx_ids": ["TX-9010"], "action": "DELETE", "resolution_note": "x"},
        {"tx_ids": ["bad id!"], "action": "REJECT", "resolution_note": "x"},
        {"tx_ids": [f"TX-{n}" for n in range(101)], "action": "REJECT", "resolution_note": "x"},
        {"action": "REJECT", "resolution_note": "x"},
    ],
)
def test_malformed_selections_are_rejected(fee_anomalies, body):
    client = fee_anomalies
    assert client.post(f"{API}/anomalies/resolve-batch", json=body).status_code == 422
    assert client.get(f"{API}/batches/current").json()["kpis"]["resolved_count"] == 0


def test_single_resolution_still_works_as_before(fee_anomalies):
    client = fee_anomalies
    note = {"resolution_note": "Checked.", "action": "FLAG_FOR_CREDIT_NOTE"}
    response = client.post(f"{API}/anomalies/TX-9013/resolve", json=note)
    assert response.status_code == 200
    assert client.post(f"{API}/anomalies/TX-9013/resolve", json=note).json()["code"] == "ALREADY_RESOLVED"


def test_bulk_resolution_is_refused_during_a_run():
    engine = build_engine(step_seconds=30)
    with TestClient(create_app(engine)) as client:
        client.post(f"{API}/reconcile/run")
        response = resolve_many(client, ["TX-9013"])
        assert (response.status_code, response.json()["code"]) == (409, "RUN_IN_PROGRESS")
