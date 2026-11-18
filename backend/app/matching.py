"""Deterministic 3-pass matching rules. Pure functions: no state, no I/O."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from .currencies import get_currency
from .explanations import ExplanationCode as Code
from .explanations import Params, json_params, render
from .models import (
    AnomalyType,
    LedgerTransaction,
    MatchStatus,
    ReconciledRecord,
    TaxCheck,
    TaxStatus,
    ToleranceConfig,
)

PASS_NAMES = {
    1: "Exact Match",
    2: "Fuzzy / Tolerance Match",
    3: "Unreconciled Anomaly Detection",
}
ZERO = Decimal(0)


@dataclass(frozen=True)
class Verdict:
    status: MatchStatus
    matched_in_pass: int
    anomaly_type: AnomalyType | None
    code: Code
    params: Params = field(default_factory=dict)


def expected_vat(gross: Decimal, rate: Decimal, currency_code: str) -> Decimal:
    """VAT contained in a gross amount, rounded to the currency's smallest unit."""
    return get_currency(currency_code).round(gross * rate / (Decimal(1) + rate))


def variance(tx: LedgerTransaction) -> Decimal:
    """Bank total minus ERP amount. A missing side counts as zero."""
    bank_total = (tx.bank_amount or ZERO) * tx.bank_settlement_count
    return bank_total - (tx.erp_amount or ZERO)


def date_shift_days(tx: LedgerTransaction) -> int | None:
    if tx.erp_date is None or tx.bank_date is None:
        return None
    return (tx.bank_date - tx.erp_date).days


def tax_check(tx: LedgerTransaction) -> TaxCheck:
    if tx.tax_status is TaxStatus.CERTIFICATE_MISSING:
        return TaxCheck.CERTIFICATE_MISSING
    if tx.tax_status is TaxStatus.NOT_REGISTERED:
        return TaxCheck.NOT_REGISTERED
    if tx.erp_amount is None:
        return TaxCheck.VERIFIED  # nothing to compare; pass 3 reports the missing ERP entry
    if tx.vat_rate is None:
        return TaxCheck.RATE_MISSING  # nothing can be checked without a rate
    if tx.tax_vat_amount != expected_vat(tx.erp_amount, tx.vat_rate, tx.currency):
        return TaxCheck.VAT_MISMATCH
    return TaxCheck.VERIFIED


def _three_way_complete(tx: LedgerTransaction) -> bool:
    """All three sources hold exactly one consistent, dated entry for the invoice."""
    return (
        tx.erp_amount is not None
        and tx.bank_amount is not None
        and tx.erp_date is not None
        and tx.bank_date is not None
        and tx.bank_settlement_count == 1
        and tax_check(tx) is TaxCheck.VERIFIED
    )


def pass_exact(tx: LedgerTransaction) -> Verdict | None:
    """Pass 1: identical amount and settlement date, tax registry verified."""
    if _three_way_complete(tx) and variance(tx) == ZERO and date_shift_days(tx) == 0:
        return Verdict(MatchStatus.EXACT_MATCH, 1, None, Code.EXACT)
    return None


def pass_tolerance(tx: LedgerTransaction, tolerance: ToleranceConfig) -> Verdict | None:
    """Pass 2: differences inside the configured amount and date tolerances."""
    if not _three_way_complete(tx):
        return None
    delta, shift = variance(tx), date_shift_days(tx) or 0
    if abs(delta) > tolerance.amount_tolerance or abs(shift) > tolerance.date_window_days:
        return None
    if delta != ZERO and shift:
        code, params = Code.TOLERANCE_AMOUNT_AND_DATE, json_params(delta=delta, shift=shift)
    elif shift:
        code, params = Code.TOLERANCE_DATE, json_params(shift=shift)
    else:
        code, params = Code.TOLERANCE_AMOUNT, json_params(delta=delta)
    return Verdict(MatchStatus.TOLERANCE_MATCH, 2, None, code, params)


def pass_anomaly(tx: LedgerTransaction, tolerance: ToleranceConfig) -> Verdict:
    """Pass 3: everything left over is an anomaly; name the first cause that applies.

    Order: structural causes, registry causes, a missing VAT rate, an amount
    outside tolerance, a missing date, and last a date outside the window.
    """
    delta, shift, check = variance(tx), date_shift_days(tx), tax_check(tx)
    kind: AnomalyType
    params: Params = {}
    if tx.erp_amount is None:
        kind, code = AnomalyType.UNBOOKED_BANK_DEBIT, Code.UNBOOKED_BANK_DEBIT
    elif tx.bank_amount is None or tx.bank_settlement_count == 0:
        kind, code = AnomalyType.ORPHAN_ERP_ACCRUAL, Code.ORPHAN_ERP_ACCRUAL
    elif tx.bank_settlement_count > 1:
        kind, code = AnomalyType.DUPLICATE_SETTLEMENT, Code.DUPLICATE_SETTLEMENT
        params = json_params(count=tx.bank_settlement_count, delta=delta)
    elif check is TaxCheck.CERTIFICATE_MISSING:
        kind, code = AnomalyType.WITHHOLDING_GAP, Code.WITHHOLDING_GAP
        params = json_params(delta=delta)
    elif check is TaxCheck.NOT_REGISTERED:
        kind, code = AnomalyType.MISSING_TAX_RECORD, Code.MISSING_TAX_RECORD
    elif check is TaxCheck.VAT_MISMATCH:
        kind, code = AnomalyType.VAT_MISMATCH, Code.VAT_MISMATCH
    elif check is TaxCheck.RATE_MISSING:
        kind, code = AnomalyType.INCOMPLETE_SOURCE_DATA, Code.VAT_RATE_MISSING
    elif abs(delta) > tolerance.amount_tolerance:
        kind, code = AnomalyType.AMOUNT_VARIANCE, Code.AMOUNT_OUTSIDE_TOLERANCE
        params = json_params(delta=delta, tolerance=tolerance.amount_tolerance)
    elif shift is None:
        kind, code = AnomalyType.INCOMPLETE_SOURCE_DATA, Code.DATE_MISSING
    else:
        kind, code = AnomalyType.SETTLEMENT_DATE_SHIFT, Code.DATE_OUTSIDE_WINDOW
        params = json_params(shift=shift, window=tolerance.date_window_days)
    return Verdict(MatchStatus.ANOMALY, 3, kind, code, params)


def classify(tx: LedgerTransaction, tolerance: ToleranceConfig) -> Verdict:
    return pass_exact(tx) or pass_tolerance(tx, tolerance) or pass_anomaly(tx, tolerance)


def reconcile(tx: LedgerTransaction, tolerance: ToleranceConfig) -> ReconciledRecord:
    verdict = classify(tx, tolerance)
    return ReconciledRecord(
        **tx.model_dump(),
        status=verdict.status,
        matched_in_pass=verdict.matched_in_pass,
        anomaly_type=verdict.anomaly_type,
        variance=variance(tx),
        date_shift_days=date_shift_days(tx),
        tax_check=tax_check(tx),
        explanation=render(verdict.code, verdict.params, get_currency(tx.currency)),
        explanation_code=verdict.code.value,
        explanation_params=verdict.params,
    )
