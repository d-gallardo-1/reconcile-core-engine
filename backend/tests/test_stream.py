"""SSE stream: initial snapshot, live run progress, broadcast and heartbeat."""

from __future__ import annotations

import asyncio
import time

from fastapi.testclient import TestClient

from app.main import build_engine, create_app
from app.sse import event_stream

from .conftest import API, parse_sse


def test_stream_endpoint_delivers_initial_snapshot(client):
    client.post(f"{API}/reconcile/inject/SCN-303")

    with client.stream("GET", f"{API}/stream", params={"max_events": 1}) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers["x-accel-buffering"] == "no"
        body = "".join(response.iter_text())

    frames = [frame for frame in body.split("\n\n") if frame.strip()]
    assert frames[0] == "retry: 3000"
    event, data = parse_sse(frames[1])
    assert event == "snapshot"
    assert data["kpis"]["total_records"] == 16
    assert data["records"][-1]["anomaly_type"] == "ORPHAN_ERP_ACCRUAL"


def test_mutations_are_broadcast_to_every_subscriber(engine):
    async def scenario():
        first = event_stream(engine, heartbeat_seconds=0.05)
        second = event_stream(engine, heartbeat_seconds=0.05)
        for stream in (first, second):
            assert await anext(stream) == "retry: 3000\n\n"
            assert parse_sse(await anext(stream))[0] == "snapshot"
        assert engine.broadcaster.subscriber_count == 2

        engine.inject("SCN-302")
        for stream in (first, second):
            event, data = parse_sse(await anext(stream))
            assert event == "state_update"
            assert data["kpis"]["total_records"] == 16

        # Nothing published: the next frame is a heartbeat.
        assert parse_sse(await anext(first))[0] == "heartbeat"
        await first.aclose()
        await second.aclose()
        assert engine.broadcaster.subscriber_count == 0

    asyncio.run(scenario())


def test_live_run_streams_three_passes_in_order(engine):
    async def scenario():
        queue = engine.broadcaster.subscribe()
        started = engine.start_run()
        await engine.wait_for_run()
        events = []
        while not queue.empty():
            events.append(queue.get_nowait())
        return started, events

    started, events = asyncio.run(scenario())

    # Pass 1 visits 15 records, pass 2 the 6 left open, pass 3 the last 3.
    assert started.total == 15 + 6 + 3
    names = [event.name for event in events]
    assert names[0] == "state_update" and names[-1] == "state_update"
    progress = [parse_sse(f"event: p\ndata: {e.data}")[1] for e in events[1:-1]]
    assert [p["processed"] for p in progress] == list(range(1, 25))
    assert [p["pass_number"] for p in progress] == [1] * 15 + [2] * 6 + [3] * 3
    assert progress[-1]["percent"] == 100.0
    decided = {p["tx_id"]: p["classification"] for p in progress if p["decided"]}
    assert len(decided) == 15
    assert decided["TX-9001"] == "EXACT_MATCH"
    assert decided["TX-9010"] == "TOLERANCE_MATCH"
    assert decided["TX-9013"] == "ANOMALY"
    final = parse_sse(f"event: s\ndata: {events[-1].data}")[1]
    assert final["run"]["status"] == "COMPLETED"
    assert final["run"]["processed"] == 24


def test_run_endpoint_completes_and_then_accepts_changes():
    # The refusals during a run are covered without timing in test_review_fixes.
    engine = build_engine(step_seconds=0)
    with TestClient(create_app(engine)) as client:
        response = client.post(f"{API}/reconcile/run")
        assert response.status_code == 202
        assert response.json()["status"] == "RUNNING"

        deadline = time.monotonic() + 10
        run = client.get(f"{API}/batches/current").json()["run"]
        while run["status"] != "COMPLETED" and time.monotonic() < deadline:
            time.sleep(0.05)
            run = client.get(f"{API}/batches/current").json()["run"]
        assert run["status"] == "COMPLETED"
        assert (run["processed"], run["total"], run["percent"]) == (24, 24, 100.0)
        # Once finished, the batch accepts changes again.
        assert client.post(f"{API}/reconcile/reset").status_code == 200
