import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api';
import type { ToleranceConfig, TolerancePreview } from '../types/reconciliation';

const PREVIEW_DELAY_MS = 250;

export type PreviewState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; preview: TolerancePreview }
  | { kind: 'failed'; failure: ApiError };

/**
 * Asks what a tolerance draft would change, a short pause after the last edit.
 * `revision` changes whenever the applied batch changes, so a draft is checked
 * again against the new state. An answer that arrives after a newer question
 * is dropped.
 */
export function useTolerancePreview(
  draft: ToleranceConfig | null,
  revision: string,
  fetchPreview: (amount: number, days: number) => Promise<TolerancePreview>,
): PreviewState {
  const [state, setState] = useState<PreviewState>({ kind: 'idle' });
  const latest = useRef(0);

  useEffect(() => {
    latest.current += 1;
    const request = latest.current;
    if (!draft) {
      setState({ kind: 'idle' });
      return;
    }
    setState({ kind: 'loading' });
    const timer = window.setTimeout(() => {
      fetchPreview(draft.amount_tolerance, draft.date_window_days).then(
        (preview) => {
          if (latest.current === request) setState({ kind: 'ready', preview });
        },
        (cause: unknown) => {
          if (latest.current !== request) return;
          const failure = cause instanceof ApiError ? cause : new ApiError('GENERIC', '');
          setState({ kind: 'failed', failure });
        },
      );
    }, PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, revision, fetchPreview]);

  return state;
}
