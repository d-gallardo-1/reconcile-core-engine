"""3-pass matching, dynamic tolerance, scenario injection, resolution and reset."""

from __future__ import annotations

import pytest

from .conftest import API, statuses

TOLERANCE_CASES = ("TX-9010", "TX-9011", "TX-9012")


def set_tolerance(client, amount: float, days: int) -> dict:
    response = client.post(
        f"{API}/reconcile/tolerance",
        json={"amount_tolerance_gbp": amount, "date_window_days": days},
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_health(client):
    body = client.get(f"{API}/health").json()
    assert body["status"] == "ok"


def test_default_batch_is_9_exact_3_tolerance_3_anomalies(client):
    state = client.get(f"{API}/batches/current").json()
    kpis = state["kpis"]
    assert (kpis["total_records"], kpis["exact_count"]) == (15, 9)
    assert (kpis["tolerance_count"], kpis["anomaly_count"], kpis["resolved_count"]) == (3, 3, 0)
    assert kpis["match_rate_pct"] == 80.0
    assert state["tolerance"] == {"amount_tolerance_gbp": 15.0, "date_window_days": 2}
    by_id = {record["tx_id"]: record for record in state["records"]}
    assert by_id["TX-9001"]["matched_in_pass"] == 1
    assert by_id["TX-9010"]["variance_gbp"] == -15.0
    assert by_id["TX-9011"]["date_shift_days"] == 2
    assert by_id["TX-9012"]["variance_gbp"] == -0.6
    assert {by_id[tx]["status"] for tx in TOLERANCE_CASES} == {"TOLERANCE_MATCH"}
    assert by_id["TX-9013"]["anomaly_type"] == "AMOUNT_VARIANCE"
    assert by_id["TX-9014"]["anomaly_type"] == "SETTLEMENT_DATE_SHIFT"
    assert by_id["TX-9015"]["anomaly_type"] == "VAT_MISMATCH"
    # Net variance of the open anomalies: only TX-9013 carries an amount delta.
    assert kpis["net_unreconciled_variance_gbp"] == -180.0


@pytest.mark.parametrize(
    ("amount", "days", "expected_tolerance_matches"),
    [
        (0, 0, set()),
        (0.59, 5, {"TX-9011"}),
        (0.60, 0, {"TX-9012"}),
        (14.99, 1, {"TX-9012"}),
        (15, 1, {"TX-9010", "TX-9012"}),
        (15, 2, {"TX-9010", "TX-9011", "TX-9012"}),
        (50, 5, {"TX-9010", "TX-9011", "TX-9012"}),
    ],
)
def test_tolerance_is_re_evaluated_immediately(client, amount, days, expected_tolerance_matches):
    state = set_tolerance(client, amount, days)
    found = {tx for tx, status in statuses(state).items() if status == "TOLERANCE_MATCH"}
    assert found == expected_tolerance_matches
    # A case outside the rules becomes an anomaly; exact matches never move.
    assert state["kpis"]["exact_count"] == 9
    assert state["kpis"]["anomaly_count"] == 3 + (3 - len(expected_tolerance_matches))


@pytest.mark.parametrize(
    "body",
    [
        {"amount_tolerance_gbp": -1, "date_window_days": 2},
        {"amount_tolerance_gbp": 50.01, "date_window_days": 2},
        {"amount_tolerance_gbp": 15, "date_window_days": 6},
        {"amount_tolerance_gbp": 15, "date_window_days": 1.5},
        {"amount_tolerance_gbp": 15},
    ],
)
def test_tolerance_rejects_out_of_range_values(client, body):
    assert client.post(f"{API}/reconcile/tolerance", json=body).status_code == 422
    assert client.get(f"{API}/batches/current").json()["tolerance"]["date_window_days"] == 2


@pytest.mark.parametrize(
    ("code", "tx_id", "anomaly_type", "variance"),
    [
        ("SCN-301", "TX-9301", "WITHHOLDING_GAP", -1800.0),
        ("SCN-302", "TX-9302", "DUPLICATE_SETTLEMENT", 3450.0),
        ("SCN-303", "TX-9303", "ORPHAN_ERP_ACCRUAL", -6120.0),
        ("SCN-304", "TX-9304", "UNBOOKED_BANK_DEBIT", 2950.0),
    ],
)
def test_scenario_injection(client, code, tx_id, anomaly_type, variance):
    response = client.post(f"{API}/reconcile/inject/{code}")
    assert response.status_code == 200, response.text
    state = response.json()
    record = next(r for r in state["records"] if r["tx_id"] == tx_id)
    assert (record["status"], record["anomaly_type"]) == ("ANOMALY", anomaly_type)
    assert record["variance_gbp"] == variance
    assert state["kpis"]["total_records"] == 16
    assert state["kpis"]["anomaly_count"] == 4
    assert next(s for s in state["scenarios"] if s["code"] == code)["active"] is True
    # Even the widest allowed tolerance must not absorb an injected scenario.
    assert statuses(set_tolerance(client, 50, 5))[tx_id] == "ANOMALY"


def test_injection_errors(client):
    assert client.post(f"{API}/reconcile/inject/SCN-999").status_code == 404
    assert client.post(f"{API}/reconcile/inject/SCN-301").status_code == 200
    assert client.post(f"{API}/reconcile/inject/SCN-301").status_code == 409
    assert client.get(f"{API}/batches/current").json()["kpis"]["total_records"] == 16


def test_resolution_workflow_and_reset(client):
    client.post(f"{API}/reconcile/inject/SCN-301")
    body = {"resolution_note": "  Retention certificate requested.  ", "action": "FLAG_FOR_CREDIT_NOTE"}
    response = client.post(f"{API}/anomalies/TX-9301/resolve", json=body)
    assert response.status_code == 200, response.text
    state = response.json()
    record = next(r for r in state["records"] if r["tx_id"] == "TX-9301")
    assert record["status"] == "RESOLVED"
    assert record["resolution"]["action"] == "FLAG_FOR_CREDIT_NOTE"
    assert record["resolution"]["resolution_note"] == "Retention certificate requested."
    assert record["resolution"]["variance_gbp"] == -1800.0
    resolved_at = record["resolution"]["resolved_at"]
    assert resolved_at.endswith("Z") or "+00:00" in resolved_at
    assert (state["kpis"]["resolved_count"], state["kpis"]["anomaly_count"]) == (1, 3)

    # The audit entry is immutable: a second decision is refused and changes nothing.
    again = client.post(f"{API}/anomalies/TX-9301/resolve", json={**body, "action": "REJECT"})
    assert again.status_code == 409
    current = client.get(f"{API}/batches/current").json()
    kept = next(r for r in current["records"] if r["tx_id"] == "TX-9301")["resolution"]
    assert (kept["action"], kept["resolved_at"]) == ("FLAG_FOR_CREDIT_NOTE", resolved_at)
    # It also survives a later rule change.
    assert statuses(set_tolerance(client, 0, 0))["TX-9301"] == "RESOLVED"

    reset = client.post(f"{API}/reconcile/reset").json()
    assert reset["kpis"]["total_records"] == 15
    assert reset["kpis"]["resolved_count"] == 0
    assert reset["tolerance"] == reset["default_tolerance"]
    assert not any(s["active"] for s in reset["scenarios"])


def test_resolution_errors(client):
    ok = {"resolution_note": "Checked.", "action": "APPROVE_VARIANCE"}
    assert client.post(f"{API}/anomalies/TX-0000/resolve", json=ok).status_code == 404
    # Matched records are not anomalies and cannot be resolved.
    assert client.post(f"{API}/anomalies/TX-9001/resolve", json=ok).status_code == 409
    for bad in (
        {"resolution_note": "   ", "action": "APPROVE_VARIANCE"},
        {"resolution_note": "x" * 501, "action": "APPROVE_VARIANCE"},
        {"resolution_note": "Checked.", "action": "DELETE"},
        {"action": "REJECT"},
    ):
        assert client.post(f"{API}/anomalies/TX-9013/resolve", json=bad).status_code == 422
    assert client.get(f"{API}/batches/current").json()["kpis"]["resolved_count"] == 0
