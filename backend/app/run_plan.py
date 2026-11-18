"""Turns a reconciled batch into the ordered steps of a live 3-pass run.

Pass 1 visits every record, pass 2 the records pass 1 left open, and pass 3 the
rest. The verdicts are the ones the rules already produced; the run replays
them one record at a time so a viewer can watch the pipeline work.
"""

from __future__ import annotations

from dataclasses import dataclass

from .matching import PASS_NAMES
from .models import MatchStatus, ReconciledRecord, ReconciliationProgress, RunState


@dataclass(frozen=True)
class RunStep:
    pass_number: int
    tx_id: str
    decided: bool
    classification: MatchStatus | None

    def to_progress(self, run: RunState) -> ReconciliationProgress:
        return ReconciliationProgress(
            run_id=run.run_id,
            status=run.status,
            pass_number=self.pass_number,
            pass_name=PASS_NAMES[self.pass_number],
            processed=run.processed,
            total=run.total,
            percent=run.percent,
            tx_id=self.tx_id,
            decided=self.decided,
            classification=self.classification,
        )


def build_run_steps(records: list[ReconciledRecord]) -> list[RunStep]:
    steps: list[RunStep] = []
    remaining = records
    for pass_number in (1, 2, 3):
        still_open = []
        for record in remaining:
            decided = record.matched_in_pass == pass_number
            steps.append(
                RunStep(pass_number, record.tx_id, decided, record.status if decided else None)
            )
            if not decided:
                still_open.append(record)
        remaining = still_open
    return steps
