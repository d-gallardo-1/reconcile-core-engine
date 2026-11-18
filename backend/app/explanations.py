"""Verdict explanations as stable codes plus parameters.

The UI translates a code into the user's language. The English sentence built
here is the fallback and the text written to the Excel audit pack.
"""

from __future__ import annotations

from decimal import Decimal
from enum import Enum

from .currencies import Currency

Params = dict[str, float | int | str]


class ExplanationCode(str, Enum):
    EXACT = "EXACT"
    TOLERANCE_AMOUNT = "TOLERANCE_AMOUNT"
    TOLERANCE_DATE = "TOLERANCE_DATE"
    TOLERANCE_AMOUNT_AND_DATE = "TOLERANCE_AMOUNT_AND_DATE"
    UNBOOKED_BANK_DEBIT = "UNBOOKED_BANK_DEBIT"
    ORPHAN_ERP_ACCRUAL = "ORPHAN_ERP_ACCRUAL"
    DUPLICATE_SETTLEMENT = "DUPLICATE_SETTLEMENT"
    WITHHOLDING_GAP = "WITHHOLDING_GAP"
    MISSING_TAX_RECORD = "MISSING_TAX_RECORD"
    VAT_MISMATCH = "VAT_MISMATCH"
    VAT_RATE_MISSING = "VAT_RATE_MISSING"
    AMOUNT_OUTSIDE_TOLERANCE = "AMOUNT_OUTSIDE_TOLERANCE"
    DATE_MISSING = "DATE_MISSING"
    DATE_OUTSIDE_WINDOW = "DATE_OUTSIDE_WINDOW"


_C = ExplanationCode

#: Placeholders: {delta} and {tolerance} are amounts, {shift}, {window} and
#: {count} are whole numbers.
_TEMPLATES: dict[ExplanationCode, str] = {
    _C.EXACT: "ERP, bank and tax registry agree on amount, VAT and settlement date.",
    _C.TOLERANCE_AMOUNT: "Auto-matched within tolerance: amount variance {delta}.",
    _C.TOLERANCE_DATE: "Auto-matched within tolerance: settlement shifted {shift} day(s).",
    _C.TOLERANCE_AMOUNT_AND_DATE: (
        "Auto-matched within tolerance: amount variance {delta} and settlement "
        "shifted {shift} day(s)."
    ),
    _C.UNBOOKED_BANK_DEBIT: "Bank debit cleared with no matching ERP entry or VAT receipt.",
    _C.ORPHAN_ERP_ACCRUAL: "Recorded in the ERP ledger but no settlement found in the bank feed.",
    _C.DUPLICATE_SETTLEMENT: (
        "Settled {count} times in the bank feed against one ERP entry "
        "({delta} overpayment exposure)."
    ),
    _C.WITHHOLDING_GAP: (
        "Bank settled {delta} against the ERP amount and the tax registry holds "
        "no retention certificate."
    ),
    _C.MISSING_TAX_RECORD: "Invoice is missing from the tax/VAT registry.",
    _C.VAT_MISMATCH: "VAT recorded in the tax registry differs from the ERP VAT rate.",
    _C.VAT_RATE_MISSING: "The ERP entry has no VAT rate, so the registry VAT cannot be checked.",
    _C.AMOUNT_OUTSIDE_TOLERANCE: "Amount variance {delta} exceeds the {tolerance} tolerance.",
    _C.DATE_MISSING: "A posting or clearing date is missing, so the settlement cannot be dated.",
    _C.DATE_OUTSIDE_WINDOW: (
        "Settlement shifted {shift} day(s), outside the {window}-day window."
    ),
}


def json_params(**values: Decimal | int) -> Params:
    """Parameters as JSON-friendly numbers (amounts become floats)."""
    return {key: float(v) if isinstance(v, Decimal) else v for key, v in values.items()}


def render(code: ExplanationCode, params: Params, currency: Currency) -> str:
    """The English sentence for ``code``."""
    shown: dict[str, str] = {}
    for key, value in params.items():
        if key == "delta":
            shown[key] = currency.format(Decimal(str(value)), signed=True)
        elif key == "tolerance":
            shown[key] = currency.format(Decimal(str(value)))
        elif key == "shift":
            shown[key] = f"{value:+d}"
        else:
            shown[key] = str(value)
    return _TEMPLATES[code].format(**shown)
