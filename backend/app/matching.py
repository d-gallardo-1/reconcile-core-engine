"""Deterministic 3-pass matching rules. Pure functions: no state, no I/O."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .models import (
    AnomalyType,
    Kpis,
    LedgerTransaction,
    MatchStatus,
    ReconciledRecord,
    TaxCheck,
    TaxStatus,
    ToleranceConfig,
    to_pennies,
)

PASS_NAMES = {
    1: "Exact Match",
    2: "Fuzzy / Tolerance Match",
    3: "Unreconciled Anomaly Detection",
}
ZERO = Decimal("0.00")


@dataclass(frozen=True)
class Verdict:
    status: MatchStatus
    matched_in_pass: int
    anomaly_type: AnomalyType | None
    explanation: str


def expected_vat(gross: Decimal, rate: Decimal) -> Decimal:
    """VAT contained in a gross amount, rounded to the penny."""
    return to_pennies(gross * rate / (Decimal(1) + rate))


def variance(tx: LedgerTransaction) -> Decimal:
    """Bank total minus ERP amount. A missing side counts as zero."""
    bank_total = (tx.bank_amount_gbp or ZERO) * tx.bank_settlement_count
    return to_pennies(bank_total - (tx.erp_amount_gbp or ZERO))


def date_shift_days(tx: LedgerTransaction) -> int | None:
    if tx.erp_date is None or tx.bank_date is None:
        return None
    return (tx.bank_date - tx.erp_date).days


def tax_check(tx: LedgerTransaction) -> TaxCheck:
    if tx.tax_status is TaxStatus.CERTIFICATE_MISSING:
        return TaxCheck.CERTIFICATE_MISSING
    if tx.tax_status is TaxStatus.NOT_REGISTERED:
        return TaxCheck.NOT_REGISTERED
    if tx.erp_amount_gbp is None or tx.vat_rate is None:
        return TaxCheck.VERIFIED
    if tx.tax_vat_amount_gbp != expected_vat(tx.erp_amount_gbp, tx.vat_rate):
        return TaxCheck.VAT_MISMATCH
    return TaxCheck.VERIFIED


def _three_way_complete(tx: LedgerTransaction) -> bool:
    """All three sources hold exactly one consistent entry for the invoice."""
    return (
        tx.erp_amount_gbp is not None
        and tx.bank_amount_gbp is not None
        and tx.bank_settlement_count == 1
        and tax_check(tx) is TaxCheck.VERIFIED
    )


def pass_exact(tx: LedgerTransaction) -> Verdict | None:
    """Pass 1: identical amount and settlement date, tax registry verified."""
    if _three_way_complete(tx) and variance(tx) == ZERO and date_shift_days(tx) == 0:
        return Verdict(
            MatchStatus.EXACT_MATCH, 1, None,
            "ERP, bank and tax registry agree on amount, VAT and settlement date.",
        )
    return None


def pass_tolerance(tx: LedgerTransaction, tolerance: ToleranceConfig) -> Verdict | None:
    """Pass 2: differences inside the configured amount and date tolerances."""
    if not _three_way_complete(tx):
        return None
    delta, shift = variance(tx), date_shift_days(tx) or 0
    if abs(delta) > tolerance.amount_tolerance_gbp or abs(shift) > tolerance.date_window_days:
        return None
    parts = []
    if delta != ZERO:
        parts.append(f"amount variance {delta:+.2f} GBP")
    if shift:
        parts.append(f"settlement shifted {shift:+d} day(s)")
    return Verdict(
        MatchStatus.TOLERANCE_MATCH, 2, None,
        f"Auto-matched within tolerance: {' and '.join(parts)}.",
    )


def pass_anomaly(tx: LedgerTransaction, tolerance: ToleranceConfig) -> Verdict:
    """Pass 3: everything left over is an anomaly; name the most specific cause."""
    delta, shift, check = variance(tx), date_shift_days(tx), tax_check(tx)
    if tx.erp_amount_gbp is None:
        kind = AnomalyType.UNBOOKED_BANK_DEBIT
        why = "Bank debit cleared with no matching ERP entry or VAT receipt."
    elif tx.bank_amount_gbp is None or tx.bank_settlement_count == 0:
        kind = AnomalyType.ORPHAN_ERP_ACCRUAL
        why = "Recorded in the ERP ledger but no settlement found in the bank feed."
    elif tx.bank_settlement_count > 1:
        kind = AnomalyType.DUPLICATE_SETTLEMENT
        why = (
            f"Settled {tx.bank_settlement_count} times in the bank feed against "
            f"one ERP entry ({delta:+.2f} GBP overpayment exposure)."
        )
    elif check is TaxCheck.CERTIFICATE_MISSING:
        kind = AnomalyType.WITHHOLDING_GAP
        why = (
            f"Bank settled {delta:+.2f} GBP against the ERP amount and the tax "
            "registry holds no retention certificate."
        )
    elif check is TaxCheck.NOT_REGISTERED:
        kind = AnomalyType.MISSING_TAX_RECORD
        why = "Invoice is missing from the tax/VAT registry."
    elif check is TaxCheck.VAT_MISMATCH:
        kind = AnomalyType.VAT_MISMATCH
        why = "VAT recorded in the tax registry differs from the ERP VAT rate."
    elif abs(delta) > tolerance.amount_tolerance_gbp:
        kind = AnomalyType.AMOUNT_VARIANCE
        why = (
            f"Amount variance {delta:+.2f} GBP exceeds the "
            f"{tolerance.amount_tolerance_gbp:.2f} GBP tolerance."
        )
    else:
        kind = AnomalyType.SETTLEMENT_DATE_SHIFT
        why = (
            f"Settlement shifted {shift:+d} day(s), outside the "
            f"{tolerance.date_window_days}-day window."
        )
    return Verdict(MatchStatus.ANOMALY, 3, kind, why)


def classify(tx: LedgerTransaction, tolerance: ToleranceConfig) -> Verdict:
    return pass_exact(tx) or pass_tolerance(tx, tolerance) or pass_anomaly(tx, tolerance)


def reconcile(tx: LedgerTransaction, tolerance: ToleranceConfig) -> ReconciledRecord:
    verdict = classify(tx, tolerance)
    return ReconciledRecord(
        **tx.model_dump(),
        status=verdict.status,
        matched_in_pass=verdict.matched_in_pass,
        anomaly_type=verdict.anomaly_type,
        variance_gbp=variance(tx),
        date_shift_days=date_shift_days(tx),
        tax_check=tax_check(tx),
        explanation=verdict.explanation,
    )


def compute_kpis(records: list[ReconciledRecord]) -> Kpis:
    def count(status: MatchStatus) -> int:
        return sum(1 for record in records if record.status is status)

    open_variances = [r.variance_gbp for r in records if r.status is MatchStatus.ANOMALY]
    matched = count(MatchStatus.EXACT_MATCH) + count(MatchStatus.TOLERANCE_MATCH)
    return Kpis(
        total_records=len(records),
        total_ledger_volume_gbp=sum((r.erp_amount_gbp or ZERO for r in records), ZERO),
        exact_count=count(MatchStatus.EXACT_MATCH),
        tolerance_count=count(MatchStatus.TOLERANCE_MATCH),
        anomaly_count=count(MatchStatus.ANOMALY),
        resolved_count=count(MatchStatus.RESOLVED),
        match_rate_pct=round(100 * matched / len(records), 1) if records else 0.0,
        net_unreconciled_variance_gbp=sum(open_variances, ZERO),
        gross_unreconciled_exposure_gbp=sum((abs(v) for v in open_variances), ZERO),
    )
