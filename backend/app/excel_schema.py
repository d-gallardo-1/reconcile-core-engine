"""Column layout of the workbook sheets: the single definition used by the
exporter, the parser, the template and the schema inspector in the UI."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
import re
from decimal import Decimal, InvalidOperation
from typing import Any

from .models import TaxStatus

LEDGER_SHEET = "Ledger_Input"
SUMMARY_SHEET = "Summary"
EXACT_SHEET = "Exact_Matches"
TOLERANCE_SHEET = "Tolerance_Matches"
ANOMALY_SHEET = "Unresolved_Anomalies"
RESOLVED_SHEET = "Resolved_Audit_Trail"

MONEY_FORMAT = '#,##0.00;[Red]-#,##0.00'
DATE_FORMAT = "yyyy-mm-dd"


@dataclass(frozen=True)
class Column:
    header: str
    field: str
    kind: str  # text | money | date | rate | integer | enum
    required: bool
    description: str


LEDGER_COLUMNS: tuple[Column, ...] = (
    Column("TX ID", "tx_id", "text", True, "Unique transaction identifier."),
    Column("Invoice Ref", "invoice_ref", "text", True, "Invoice or payment reference shared by the sources."),
    Column("Counterparty", "counterparty", "text", True, "Supplier or customer name."),
    Column("ERP Amount GBP", "erp_amount_gbp", "money", False, "Source A: gross amount in the general ledger."),
    Column("ERP Date", "erp_date", "date", False, "Source A: posting date."),
    Column("VAT Rate", "vat_rate", "rate", False, "Source A: VAT rate as a fraction (0.20 = 20%)."),
    Column("Bank Amount GBP", "bank_amount_gbp", "money", False, "Source B: amount per bank settlement."),
    Column("Bank Date", "bank_date", "date", False, "Source B: clearing date."),
    Column("Bank Settlements", "bank_settlement_count", "integer", True, "Source B: number of settlements found (0-9)."),
    Column("Tax Status", "tax_status", "enum", True, "Source C: " + " | ".join(s.value for s in TaxStatus) + "."),
    Column("Tax VAT Amount GBP", "tax_vat_amount_gbp", "money", False, "Source C: VAT amount held by the registry."),
    Column("Scenario Code", "scenario_code", "text", False, "Demo scenario that injected the row, if any."),
)

#: Report sheets: the input columns plus the verdict of the pipeline.
REPORT_COLUMNS: tuple[Column, ...] = LEDGER_COLUMNS[:-1] + (
    Column("Variance GBP", "variance_gbp", "money", True, "Bank total minus ERP amount."),
    Column("Date Shift Days", "date_shift_days", "integer", False, "Bank date minus ERP date."),
    Column("Tax Check", "tax_check", "enum", True, "Registry comparison result."),
    Column("Classification", "status", "enum", True, "Pipeline verdict."),
    Column("Matched In Pass", "matched_in_pass", "integer", True, "Pass that decided the record."),
    Column("Anomaly Type", "anomaly_type", "enum", False, "Cause named by pass 3."),
    Column("Explanation", "explanation", "text", True, "Reason for the verdict."),
)

RESOLUTION_COLUMNS: tuple[Column, ...] = (
    Column("Resolution Action", "action", "enum", True, "Auditor decision."),
    Column("Resolution Note", "resolution_note", "text", True, "Auditor note."),
    Column("Resolved At (UTC)", "resolved_at", "text", True, "Immutable audit timestamp."),
)

#: Largest absolute amount accepted in a money or rate cell.
MAX_ABSOLUTE_NUMBER = Decimal("1000000000000")

_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def to_cell(value: Any) -> Any:
    """Convert a model value to something safe to store in a cell.

    Text starting with a formula character is prefixed with an apostrophe so a
    spreadsheet program shows it as text instead of evaluating it.
    """
    if value is None:
        return None
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if hasattr(value, "value"):  # enum
        return value.value
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def from_cell(column: Column, value: Any) -> Any:
    """Convert a cell back to model input. Raises ``ValueError`` when malformed."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if column.kind in ("money", "rate"):
        if isinstance(value, bool):
            raise ValueError("must be a number")
        try:
            number = Decimal(str(value))
        except InvalidOperation:
            raise ValueError("must be a number") from None
        if not number.is_finite() or abs(number) > MAX_ABSOLUTE_NUMBER:
            limit = f"{MAX_ABSOLUTE_NUMBER:,}"
            raise ValueError(f"must be a number between -{limit} and {limit}")
        return number
    if column.kind == "date":
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, date):
            return value
        try:
            return date.fromisoformat(str(value).strip())
        except ValueError:
            raise ValueError("must be a date (YYYY-MM-DD)") from None
    if column.kind == "integer":
        if isinstance(value, str):
            # Whole numbers typed as text are common in hand-edited workbooks.
            if not re.fullmatch(r"[+-]?\d{1,9}", value.strip()):
                raise ValueError("must be a whole number")
            return int(value)
        if isinstance(value, bool):
            raise ValueError("must be a whole number")
        try:
            whole = float(value).is_integer()
        except (ValueError, TypeError, OverflowError):
            whole = False
        if not whole:
            raise ValueError("must be a whole number")
        return int(value)
    return str(value).strip()
