import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { applyProgress, nextLiveRun } from '../lib/liveRun';
import type {
  BatchState,
  LiveRun,
  ReconciliationProgress,
  StreamStatus,
} from '../types/reconciliation';

const RETRY_MS = 3000;
// The backend sends an event or a heartbeat at least every 5 s. If nothing
// arrives for this long the connection is considered dead and rebuilt. This
// catches a proxy that keeps the browser side open after the backend has gone,
// and a connection attempt that never gets an answer.
const STALE_MS = 8000;
const FAILURES_BEFORE_DISCONNECTED = 3;

interface StreamData {
  state: BatchState | null;
  status: StreamStatus;
  liveRun: LiveRun | null;
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
      window.clearTimeout(staleTimer);
      window.clearTimeout(retryTimer);
      retryTimer = window.setTimeout(connect, RETRY_MS);
    };

    // Armed on every connection attempt and on every event received.
    const armStaleTimer = () => {
      window.clearTimeout(staleTimer);
      staleTimer = window.setTimeout(() => {
        markFailure();
        scheduleRetry();
      }, STALE_MS);
    };

    const alive = () => {
      failures = 0;
      setStatus('CONNECTED');
      armStaleTimer();
    };

    /** Parses first: a malformed event is a stream failure, not a live connection. */
    const handle =
      <T,>(apply: (payload: T) => void) =>
      (event: MessageEvent<string>) => {
        let payload: T;
        try {
          payload = JSON.parse(event.data) as T;
        } catch {
          markFailure();
          scheduleRetry();
          return;
        }
        alive();
        apply(payload);
      };

    const onState = handle<BatchState>((next) => {
      setState(next);
      setLiveRun((current) => nextLiveRun(current, next));
    });
    const onProgress = handle<ReconciliationProgress>((progress) => {
      setLiveRun((current) => applyProgress(current, progress));
    });

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
      armStaleTimer();
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
