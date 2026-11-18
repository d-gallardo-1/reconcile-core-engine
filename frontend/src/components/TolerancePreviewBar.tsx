import { Check, Undo2 } from 'lucide-react';
import type { PreviewState } from '../hooks/useTolerancePreview';
import { useI18n } from '../i18n/I18nProvider';
import { errorText } from '../lib/errorText';

interface Props {
  preview: PreviewState;
  applying: boolean;
  onApply: () => void;
  onDiscard: () => void;
}

/** What the draft rules would change, with the buttons to apply or drop them. */
export function TolerancePreviewBar({ preview, applying, onApply, onDiscard }: Props) {
  const i18n = useI18n();
  const { t, tn, fmt } = i18n;
  if (preview.kind === 'idle') return null;

  const lines: string[] = [];
  if (preview.kind === 'loading') lines.push(t('tol.calculating'));
  if (preview.kind === 'failed') lines.push(errorText(i18n, preview.failure));
  if (preview.kind === 'ready') {
    const { newly_matched: gained, newly_unmatched: lost, match_rate_pct: rate } = preview.preview;
    if (gained.length > 0) lines.push(`${tn('tol.gain', gained.length)}: ${gained.join(', ')}`);
    if (lost.length > 0) lines.push(`${tn('tol.loss', lost.length)}: ${lost.join(', ')}`);
    if (gained.length === 0 && lost.length === 0) lines.push(t('tol.noChange'));
    lines.push(t('tol.rate', { percent: fmt.percent(rate, 1) }));
  }

  return (
    <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-md border border-tolerance/40 bg-tolerance/5 p-3">
      <div aria-live="polite" className="text-sm text-slate-200">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-cyan-300">
          {t('tol.pending')}
        </p>
        {lines.map((line) => (
          <p key={line} className={preview.kind === 'failed' ? 'text-red-300' : undefined}>
            {line}
          </p>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn" onClick={onDiscard} disabled={applying}>
          <Undo2 aria-hidden="true" className="h-4 w-4" />
          {t('tol.discard')}
        </button>
        <button
          type="button"
          className="btn-primary"
          onClick={onApply}
          disabled={applying || preview.kind !== 'ready'}
        >
          <Check aria-hidden="true" className="h-4 w-4" />
          {t('tol.apply')}
        </button>
      </div>
    </div>
  );
}
