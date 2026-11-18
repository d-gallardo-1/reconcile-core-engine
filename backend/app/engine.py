"""Stateful reconciliation engine (orchestrator).

Holds the active batch in memory, applies the pure rules from ``matching`` and
broadcasts every change. The process must run with a single worker so that all
clients share this one state.
"""

from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Callable

from . import config
from .live_run import LiveRun
from .matching import compute_kpis, reconcile
from .mock_ledgers import Scenario
from .models import (
    BatchState,
    LedgerTransaction,
    MatchStatus,
    ReconciledRecord,
    Resolution,
    ResolutionAction,
    RunState,
    ScenarioInfo,
    ToleranceConfig,
)
from .pubsub import Broadcaster, StreamEvent


class EngineError(Exception):
    """Base class; the API layer maps subclasses to HTTP status codes."""


class NotFoundError(EngineError):
    pass


class ConflictError(EngineError):
    pass


def default_tolerance() -> ToleranceConfig:
    return ToleranceConfig(
        amount_tolerance_gbp=config.DEFAULT_AMOUNT_TOLERANCE_GBP,
        date_window_days=config.DEFAULT_DATE_WINDOW_DAYS,
    )


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ReconciliationEngine:
    def __init__(
        self,
        *,
        entity: str,
        batch_id: str,
        data_notice: str,
        transactions: list[LedgerTransaction],
        scenarios: dict[str, Scenario],
        step_seconds: float = config.DEFAULT_STEP_SECONDS,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._entity, self._batch_id, self._data_notice = entity, batch_id, data_notice
        self._base = list(transactions)
        self._scenarios = scenarios
        self._clock = clock
        self._broadcaster = Broadcaster()
        self._sequence = 0
        self._live = LiveRun(
            step_seconds=step_seconds,
            clock=clock,
            publish_progress=lambda data: self._broadcaster.publish(
                StreamEvent("reconciliation_progress", self._sequence, data)
            ),
            publish_state=self.publish_state,
        )
        self._load_defaults()

    def _load_defaults(self) -> None:
        self._transactions = list(self._base)
        self._tolerance = default_tolerance()
        self._resolutions: dict[str, Resolution] = {}

    # --- read side ---------------------------------------------------------

    @property
    def broadcaster(self) -> Broadcaster:
        return self._broadcaster

    @property
    def transactions(self) -> list[LedgerTransaction]:
        return list(self._transactions)

    def records(self) -> list[ReconciledRecord]:
        records = []
        for tx in self._transactions:
            record = reconcile(tx, self._tolerance)
            resolution = self._resolutions.get(tx.tx_id)
            if resolution is not None:
                # An auditor's decision is final: it survives later rule changes.
                record = record.model_copy(
                    update={"status": MatchStatus.RESOLVED, "resolution": resolution}
                )
            records.append(record)
        return records

    def snapshot(self) -> BatchState:
        records = self.records()
        active = {tx.scenario_code for tx in self._transactions}
        return BatchState(
            entity=self._entity,
            batch_id=self._batch_id,
            data_notice=self._data_notice,
            sequence=self._sequence,
            generated_at=self._clock(),
            tolerance=self._tolerance,
            default_tolerance=default_tolerance(),
            kpis=compute_kpis(records),
            records=records,
            scenarios=[
                ScenarioInfo(
                    code=s.code, anomaly_type=s.anomaly_type, label=s.label,
                    description=s.description, tx_id=s.transaction.tx_id,
                    active=s.code in active,
                )
                for s in self._scenarios.values()
            ],
            run=self._live.state,
        )

    # --- write side --------------------------------------------------------

    def publish_state(self) -> BatchState:
        self._sequence += 1
        state = self.snapshot()
        self._broadcaster.publish(
            StreamEvent("state_update", self._sequence, state.model_dump_json())
        )
        return state

    def _require_idle(self) -> None:
        if self._live.is_running:
            raise ConflictError("A reconciliation run is in progress. Wait for it to finish.")

    def set_tolerance(self, amount_tolerance_gbp: Decimal, date_window_days: int) -> BatchState:
        self._require_idle()
        self._tolerance = ToleranceConfig(
            amount_tolerance_gbp=amount_tolerance_gbp, date_window_days=date_window_days
        )
        return self.publish_state()

    def inject(self, scenario_code: str) -> BatchState:
        scenario = self._scenarios.get(scenario_code.upper())
        if scenario is None:
            raise NotFoundError(f"Unknown scenario code: {scenario_code}.")
        self._require_idle()
        if any(tx.tx_id == scenario.transaction.tx_id for tx in self._transactions):
            raise ConflictError(f"Scenario {scenario.code} is already active in this batch.")
        self._transactions.append(scenario.transaction)
        return self.publish_state()

    def reset(self) -> BatchState:
        self._require_idle()
        self._load_defaults()
        self._live.clear()
        return self.publish_state()

    def resolve(self, tx_id: str, action: ResolutionAction, note: str) -> BatchState:
        self._require_idle()  # a run replays verdicts computed when it started
        record = next((r for r in self.records() if r.tx_id == tx_id), None)
        if record is None:
            raise NotFoundError(f"Unknown transaction: {tx_id}.")
        if record.status is MatchStatus.RESOLVED:
            raise ConflictError(f"{tx_id} is already resolved; audit entries are immutable.")
        if record.status is not MatchStatus.ANOMALY or record.anomaly_type is None:
            raise ConflictError(f"{tx_id} is not an open anomaly.")
        self._resolutions[tx_id] = Resolution(
            action=action,
            resolution_note=note,
            resolved_at=self._clock(),
            anomaly_type=record.anomaly_type,
            variance_gbp=record.variance_gbp,
        )
        return self.publish_state()

    # --- live run ----------------------------------------------------------

    def start_run(self) -> RunState:
        self._require_idle()
        return self._live.start(self.records())

    async def wait_for_run(self) -> None:
        await self._live.wait()

    async def shutdown(self) -> None:
        await self._live.shutdown()
