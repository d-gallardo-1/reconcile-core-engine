"""Headline figures of a reconciled batch."""

from __future__ import annotations

from decimal import Decimal

from .batch_models import Kpis
from .models import MatchStatus, ReconciledRecord

ZERO = Decimal(0)


def compute_kpis(records: list[ReconciledRecord]) -> Kpis:
    def count(status: MatchStatus) -> int:
        return sum(1 for record in records if record.status is status)

    open_variances = [r.variance for r in records if r.status is MatchStatus.ANOMALY]
    matched = count(MatchStatus.EXACT_MATCH) + count(MatchStatus.TOLERANCE_MATCH)
    return Kpis(
        total_records=len(records),
        total_ledger_volume=sum((r.erp_amount or ZERO for r in records), ZERO),
        exact_count=count(MatchStatus.EXACT_MATCH),
        tolerance_count=count(MatchStatus.TOLERANCE_MATCH),
        anomaly_count=count(MatchStatus.ANOMALY),
        resolved_count=count(MatchStatus.RESOLVED),
        match_rate_pct=round(100 * matched / len(records), 1) if records else 0.0,
        net_unreconciled_variance=sum(open_variances, ZERO),
        gross_unreconciled_exposure=sum((abs(v) for v in open_variances), ZERO),
    )
