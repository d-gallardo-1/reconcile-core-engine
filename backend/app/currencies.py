"""Supported batch currencies. A batch is reconciled in exactly one of them."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

DEFAULT_CURRENCY = "GBP"

#: Tolerance defaults and limits, expressed in the reference currency (factor 1).
_BASE_DEFAULT_TOLERANCE = Decimal("15")
_BASE_MAX_TOLERANCE = Decimal("50")


@dataclass(frozen=True)
class Currency:
    code: str
    #: Decimal places of the smallest unit (ISO 4217): 2 for most, 0 for JPY and CLP.
    minor_units: int
    #: Multiplier that re-denominates the synthetic batch so its amounts look
    #: plausible in this currency. A fixed illustrative factor, not a market rate.
    demo_factor: Decimal

    @property
    def quantum(self) -> Decimal:
        return Decimal(1).scaleb(-self.minor_units)

    def round(self, value: Decimal) -> Decimal:
        return value.quantize(self.quantum, rounding=ROUND_HALF_UP)

    def scale(self, reference_amount: Decimal) -> Decimal:
        """A reference-currency amount of the synthetic batch, in this currency."""
        return self.round(reference_amount * self.demo_factor)

    @property
    def default_tolerance(self) -> Decimal:
        return self.scale(_BASE_DEFAULT_TOLERANCE)

    @property
    def max_tolerance(self) -> Decimal:
        return self.scale(_BASE_MAX_TOLERANCE)

    def format(self, amount: Decimal, *, signed: bool = False) -> str:
        """Plain English rendering used in explanations and the audit pack."""
        sign = "+" if signed else ""
        return f"{amount:{sign},.{self.minor_units}f} {self.code}"


CURRENCIES: dict[str, Currency] = {
    currency.code: currency
    for currency in (
        Currency("GBP", 2, Decimal(1)),
        Currency("EUR", 2, Decimal(1)),
        Currency("USD", 2, Decimal(1)),
        Currency("CHF", 2, Decimal(1)),
        Currency("BRL", 2, Decimal(5)),
        Currency("MXN", 2, Decimal(20)),
        Currency("CNY", 2, Decimal(10)),
        Currency("INR", 2, Decimal(100)),
        Currency("JPY", 0, Decimal(200)),
        Currency("CLP", 0, Decimal(1000)),
    )
}


class UnknownCurrencyError(ValueError):
    pass


def get_currency(code: str) -> Currency:
    try:
        return CURRENCIES[code.upper()]
    except KeyError:
        supported = ", ".join(CURRENCIES)
        raise UnknownCurrencyError(
            f"Unsupported currency '{code}'. Supported: {supported}."
        ) from None
