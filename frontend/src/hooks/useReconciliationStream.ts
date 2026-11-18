import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import type {
  BatchState,
  LiveRun,
  ReconciliationProgress,
  StreamStatus,
} from '../types/reconciliation';

const RETRY_MS = 3000;
// The backend sends an event or a heartbeat at least every 5 s. If nothing
// arrives for this long the connection is considered dead and rebuilt. This
// catches a proxy that keeps the browser side open after the backend has gone.
const STALE_MS = 8000;
const FAILURES_BEFORE_DISCONNECTED = 3;

interface StreamData {
  state: BatchState | null;
  status: StreamStatus;
  liveRun: LiveRun | null;
}

/** Applies a full state event. A run is followed live only from its first step. */
function nextLiveRun(current: LiveRun | null, state: BatchState): LiveRun | null {
  if (state.run.status !== 'RUNNING') return null;
  if (current?.runId === state.run.run_id) return current;
  return state.run.processed === 0
    ? { runId: state.run.run_id, verdicts: {}, progress: null }
    : null;
}

function applyProgress(current: LiveRun | null, progress: ReconciliationProgress): LiveRun | null {
  if (!current || current.runId !== progress.run_id) return current;
  const verdicts =
    progress.decided && progress.tx_id && progress.classification
      ? { ...current.verdicts, [progress.tx_id]: progress.classification }
      : current.verdicts;
  return { ...current, verdicts, progress };
}

/**
 * Subscribes to the SSE stream. Every state event carries the full batch, so a
 * client that reconnects is consistent again after a single message.
 *
 * EventSource reconnects by itself after network errors, but it gives up when
 * the server answers with an HTTP error (for example a 502 while the backend
 * restarts). That case is retried manually here.
 */
export function useReconciliationStream(): StreamData {
  const [state, setState] = useState<BatchState | null>(null);
  const [status, setStatus] = useState<StreamStatus>('RECONNECTING');
  const [liveRun, setLiveRun] = useState<LiveRun | null>(null);

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: number | undefined;
    let staleTimer: number | undefined;
    let disposed = false;
    let failures = 0;

    const markFailure = () => {
      failures += 1;
      setStatus(failures >= FAILURES_BEFORE_DISCONNECTED ? 'DISCONNECTED' : 'RECONNECTING');
    };

    const scheduleRetry = () => {
      source?.close();
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(connect, RETRY_MS);
    };

    const alive = () => {
      failures = 0;
      setStatus('CONNECTED');
      window.clearTimeout(staleTimer);
      staleTimer = window.setTimeout(() => {
        markFailure();
        scheduleRetry();
      }, STALE_MS);
    };

    const onState = (event: MessageEvent<string>) => {
      alive();
      const next = JSON.parse(event.data) as BatchState;
      setState(next);
      setLiveRun((current) => nextLiveRun(current, next));
    };

    const onProgress = (event: MessageEvent<string>) => {
      alive();
      const progress = JSON.parse(event.data) as ReconciliationProgress;
      setLiveRun((current) => applyProgress(current, progress));
    };

    function connect() {
      if (disposed) return;
      source = new EventSource(`${API_BASE}/stream`);
      source.addEventListener('snapshot', onState as EventListener);
      source.addEventListener('state_update', onState as EventListener);
      source.addEventListener('reconciliation_progress', onProgress as EventListener);
      source.addEventListener('heartbeat', alive);
      source.onopen = alive;
      source.onerror = () => {
        markFailure();
        if (source?.readyState === EventSource.CLOSED) scheduleRetry();
      };
    }

    connect();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearTimeout(staleTimer);
      source?.close();
    };
  }, []);

  return { state, status, liveRun };
}
