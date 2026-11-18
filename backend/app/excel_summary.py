"""Rows of the ``Summary`` sheet of the audit pack."""

from __future__ import annotations

from typing import Any

from .models import BatchState


def summary_rows(state: BatchState) -> list[tuple[str, Any]]:
    kpis, tolerance = state.kpis, state.tolerance
    return [
        ("Entity", state.entity),
        ("Batch ID", state.batch_id),
        ("Data notice", state.data_notice),
        ("Generated at (UTC)", state.generated_at),
        ("Amount tolerance (GBP)", tolerance.amount_tolerance_gbp),
        ("Date window (days)", tolerance.date_window_days),
        ("Total records", kpis.total_records),
        ("Total ledger volume (GBP)", kpis.total_ledger_volume_gbp),
        ("Exact matches", kpis.exact_count),
        ("Tolerance matches", kpis.tolerance_count),
        ("Unresolved anomalies", kpis.anomaly_count),
        ("Resolved / audited", kpis.resolved_count),
        ("Match rate (%)", kpis.match_rate_pct),
        ("Net unreconciled variance (GBP)", kpis.net_unreconciled_variance_gbp),
        ("Gross unreconciled exposure (GBP)", kpis.gross_unreconciled_exposure_gbp),
    ]
