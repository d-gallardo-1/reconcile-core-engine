"""Auditor decisions on anomalies."""

from __future__ import annotations

from datetime import datetime

from .errors import ConflictError, NotFoundError
from .models import MatchStatus, ReconciledRecord, Resolution, ResolutionAction


def build_resolution(
    record: ReconciledRecord | None,
    tx_id: str,
    action: ResolutionAction,
    note: str,
    resolved_at: datetime,
) -> Resolution:
    """Validate that ``record`` is an open anomaly and return its audit entry."""
    if record is None:
        raise NotFoundError("UNKNOWN_TRANSACTION", f"Unknown transaction: {tx_id}.")
    if record.status is MatchStatus.RESOLVED:
        raise ConflictError(
            "ALREADY_RESOLVED", f"{tx_id} is already resolved; audit entries are immutable."
        )
    if record.status is not MatchStatus.ANOMALY or record.anomaly_type is None:
        raise ConflictError("NOT_AN_OPEN_ANOMALY", f"{tx_id} is not an open anomaly.")
    return Resolution(
        action=action,
        resolution_note=note,
        resolved_at=resolved_at,
        anomaly_type=record.anomaly_type,
        variance=record.variance,
    )
