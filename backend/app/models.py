"""Data contracts shared by the engine, the Excel round trip and the API."""

from __future__ import annotations

from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from enum import Enum
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, PlainSerializer

PENNY = Decimal("0.01")


def to_pennies(value: Decimal) -> Decimal:
    return value.quantize(PENNY, rounding=ROUND_HALF_UP)


#: Currency amounts are exact decimals inside the engine (no float drift in
#: variances) and plain JSON numbers on the wire.
Money = Annotated[
    Decimal,
    AfterValidator(to_pennies),
    PlainSerializer(float, return_type=float, when_used="json"),
]
Rate = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used="json")]


class MatchStatus(str, Enum):
    EXACT_MATCH = "EXACT_MATCH"
    TOLERANCE_MATCH = "TOLERANCE_MATCH"
    ANOMALY = "ANOMALY"
    RESOLVED = "RESOLVED"


class AnomalyType(str, Enum):
    AMOUNT_VARIANCE = "AMOUNT_VARIANCE"
    SETTLEMENT_DATE_SHIFT = "SETTLEMENT_DATE_SHIFT"
    VAT_MISMATCH = "VAT_MISMATCH"
    MISSING_TAX_RECORD = "MISSING_TAX_RECORD"
    WITHHOLDING_GAP = "WITHHOLDING_GAP"
    DUPLICATE_SETTLEMENT = "DUPLICATE_SETTLEMENT"
    ORPHAN_ERP_ACCRUAL = "ORPHAN_ERP_ACCRUAL"
    UNBOOKED_BANK_DEBIT = "UNBOOKED_BANK_DEBIT"


class TaxStatus(str, Enum):
    """What Source C (the tax/VAT registry) holds for the invoice."""

    REGISTERED = "REGISTERED"
    CERTIFICATE_MISSING = "CERTIFICATE_MISSING"
    NOT_REGISTERED = "NOT_REGISTERED"


class TaxCheck(str, Enum):
    """Result of comparing Source C with the ERP entry."""

    VERIFIED = "VERIFIED"
    VAT_MISMATCH = "VAT_MISMATCH"
    CERTIFICATE_MISSING = "CERTIFICATE_MISSING"
    NOT_REGISTERED = "NOT_REGISTERED"


class ResolutionAction(str, Enum):
    APPROVE_VARIANCE = "APPROVE_VARIANCE"
    FLAG_FOR_CREDIT_NOTE = "FLAG_FOR_CREDIT_NOTE"
    REJECT = "REJECT"


class RunStatus(str, Enum):
    IDLE = "IDLE"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"


class LedgerTransaction(BaseModel):
    """One invoice or payment as seen by the three sources (one input row)."""

    model_config = ConfigDict(frozen=True)

    tx_id: str = Field(min_length=1, max_length=32)
    invoice_ref: str = Field(min_length=1, max_length=64)
    counterparty: str = Field(min_length=1, max_length=120)
    # Source A: ERP general ledger (gross amount, VAT included).
    erp_amount_gbp: Money | None = None
    erp_date: date | None = None
    vat_rate: Rate | None = None
    # Source B: bank settlement feed. The amount is per settlement.
    bank_amount_gbp: Money | None = None
    bank_date: date | None = None
    bank_settlement_count: int = Field(default=0, ge=0, le=9)
    # Source C: tax/VAT registry.
    tax_status: TaxStatus = TaxStatus.NOT_REGISTERED
    tax_vat_amount_gbp: Money | None = None
    scenario_code: str | None = Field(default=None, max_length=16)


class ToleranceConfig(BaseModel):
    amount_tolerance_gbp: Money
    date_window_days: int


class Resolution(BaseModel):
    action: ResolutionAction
    resolution_note: str
    resolved_at: datetime
    anomaly_type: AnomalyType
    variance_gbp: Money


class ReconciledRecord(LedgerTransaction):
    """An input row plus the verdict of the 3-pass pipeline."""

    status: MatchStatus
    matched_in_pass: int
    anomaly_type: AnomalyType | None = None
    variance_gbp: Money
    date_shift_days: int | None = None
    tax_check: TaxCheck
    explanation: str
    resolution: Resolution | None = None


class Kpis(BaseModel):
    total_records: int
    total_ledger_volume_gbp: Money
    exact_count: int
    tolerance_count: int
    anomaly_count: int
    resolved_count: int
    match_rate_pct: float
    net_unreconciled_variance_gbp: Money
    gross_unreconciled_exposure_gbp: Money


class ScenarioInfo(BaseModel):
    code: str
    anomaly_type: AnomalyType
    label: str
    description: str
    tx_id: str
    active: bool


class RunState(BaseModel):
    run_id: int = 0
    status: RunStatus = RunStatus.IDLE
    processed: int = 0
    total: int = 0
    percent: float = 0.0
    pass_number: int = 0
    started_at: datetime | None = None
    completed_at: datetime | None = None


class ReconciliationProgress(BaseModel):
    """One step of a live run: a record visited by one of the three passes."""

    run_id: int
    status: RunStatus
    pass_number: int
    pass_name: str
    processed: int
    total: int
    percent: float
    tx_id: str | None = None
    decided: bool = False
    classification: MatchStatus | None = None


class BatchState(BaseModel):
    """Full snapshot sent by ``/batches/current`` and by every SSE state event."""

    entity: str
    batch_id: str
    data_notice: str
    sequence: int
    generated_at: datetime
    tolerance: ToleranceConfig
    default_tolerance: ToleranceConfig
    kpis: Kpis
    records: list[ReconciledRecord]
    scenarios: list[ScenarioInfo]
    run: RunState
