"""Auditor decisions on anomalies, one at a time or several with one note."""

from __future__ import annotations

from datetime import datetime

from .errors import ConflictError, NotFoundError
from .models import MatchStatus, ReconciledRecord, Resolution, ResolutionAction


def _open_anomaly(record: ReconciledRecord | None, tx_id: str) -> ReconciledRecord:
    if record is None:
        raise NotFoundError("UNKNOWN_TRANSACTION", f"Unknown transaction: {tx_id}.")
    if record.status is MatchStatus.RESOLVED:
        raise ConflictError(
            "ALREADY_RESOLVED", f"{tx_id} is already resolved; audit entries are immutable."
        )
    if record.status is not MatchStatus.ANOMALY or record.anomaly_type is None:
        raise ConflictError("NOT_AN_OPEN_ANOMALY", f"{tx_id} is not an open anomaly.")
    return record


def build_resolutions(
    records: list[ReconciledRecord],
    tx_ids: list[str],
    action: ResolutionAction,
    note: str,
    resolved_at: datetime,
) -> dict[str, Resolution]:
    """Audit entries for ``tx_ids``, or an error and no entry at all.

    Every record must be an open anomaly, and a selection of several must share
    one cause: a single note cannot honestly justify unrelated problems. The
    entries share one timestamp because they are one decision.
    """
    by_id = {record.tx_id: record for record in records}
    selected = [_open_anomaly(by_id.get(tx_id), tx_id) for tx_id in tx_ids]
    causes = sorted({record.anomaly_type.value for record in selected if record.anomaly_type})
    if len(causes) > 1:
        raise ConflictError(
            "MIXED_ANOMALY_TYPES",
            f"The selection mixes different causes ({', '.join(causes)}); resolve one cause at a time.",
        )
    return {
        record.tx_id: Resolution(
            action=action,
            resolution_note=note,
            resolved_at=resolved_at,
            anomaly_type=record.anomaly_type,
            variance=record.variance,
        )
        for record in selected
    }
