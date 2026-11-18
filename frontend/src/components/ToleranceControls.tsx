import { useEffect, useId, useRef, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { CurrencyInfo, ToleranceConfig } from '../types/reconciliation';

const DAYS_MAX = 5;
const COMMIT_DELAY_MS = 250;

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);

interface Props {
  tolerance: ToleranceConfig;
  /** The amount range and its decimals depend on the batch currency. */
  currency: CurrencyInfo;
  disabled: boolean;
  onCommit: (amount: number, days: number) => Promise<boolean>;
}

/**
 * Amount and date tolerance. While the user drags, a local draft is shown and
 * sent after a short pause; when the server state changes, the draft is dropped
 * so changes made in another tab show up here too.
 */
export function ToleranceControls({ tolerance, currency, disabled, onCommit }: Props) {
  const { t, tn, fmt } = useI18n();
  const amountId = useId();
  const daysId = useId();
  const [draft, setDraft] = useState<ToleranceConfig | null>(null);
  // The draft that was last sent; a newer one is still waiting for its pause.
  const sent = useRef<ToleranceConfig | null>(null);
  const shown = draft ?? tolerance;
  const amountMax = currency.max_amount_tolerance;
  const unit = 10 ** currency.minor_units;

  useEffect(() => {
    if (!draft) return;
    const timer = window.setTimeout(() => {
      sent.current = draft;
      // A refused change (for example during a run) falls back to the server value.
      void onCommit(draft.amount_tolerance, draft.date_window_days).then((accepted) => {
        if (!accepted) setDraft((current) => (current === draft ? null : current));
      });
    }, COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [draft, onCommit]);

  // The server value changed (this tab's commit, another tab, or a new batch
  // currency): it wins, unless a newer local value has not been sent yet.
  useEffect(() => {
    setDraft((current) => (current === sent.current ? null : current));
  }, [tolerance.amount_tolerance, tolerance.date_window_days]);
  useEffect(() => setDraft(null), [currency.code]);

  const setAmount = (raw: string) => {
    const value = Number(raw);
    if (raw === '' || Number.isNaN(value)) return;
    setDraft({ ...shown, amount_tolerance: Math.round(clamp(value, amountMax) * unit) / unit });
  };
  const setDays = (raw: string) => {
    const value = Number(raw);
    if (raw === '' || Number.isNaN(value)) return;
    setDraft({ ...shown, date_window_days: Math.round(clamp(value, DAYS_MAX)) });
  };

  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
      <legend className="sr-only">{t('tol.legend')}</legend>
      <div>
        <label htmlFor={amountId} className="flex items-baseline justify-between text-sm text-slate-300">
          {t('tol.amount')}
          <span className="num text-cyan-300">±{fmt.money(shown.amount_tolerance)}</span>
        </label>
        <div className="mt-2 flex items-center gap-3">
          <input
            id={amountId}
            type="range"
            min={0}
            max={amountMax}
            step={currency.amount_tolerance_step}
            value={shown.amount_tolerance}
            onChange={(event) => setAmount(event.target.value)}
            className="w-full"
          />
          <input
            type="number"
            aria-label={t('tol.amountExact')}
            min={0}
            max={amountMax}
            step={1 / unit}
            value={shown.amount_tolerance}
            onChange={(event) => setAmount(event.target.value)}
            className="field num w-28"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {t('tol.amountHint', { min: fmt.money(0), max: fmt.money(amountMax) })}
        </p>
      </div>
      <div>
        <label htmlFor={daysId} className="flex items-baseline justify-between text-sm text-slate-300">
          {t('tol.window')}
          <span className="num text-cyan-300">±{tn('unit.days', shown.date_window_days)}</span>
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
            aria-label={t('tol.windowExact')}
            min={0}
            max={DAYS_MAX}
            step={1}
            value={shown.date_window_days}
            onChange={(event) => setDays(event.target.value)}
            className="field num w-28"
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {t('tol.windowHint', { max: tn('unit.days', DAYS_MAX) })}
        </p>
      </div>
    </fieldset>
  );
}
