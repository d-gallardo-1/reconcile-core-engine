"""Shared fixtures. Live runs use a zero step delay so tests stay fast."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.engine import ReconciliationEngine
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
