"""Rows of the ``Summary`` sheet of the audit pack."""

from __future__ import annotations

from typing import Any

from .batch_models import BatchState


def summary_rows(state: BatchState) -> list[tuple[str, Any]]:
    kpis, tolerance, code = state.kpis, state.tolerance, state.currency.code
    return [
        ("Entity", state.entity),
        ("Batch ID", state.batch_id),
        ("Data notice", state.data_notice),
        ("Generated at (UTC)", state.generated_at),
        ("Currency", code),
        (f"Amount tolerance ({code})", tolerance.amount_tolerance),
        ("Date window (days)", tolerance.date_window_days),
        ("Total records", kpis.total_records),
        (f"Total ledger volume ({code})", kpis.total_ledger_volume),
        ("Exact matches", kpis.exact_count),
        ("Tolerance matches", kpis.tolerance_count),
        ("Unresolved anomalies", kpis.anomaly_count),
        ("Resolved / audited", kpis.resolved_count),
        ("Match rate (%)", kpis.match_rate_pct),
        (f"Net unreconciled variance ({code})", kpis.net_unreconciled_variance),
        (f"Gross unreconciled exposure ({code})", kpis.gross_unreconciled_exposure),
    ]
