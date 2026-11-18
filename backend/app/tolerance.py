"""Validation of a requested amount tolerance against the batch currency."""

from __future__ import annotations

from decimal import Decimal

from .currencies import Currency
from .errors import InvalidRequestError


def check_tolerance(currency: Currency, amount: Decimal) -> None:
    """Raise when ``amount`` is above the currency's limit or has too many decimals."""
    limit = currency.max_tolerance
    if amount > limit:
        raise InvalidRequestError(
            "TOLERANCE_OUT_OF_RANGE", f"Amount tolerance cannot exceed {currency.format(limit)}."
        )
    if amount != currency.round(amount):
        raise InvalidRequestError(
            "TOLERANCE_DECIMALS",
            f"Amount tolerance has more decimals than {currency.code} allows.",
        )
