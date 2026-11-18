"""Live 3-pass run: replays the verdicts one record at a time over SSE."""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Callable

from .models import ReconciledRecord, RunState, RunStatus
from .run_plan import RunStep, build_run_steps


class LiveRun:
    def __init__(
        self,
        *,
        step_seconds: float,
        clock: Callable[[], datetime],
        publish_progress: Callable[[str], None],
        publish_state: Callable[[], object],
    ) -> None:
        self._step_seconds = step_seconds
        self._clock = clock
        self._publish_progress = publish_progress
        self._publish_state = publish_state
        self._task: asyncio.Task[None] | None = None
        self.state = RunState()

    @property
    def is_running(self) -> bool:
        return self.state.status is RunStatus.RUNNING

    def clear(self) -> None:
        """Forget the last run but keep counting run ids upwards."""
        self.state = RunState(run_id=self.state.run_id)

    def start(self, records: list[ReconciledRecord]) -> RunState:
        """Start the run as a background task and return at once."""
        steps = build_run_steps(records)
        self.state = RunState(
            run_id=self.state.run_id + 1,
            status=RunStatus.RUNNING,
            total=len(steps),
            started_at=self._clock(),
        )
        self._publish_state()
        self._task = asyncio.create_task(self._execute(steps))
        return self.state

    async def _execute(self, steps: list[RunStep]) -> None:
        run_id = self.state.run_id
        try:
            for index, step in enumerate(steps, start=1):
                await asyncio.sleep(self._step_seconds)
                self.state = self.state.model_copy(
                    update={
                        "processed": index,
                        "percent": round(100 * index / len(steps), 1),
                        "pass_number": step.pass_number,
                    }
                )
                self._publish_progress(step.to_progress(self.state).model_dump_json())
        finally:
            # Also reached on cancellation (shutdown): never leave RUNNING behind.
            if self.state.run_id == run_id:
                self.state = self.state.model_copy(
                    update={"status": RunStatus.COMPLETED, "completed_at": self._clock()}
                )
                self._publish_state()

    async def wait(self) -> None:
        if self._task is not None:
            await self._task

    async def shutdown(self) -> None:
        if self._task is not None and not self._task.done():
            self._task.cancel()
            await asyncio.gather(self._task, return_exceptions=True)
