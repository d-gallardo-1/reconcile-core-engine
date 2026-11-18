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
from .batch_models import BatchState, CurrencyInfo, default_tolerance, scenario_infos
from .currencies import DEFAULT_CURRENCY, Currency, UnknownCurrencyError, get_currency
from .errors import ConflictError, InvalidRequestError, NotFoundError, run_in_progress
from .tolerance import check_tolerance
from .kpis import compute_kpis
from .live_run import LiveRun
from .matching import reconcile
from .mock_ledgers import Scenario
from .models import (
    LedgerTransaction,
    MatchStatus,
    ReconciledRecord,
    Resolution,
    ResolutionAction,
    RunState,
    ToleranceConfig,
)
from .pubsub import Broadcaster, StreamEvent
from .resolutions import build_resolution

BatchLoader = Callable[[str], list[LedgerTransaction]]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ReconciliationEngine:
    def __init__(
        self,
        *,
        entity: str,
        batch_id: str,
        data_notice: str,
        load_batch: BatchLoader,
        scenarios: dict[str, Scenario],
        currency: str = DEFAULT_CURRENCY,
        step_seconds: float = config.DEFAULT_STEP_SECONDS,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._entity, self._batch_id, self._data_notice = entity, batch_id, data_notice
        self._load_batch = load_batch
        self._scenarios = scenarios
        self._currency = get_currency(currency)
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
        self._load_defaults(self._currency)

    def _load_defaults(self, currency: Currency) -> None:
        """Switch to the default batch and rules in ``currency``.

        The batch is loaded before anything is assigned, so a loader failure
        leaves the engine exactly as it was.
        """
        transactions = self._load_batch(currency.code)
        self._currency = currency
        self._transactions = transactions
        self._tolerance = default_tolerance(currency.code)
        self._resolutions: dict[str, Resolution] = {}

    # --- read side ---------------------------------------------------------

    @property
    def broadcaster(self) -> Broadcaster:
        return self._broadcaster

    @property
    def currency_code(self) -> str:
        return self._currency.code

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
            currency=CurrencyInfo.of(self._currency),
            tolerance=self._tolerance,
            default_tolerance=default_tolerance(self._currency.code),
            kpis=compute_kpis(records),
            records=records,
            scenarios=scenario_infos(self._scenarios.values(), active),
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
            raise run_in_progress()

    def set_currency(self, currency_code: str) -> BatchState:
        """Load the default batch in another currency. Resolutions do not carry over."""
        try:
            currency = get_currency(currency_code)
        except UnknownCurrencyError as error:
            raise InvalidRequestError("UNKNOWN_CURRENCY", str(error)) from None
        self._require_idle()
        self._load_defaults(currency)
        self._live.clear()
        return self.publish_state()

    def set_tolerance(self, amount_tolerance: Decimal, date_window_days: int) -> BatchState:
        check_tolerance(self._currency, amount_tolerance)
        self._require_idle()
        self._tolerance = ToleranceConfig(
            amount_tolerance=amount_tolerance, date_window_days=date_window_days
        )
        return self.publish_state()

    def inject(self, scenario_code: str) -> BatchState:
        scenario = self._scenarios.get(scenario_code.upper())
        if scenario is None:
            raise NotFoundError("UNKNOWN_SCENARIO", f"Unknown scenario code: {scenario_code}.")
        self._require_idle()
        if any(tx.tx_id == scenario.tx_id for tx in self._transactions):
            raise ConflictError(
                "SCENARIO_ACTIVE", f"Scenario {scenario.code} is already active in this batch."
            )
        self._transactions.append(scenario.transaction(self._currency.code))
        return self.publish_state()

    def reset(self) -> BatchState:
        self._require_idle()
        self._load_defaults(self._currency)
        self._live.clear()
        return self.publish_state()

    def resolve(self, tx_id: str, action: ResolutionAction, note: str) -> BatchState:
        self._require_idle()  # a run replays verdicts computed when it started
        record = next((r for r in self.records() if r.tx_id == tx_id), None)
        self._resolutions[tx_id] = build_resolution(record, tx_id, action, note, self._clock())
        return self.publish_state()

    # --- live run ----------------------------------------------------------

    def start_run(self) -> RunState:
        self._require_idle()
        return self._live.start(self.records())

    async def wait_for_run(self) -> None:
        await self._live.wait()

    async def shutdown(self) -> None:
        await self._live.shutdown()
