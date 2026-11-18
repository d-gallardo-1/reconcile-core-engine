import { useEffect, useId, useState } from 'react';
import type { ToleranceConfig } from '../types/reconciliation';

const AMOUNT_MAX = 50;
const DAYS_MAX = 5;
const COMMIT_DELAY_MS = 250;

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

interface Props {
  tolerance: ToleranceConfig;
  disabled: boolean;
  onCommit: (amountGbp: number, days: number) => Promise<boolean>;
}

/**
 * Amount and date tolerance. While the user drags, a local draft is shown and
 * sent after a short pause; when the server state changes, the draft is dropped
 * so changes made in another tab show up here too.
 */
export function ToleranceControls({ tolerance, disabled, onCommit }: Props) {
  const amountId = useId();
  const daysId = useId();
  const [draft, setDraft] = useState<ToleranceConfig | null>(null);
  const shown = draft ?? tolerance;

  useEffect(() => {
    if (!draft) return;
    const timer = window.setTimeout(() => {
      // A refused change (for example during a run) falls back to the server value.
      void onCommit(draft.amount_tolerance_gbp, draft.date_window_days).then((accepted) => {
        if (!accepted) setDraft(null);
      });
    }, COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, onCommit]);

  // The server value changed (this tab's commit or another tab): it wins.
  useEffect(() => setDraft(null), [tolerance.amount_tolerance_gbp, tolerance.date_window_days]);

  const setAmount = (raw: string) => {
    const value = Number(raw);
    if (raw === '' || Number.isNaN(value)) return;
    setDraft({ ...shown, amount_tolerance_gbp: Math.round(clamp(value, AMOUNT_MAX) * 100) / 100 });
  };
  const setDays = (raw: string) => {
    const value = Number(raw);
    if (raw === '' || Number.isNaN(value)) return;
    setDraft({ ...shown, date_window_days: Math.round(clamp(value, DAYS_MAX)) });
  };

  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
      <legend className="sr-only">Tolerance rules</legend>
      <div>
        <label htmlFor={amountId} className="flex items-baseline justify-between text-sm text-slate-300">
          Amount Tolerance
          <span className="num text-cyan-300">±£{shown.amount_tolerance_gbp.toFixed(2)}</span>
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            id={amountId}
            type="range"
            min={0}
            max={AMOUNT_MAX}
            step={0.5}
            value={shown.amount_tolerance_gbp}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full"
          />
          <input
            type="number"
            aria-label="Amount tolerance in pounds, exact value"
            min={0}
            max={AMOUNT_MAX}
            step={0.01}
            value={shown.amount_tolerance_gbp}
            onChange={(event) => setAmount(event.target.value)}
            className="field num w-24"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">£0 – £50 · absorbs wire fees and FX rounding</p>
      </div>
      <div>
        <label htmlFor={daysId} className="flex items-baseline justify-between text-sm text-slate-300">
          Date Window
          <span className="num text-cyan-300">
            ±{shown.date_window_days} day{shown.date_window_days === 1 ? '' : 's'}
          </span>
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            id={daysId}
            type="range"
            min={0}
            max={DAYS_MAX}
            step={1}
            value={shown.date_window_days}
            onChange={(event) => setDays(event.target.value)}
            className="w-full"
          />
          <input
            type="number"
            aria-label="Date window in days, exact value"
            min={0}
            max={DAYS_MAX}
            step={1}
            value={shown.date_window_days}
            onChange={(event) => setDays(event.target.value)}
            className="field num w-24"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">0 – 5 days · absorbs bank clearing lag</p>
      </div>
    </fieldset>
  );
}
