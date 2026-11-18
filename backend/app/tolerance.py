"""Amount tolerance: validation against the batch currency, and change preview."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel

from .currencies import Currency
from .errors import InvalidRequestError
from .kpis import compute_kpis
from .models import MatchStatus, ReconciledRecord, ToleranceConfig

_MATCHED = (MatchStatus.EXACT_MATCH, MatchStatus.TOLERANCE_MATCH)


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


class TolerancePreview(BaseModel):
    """What the batch would look like under other rules. Nothing is applied."""

    tolerance: ToleranceConfig
    exact_count: int
    tolerance_count: int
    anomaly_count: int
    resolved_count: int
    match_rate_pct: float
    #: Open anomalies today that the proposed rules would auto-match.
    newly_matched: list[str]
    #: Matched today, anomalies under the proposed rules.
    newly_unmatched: list[str]


def build_preview(
    current: list[ReconciledRecord], proposed: list[ReconciledRecord], tolerance: ToleranceConfig
) -> TolerancePreview:
    """Compare two reconciliations of the same batch, in batch order.

    Resolved records keep their status in both, so they never appear as changes.
    """
    kpis = compute_kpis(proposed)
    pairs = list(zip(current, proposed, strict=True))
    return TolerancePreview(
        tolerance=tolerance,
        exact_count=kpis.exact_count,
        tolerance_count=kpis.tolerance_count,
        anomaly_count=kpis.anomaly_count,
        resolved_count=kpis.resolved_count,
        match_rate_pct=kpis.match_rate_pct,
        newly_matched=[
            after.tx_id for before, after in pairs
            if before.status is MatchStatus.ANOMALY and after.status in _MATCHED
        ],
        newly_unmatched=[
            after.tx_id for before, after in pairs
            if before.status in _MATCHED and after.status is MatchStatus.ANOMALY
        ],
    )
