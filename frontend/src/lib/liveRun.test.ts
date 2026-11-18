import { describe, expect, it } from 'vitest';
import { batchState, progress, runState } from '../test/fixtures';
import { applyProgress, nextLiveRun } from './liveRun';

const running = (overrides = {}) => batchState({ run: runState(overrides) });

describe('nextLiveRun', () => {
  it('follows a run with the per-record overlay when it is seen from its first step', () => {
    expect(nextLiveRun(null, running({ processed: 0 }))).toEqual({
      runId: 1,
      verdicts: {},
      progress: null,
      overlay: true,
    });
  });

  it('tracks a run joined midway without the overlay', () => {
    // The tab missed earlier steps, so "in queue" badges would be wrong.
    expect(nextLiveRun(null, running({ processed: 7 }))?.overlay).toBe(false);
  });

  it('drops the run when the state says it is no longer running', () => {
    const current = nextLiveRun(null, running());
    expect(nextLiveRun(current, batchState({ run: runState({ status: 'COMPLETED' }) }))).toBeNull();
    expect(nextLiveRun(current, batchState({ run: runState({ status: 'FAILED' }) }))).toBeNull();
  });

  it('keeps the overlay while no progress was missed', () => {
    const started = nextLiveRun(null, running());
    const afterThree = applyProgress(started, progress({ processed: 3 }));
    expect(nextLiveRun(afterThree, running({ processed: 3 }))).toBe(afterThree);
  });

  it('turns the overlay off when a snapshot is ahead of the progress seen', () => {
    const started = nextLiveRun(null, running());
    const afterThree = applyProgress(started, progress({ processed: 3 }));
    const afterReconnect = nextLiveRun(afterThree, running({ processed: 9 }));
    expect(afterReconnect?.overlay).toBe(false);
    expect(afterReconnect?.verdicts).toEqual({ 'TX-1': 'EXACT_MATCH' });
  });

  it('starts over for a new run id', () => {
    const first = applyProgress(nextLiveRun(null, running()), progress());
    const second = nextLiveRun(first, running({ run_id: 2 }));
    expect(second).toEqual({ runId: 2, verdicts: {}, progress: null, overlay: true });
  });
});

describe('applyProgress', () => {
  it('records the verdict of a decided step and keeps the latest progress', () => {
    const step = progress({ tx_id: 'TX-9', classification: 'ANOMALY', processed: 5 });
    const next = applyProgress(nextLiveRun(null, running()), step);
    expect(next?.verdicts).toEqual({ 'TX-9': 'ANOMALY' });
    expect(next?.progress).toBe(step);
  });

  it('does not record a verdict for a step that only deferred the record', () => {
    const step = progress({ decided: false, classification: null });
    expect(applyProgress(nextLiveRun(null, running()), step)?.verdicts).toEqual({});
  });

  it('ignores progress of another run and progress without a tracked run', () => {
    const current = nextLiveRun(null, running());
    expect(applyProgress(current, progress({ run_id: 99 }))).toBe(current);
    expect(applyProgress(null, progress())).toBeNull();
  });
});
