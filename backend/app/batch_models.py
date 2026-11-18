"""Models of the batch snapshot sent to clients."""

from __future__ import annotations

from datetime import datetime
from typing import Iterable

from pydantic import BaseModel

from . import config
from .currencies import CURRENCIES, DEFAULT_CURRENCY, Currency, get_currency
from .models import (
    AnomalyType,
    Money,
    ReconciledRecord,
    RunState,
    ToleranceConfig,
)


class Kpis(BaseModel):
    total_records: int
    total_ledger_volume: Money
    exact_count: int
    tolerance_count: int
    anomaly_count: int
    resolved_count: int
    match_rate_pct: float
    net_unreconciled_variance: Money
    gross_unreconciled_exposure: Money


class ScenarioInfo(BaseModel):
    code: str
    anomaly_type: AnomalyType
    label: str
    description: str
    tx_id: str
    active: bool


class CurrencyInfo(BaseModel):
    """The batch currency and the tolerance range that makes sense in it."""

    code: str
    minor_units: int
    max_amount_tolerance: Money
    amount_tolerance_step: Money

    @classmethod
    def of(cls, currency: Currency) -> CurrencyInfo:
        return cls(
            code=currency.code,
            minor_units=currency.minor_units,
            max_amount_tolerance=currency.max_tolerance,
            # One hundredth of the range, so the slider has the same feel everywhere.
            amount_tolerance_step=currency.max_tolerance / 100,
        )


class BatchState(BaseModel):
    """Full snapshot sent by ``/batches/current`` and by every SSE state event."""

    entity: str
    batch_id: str
    data_notice: str
    sequence: int
    generated_at: datetime
    currency: CurrencyInfo
    available_currencies: list[str] = list(CURRENCIES)
    tolerance: ToleranceConfig
    default_tolerance: ToleranceConfig
    kpis: Kpis
    records: list[ReconciledRecord]
    scenarios: list[ScenarioInfo]
    run: RunState


def default_tolerance(currency_code: str = DEFAULT_CURRENCY) -> ToleranceConfig:
    return ToleranceConfig(
        amount_tolerance=get_currency(currency_code).default_tolerance,
        date_window_days=config.DEFAULT_DATE_WINDOW_DAYS,
    )


def scenario_infos(scenarios: Iterable, active_codes: set) -> list[ScenarioInfo]:
    return [
        ScenarioInfo(
            code=s.code, anomaly_type=s.anomaly_type, label=s.label,
            description=s.description, tx_id=s.tx_id, active=s.code in active_codes,
        )
        for s in scenarios
    ]
