"""Currency edge rules: tolerance decimals, atomic switch, scenario identity, rendered text."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.batch_models import default_tolerance
from app.currencies import CURRENCIES
from app.main import build_engine
from app.matching import reconcile
from app.mock_ledgers import SCENARIOS
from app.models import LedgerTransaction, TaxStatus

from .conftest import API


def set_tolerance(client, amount):
    body = {"amount_tolerance": amount, "date_window_days": 2}
    return client.post(f"{API}/reconcile/tolerance", json=body)


def test_tolerance_must_fit_the_decimals_of_the_batch_currency(client):
    assert set_tolerance(client, 12.34).status_code == 200  # two decimals are fine in GBP
    client.post(f"{API}/batches/currency", json={"currency": "JPY"})
    refused = set_tolerance(client, 1500.55)
    assert (refused.status_code, refused.json()["code"]) == (422, "TOLERANCE_DECIMALS")
    assert client.get(f"{API}/batches/current").json()["tolerance"]["amount_tolerance"] == 3000.0
    assert set_tolerance(client, 1500).status_code == 200


def test_a_failed_currency_switch_leaves_the_batch_untouched():
    engine = build_engine(step_seconds=0)
    engine.inject("SCN-301")
    original_loader = engine._load_batch

    def failing_loader(code: str):
        if code == "EUR":
            raise RuntimeError("loader failed")
        return original_loader(code)

    engine._load_batch = failing_loader
    with pytest.raises(RuntimeError):
        engine.set_currency("EUR")

    state = engine.snapshot()
    assert state.currency.code == "GBP"
    assert {record.currency for record in state.records} == {"GBP"}
    assert state.kpis.total_records == 16  # the injected scenario is still there
    assert state.tolerance == default_tolerance("GBP")


@pytest.mark.parametrize("code", list(CURRENCIES))
def test_each_scenario_builds_the_transaction_it_announces(code):
    for scenario in SCENARIOS.values():
        built = scenario.transaction(code)
        assert built.tx_id == scenario.tx_id
        assert built.scenario_code == scenario.code
        assert built.currency == code


def _tx(**overrides) -> LedgerTransaction:
    values = dict(
        tx_id="TX-1", invoice_ref="INV-1", counterparty="Acme Test Ltd", currency="GBP",
        erp_amount=Decimal("12000.00"), erp_date=date(2026, 11, 2), vat_rate=Decimal("0.20"),
        bank_amount=Decimal("12000.00"), bank_date=date(2026, 11, 2), bank_settlement_count=1,
        tax_status=TaxStatus.REGISTERED, tax_vat_amount=Decimal("2000.00"),
    )
    return LedgerTransaction(**{**values, **overrides})


@pytest.mark.parametrize(
    ("overrides", "code", "params", "sentence"),
    [
        (
            dict(bank_amount=Decimal("11990.00"), bank_date=date(2026, 11, 3)),
            "TOLERANCE_AMOUNT_AND_DATE",
            {"delta": -10.0, "shift": 1},
            "Auto-matched within tolerance: amount variance -10.00 GBP and settlement shifted +1 day(s).",
        ),
        (
            dict(bank_settlement_count=2),
            "DUPLICATE_SETTLEMENT",
            {"count": 2, "delta": 12000.0},
            "Settled 2 times in the bank feed against one ERP entry (+12,000.00 GBP overpayment exposure).",
        ),
        (
            dict(bank_amount=Decimal("10800.00"), tax_status=TaxStatus.CERTIFICATE_MISSING, tax_vat_amount=None),
            "WITHHOLDING_GAP",
            {"delta": -1200.0},
            "Bank settled -1,200.00 GBP against the ERP amount and the tax registry holds no retention certificate.",
        ),
    ],
)
def test_explanation_codes_parameters_and_english_text(overrides, code, params, sentence):
    record = reconcile(_tx(**overrides), default_tolerance("GBP"))
    assert (record.explanation_code, record.explanation_params) == (code, params)
    # Amounts of a thousand or more are written with a thousands separator.
    assert record.explanation == sentence
