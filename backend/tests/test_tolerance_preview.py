"""Tolerance preview: what a rule change would do, without applying it."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import build_engine, create_app

from .conftest import API, statuses


def preview(client, amount, days):
    body = {"amount_tolerance": amount, "date_window_days": days}
    return client.post(f"{API}/reconcile/tolerance/preview", json=body)


def test_preview_reports_the_change_without_applying_it(client):
    before = client.get(f"{API}/batches/current").json()

    response = preview(client, 0, 0)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["tolerance"] == {"amount_tolerance": 0.0, "date_window_days": 0}
    # The three tolerance cases would stop matching; nothing new would match.
    assert body["newly_matched"] == []
    assert body["newly_unmatched"] == ["TX-9010", "TX-9011", "TX-9012"]
    assert (body["exact_count"], body["tolerance_count"], body["anomaly_count"]) == (9, 0, 6)
    assert body["match_rate_pct"] == 60.0

    after = client.get(f"{API}/batches/current").json()
    assert after["tolerance"] == before["tolerance"]
    assert statuses(after) == statuses(before)
    assert after["sequence"] == before["sequence"]  # nothing was published either


def test_preview_lists_records_that_would_start_matching(client):
    client.post(f"{API}/reconcile/tolerance", json={"amount_tolerance": 0, "date_window_days": 0})

    body = preview(client, 15, 1).json()

    assert body["newly_matched"] == ["TX-9010", "TX-9012"]  # TX-9011 needs a 2-day window
    assert body["newly_unmatched"] == []
    assert body["tolerance_count"] == 2


def test_preview_of_the_current_rules_changes_nothing(client):
    body = preview(client, 15, 2).json()
    assert (body["newly_matched"], body["newly_unmatched"]) == ([], [])
    assert (body["exact_count"], body["tolerance_count"], body["anomaly_count"]) == (9, 3, 3)


def test_a_resolved_record_is_never_reported_as_changing(client):
    client.post(f"{API}/reconcile/tolerance", json={"amount_tolerance": 0, "date_window_days": 0})
    note = {"resolution_note": "Fee accepted.", "action": "APPROVE_VARIANCE"}
    assert client.post(f"{API}/anomalies/TX-9010/resolve", json=note).status_code == 200

    body = preview(client, 15, 2).json()

    # An auditor's decision is final, so widening the rules does not "match" it.
    assert body["newly_matched"] == ["TX-9011", "TX-9012"]
    assert body["resolved_count"] == 1


@pytest.mark.parametrize(
    ("amount", "days", "status", "code"),
    [
        (50.01, 2, 422, "TOLERANCE_OUT_OF_RANGE"),
        (-1, 2, 422, None),
        (15, 6, 422, None),
    ],
)
def test_preview_validates_like_the_real_change(client, amount, days, status, code):
    response = preview(client, amount, days)
    assert response.status_code == status
    if code:
        assert response.json()["code"] == code


def test_preview_respects_the_decimals_of_the_batch_currency(client):
    client.post(f"{API}/batches/currency", json={"currency": "JPY"})
    refused = preview(client, 1500.5, 2)
    assert (refused.status_code, refused.json()["code"]) == (422, "TOLERANCE_DECIMALS")
    assert preview(client, 0, 2).json()["newly_unmatched"] == ["TX-9010", "TX-9012"]


def test_preview_is_allowed_during_a_run_because_it_changes_nothing():
    engine = build_engine(step_seconds=30)
    with TestClient(create_app(engine)) as client:
        client.post(f"{API}/reconcile/run")
        assert preview(client, 0, 0).status_code == 200
        # Applying is still refused while the run is in progress.
        body = {"amount_tolerance": 0, "date_window_days": 0}
        assert client.post(f"{API}/reconcile/tolerance", json=body).status_code == 409
