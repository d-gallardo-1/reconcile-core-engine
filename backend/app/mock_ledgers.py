"""100% synthetic cross-source batch for the fictional Veritas Ledger Systems.

Every counterparty, invoice reference and amount in this file is invented for
the demonstration. Nothing here comes from a real ledger, bank or tax registry.

Amounts are written in a reference denomination and re-denominated with the
currency's fixed illustrative factor, so the same cases exist in every currency.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Callable

from .currencies import DEFAULT_CURRENCY, Currency, get_currency
from .matching import expected_vat
from .models import AnomalyType, LedgerTransaction, TaxStatus

ENTITY_NAME = "Veritas Ledger Systems — International Audit Division"
BATCH_ID = "VLS-2026-11-B01"
DATA_NOTICE = "Reference demo: all records are synthetic. No real financial data."

STANDARD_VAT = Decimal("0.20")
REDUCED_VAT = Decimal("0.05")
_UNSET = object()


def _d(day: int) -> date:
    return date(2026, 11, day)


def _tx(
    currency: Currency,
    tx_id: str,
    invoice_ref: str,
    counterparty: str,
    erp: str | None,
    erp_day: int | None,
    *,
    bank: str | None | object = _UNSET,
    bank_day: int | None | object = _UNSET,
    settlements: int = 1,
    tax: TaxStatus = TaxStatus.REGISTERED,
    registry_vat_rate: Decimal = STANDARD_VAT,
    scenario: str | None = None,
) -> LedgerTransaction:
    """Build one row. Bank side and registry VAT default to mirroring the ERP."""
    erp_amount = currency.scale(Decimal(erp)) if erp is not None else None
    if bank is _UNSET:
        bank_amount = erp_amount
    else:
        bank_amount = currency.scale(Decimal(bank)) if bank else None  # type: ignore[arg-type]
    if bank_amount is None:
        settlements = 0
    registered = tax is TaxStatus.REGISTERED and erp_amount is not None
    vat = expected_vat(erp_amount, registry_vat_rate, currency.code) if registered else None
    return LedgerTransaction(
        tx_id=tx_id,
        invoice_ref=invoice_ref,
        counterparty=counterparty,
        currency=currency.code,
        erp_amount=erp_amount,
        erp_date=_d(erp_day) if erp_day else None,
        vat_rate=STANDARD_VAT if erp_amount is not None else None,
        bank_amount=bank_amount,
        bank_date=None if bank_amount is None else _d(erp_day if bank_day is _UNSET else bank_day),  # type: ignore[arg-type]
        bank_settlement_count=settlements,
        tax_status=tax,
        tax_vat_amount=vat,
        scenario_code=scenario,
    )


def base_transactions(currency_code: str = DEFAULT_CURRENCY) -> list[LedgerTransaction]:
    """The default batch: 9 exact matches, 3 tolerance cases, 3 anomalies."""
    c = get_currency(currency_code)
    return [
        # --- Exact matches: same reference, amount, 20% VAT and settlement day.
        _tx(c, "TX-9001", "INV-2026-801", "Northgate Haulage Ltd", "24500.00", 2),
        _tx(c, "TX-9002", "INV-2026-804", "Calder Valley Packaging Ltd", "7320.00", 2),
        _tx(c, "TX-9003", "INV-2026-809", "Kestrel Data Hosting Ltd", "15840.00", 3),
        _tx(c, "TX-9004", "INV-2026-812", "Ashcombe Facilities Management", "3960.00", 4),
        _tx(c, "TX-9005", "INV-2026-817", "Van Dijk Industrial BV", "31200.00", 5),
        _tx(c, "TX-9006", "INV-2026-823", "Orwell Print Works Ltd", "1284.00", 5),
        _tx(c, "TX-9007", "INV-2026-830", "Lumiere Composants SARL", "19680.00", 6),
        _tx(c, "TX-9008", "INV-2026-836", "Tarn Cloud Services Ltd", "9450.00", 9),
        _tx(c, "TX-9009", "INV-2026-841", "Hollin & Marsh Advisory LLP", "5600.00", 9),
        # --- Tolerance cases: matched only while the active rules allow it.
        # International wire fee deducted by the correspondent bank.
        _tx(c, "TX-9010", "INV-2026-852", "Rhein-Maas Freight GmbH", "12400.00", 9, bank="12385.00"),
        # Two-day clearing lag between ERP posting and bank settlement.
        _tx(c, "TX-9011", "INV-2026-857", "Pennine Fleet Services Ltd", "8750.00", 10, bank_day=12),
        # FX rounding delta on a settlement converted by the bank.
        _tx(c, "TX-9012", "INV-2026-861", "Atelier Verre Lyon SAS", "4200.00", 11, bank="4199.40"),
        # --- Anomalies that no tolerance in the allowed range can absorb.
        # Transposed digits in the settled amount.
        _tx(c, "TX-9013", "INV-2026-866", "Brightwater Process Supply Ltd", "9860.00", 3, bank="9680.00"),
        # Settled nine days after the ERP posting date.
        _tx(c, "TX-9014", "INV-2026-870", "Severn Estuary Tooling Ltd", "5340.00", 3, bank_day=12),
        # Registry holds VAT at the 5% reduced rate instead of 20%.
        _tx(c, "TX-9015", "INV-2026-875", "Wold Edge Catering Supplies", "2880.00", 6, registry_vat_rate=REDUCED_VAT),
    ]


@dataclass(frozen=True)
class Scenario:
    code: str
    anomaly_type: AnomalyType
    tx_id: str
    label: str
    description: str
    build: Callable[[Currency], LedgerTransaction]

    def transaction(self, currency_code: str) -> LedgerTransaction:
        return self.build(get_currency(currency_code))


SCENARIOS: dict[str, Scenario] = {
    scenario.code: scenario
    for scenario in (
        Scenario(
            "SCN-301", AnomalyType.WITHHOLDING_GAP, "TX-9301", "Tax Gap",
            "INV-2026-881: the bank settled 10% less than the ERP amount. A tax "
            "retention was withheld but never recorded; no certificate in the registry.",
            lambda c: _tx(
                c, "TX-9301", "INV-2026-881", "Aldermoor Engineering Ltd", "18000.00", 4,
                bank="16200.00", tax=TaxStatus.CERTIFICATE_MISSING, scenario="SCN-301",
            ),
        ),
        Scenario(
            "SCN-302", AnomalyType.DUPLICATE_SETTLEMENT, "TX-9302", "Duplicate Payment",
            "INV-2026-884: paid twice in the bank feed against a single ERP entry, "
            "leaving an overpayment exposure of the full invoice amount.",
            lambda c: _tx(
                c, "TX-9302", "INV-2026-884", "Quayside Marine Chandlers Ltd", "3450.00", 5,
                settlements=2, scenario="SCN-302",
            ),
        ),
        Scenario(
            "SCN-303", AnomalyType.ORPHAN_ERP_ACCRUAL, "TX-9303", "Missing Bank Feed",
            "INV-2026-890: recorded in the ERP and the tax registry, but absent "
            "from the bank settlement feed after 10 business days.",
            lambda c: _tx(
                c, "TX-9303", "INV-2026-890", "Fellside Instrumentation Ltd", "6120.00", 2,
                bank=None, scenario="SCN-303",
            ),
        ),
        Scenario(
            "SCN-304", AnomalyType.UNBOOKED_BANK_DEBIT, "TX-9304", "Unbooked Debit",
            "Direct debit DD-4419 cleared in the bank feed with no matching ERP "
            "purchase order or VAT receipt.",
            lambda c: _tx(
                c, "TX-9304", "DD-4419", "Unidentified direct debit originator", None, None,
                bank="2950.00", bank_day=10, tax=TaxStatus.NOT_REGISTERED, scenario="SCN-304",
            ),
        ),
    )
}
