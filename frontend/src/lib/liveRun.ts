import type { BatchState, LiveRun, ReconciliationProgress } from '../types/reconciliation';

/**
 * Applies a full state event to the run being followed.
 *
 * The per-record overlay ("IN QUEUE" until a pass decides the record) is only
 * trustworthy when this tab saw every progress event of the run. A tab that
 * joins or reconnects mid-run still tracks the progress bar, but shows the
 * authoritative record statuses instead of an overlay with gaps.
 */
export function nextLiveRun(current: LiveRun | null, state: BatchState): LiveRun | null {
  const { run } = state;
  if (run.status !== 'RUNNING') return null;
  if (current?.runId !== run.run_id) {
    return { runId: run.run_id, verdicts: {}, progress: null, overlay: run.processed === 0 };
  }
  const seen = current.progress?.processed ?? 0;
  return run.processed > seen ? { ...current, overlay: false } : current;
}

export function applyProgress(
  current: LiveRun | null,
  progress: ReconciliationProgress,
): LiveRun | null {
  if (!current || current.runId !== progress.run_id) return current;
  const verdicts =
    progress.decided && progress.tx_id && progress.classification
      ? { ...current.verdicts, [progress.tx_id]: progress.classification }
      : current.verdicts;
  return { ...current, verdicts, progress };
}
