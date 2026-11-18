import { useEffect, useId, useState } from 'react';
import { useTolerancePreview } from '../hooks/useTolerancePreview';
import { useI18n } from '../i18n/I18nProvider';
import type { CurrencyInfo, ToleranceConfig, TolerancePreview } from '../types/reconciliation';
import { TolerancePreviewBar } from './TolerancePreviewBar';

const DAYS_MAX = 5;

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max);
const same = (a: ToleranceConfig, b: ToleranceConfig) =>
  a.amount_tolerance === b.amount_tolerance && a.date_window_days === b.date_window_days;

interface Props {
  tolerance: ToleranceConfig;
  /** The amount range and its decimals depend on the batch currency. */
  currency: CurrencyInfo;
  disabled: boolean;
  /** Changes whenever the applied batch changes, so a draft is previewed again. */
  revision: string;
  onPreview: (amount: number, days: number) => Promise<TolerancePreview>;
  onApply: (amount: number, days: number) => Promise<boolean>;
}

/**
 * Amount and date tolerance. Moving a control only edits a draft: the panel
 * shows what the draft would change, and nothing happens to the batch until
 * the user applies it.
 */
export function ToleranceControls({ tolerance, currency, disabled, revision, onPreview, onApply }: Props) {
  const { t, tn, fmt } = useI18n();
  const amountId = useId();
  const daysId = useId();
  const [draft, setDraft] = useState<ToleranceConfig | null>(null);
  const [applying, setApplying] = useState(false);
  const shown = draft ?? tolerance;
  const amountMax = currency.max_amount_tolerance;
  const unit = 10 ** currency.minor_units;
  const preview = useTolerancePreview(draft, revision, onPreview);

  // An amount typed for one currency means nothing in another.
  useEffect(() => setDraft(null), [currency.code]);

  // Editing back to the applied value is the same as discarding.
  const edit = (next: ToleranceConfig) => setDraft(same(next, tolerance) ? null : next);

  const setAmount = (raw: string) => {
    const value = Number(raw);
    if (raw === '' || Number.isNaN(value)) return;
    edit({ ...shown, amount_tolerance: Math.round(clamp(value, amountMax) * unit) / unit });
  };
  const setDays = (raw: string) => {
    const value = Number(raw);
    if (raw === '' || Number.isNaN(value)) return;
    edit({ ...shown, date_window_days: Math.round(clamp(value, DAYS_MAX)) });
  };

  const apply = async () => {
    if (!draft) return;
    setApplying(true);
    const accepted = await onApply(draft.amount_tolerance, draft.date_window_days);
    setApplying(false);
    // A refused change keeps the draft, so the user can adjust and try again.
    if (accepted) setDraft((current) => (current === draft ? null : current));
  };

  return (
    <>
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
      <TolerancePreviewBar
        preview={preview}
        applying={applying || disabled}
        onApply={() => void apply()}
        onDiscard={() => setDraft(null)}
      />
    </>
  );
}
