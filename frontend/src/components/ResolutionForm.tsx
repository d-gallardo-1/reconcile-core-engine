import { Ban, FileMinus2, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useAction } from '../hooks/useAction';
import { useI18n } from '../i18n/I18nProvider';
import type { ResolutionAction } from '../types/reconciliation';

const NOTE_MAX = 500;

const ACTIONS: { action: ResolutionAction; icon: LucideIcon; tone: string }[] = [
  { action: 'APPROVE_VARIANCE', icon: ShieldCheck, tone: 'text-emerald-300' },
  { action: 'FLAG_FOR_CREDIT_NOTE', icon: FileMinus2, tone: 'text-amber-300' },
  { action: 'REJECT', icon: Ban, tone: 'text-red-300' },
];

interface Props {
  /** Sends the decision: for one anomaly or for a whole selection. */
  onResolve: (action: ResolutionAction, note: string) => Promise<unknown>;
  /** Called after the decision was accepted. */
  onResolved?: () => void;
  /** Lay the three decisions out in a row instead of a column. */
  inline?: boolean;
}

/** Audit note plus the three decisions. The result reaches every tab over SSE. */
export function ResolutionForm({ onResolve, onResolved, inline = false }: Props) {
  const { t } = useI18n();
  const noteId = useId();
  const [note, setNote] = useState('');
  const { busy, error, run } = useAction();
  const ready = note.trim().length > 0 && !busy;

  const decide = async (action: ResolutionAction) => {
    const accepted = await run(() => onResolve(action, note.trim()));
    if (!accepted) return;
    setNote('');
    onResolved?.();
  };

  return (
    <form onSubmit={(event) => event.preventDefault()} className="grid gap-3">
      <label htmlFor={noteId} className="text-sm font-medium text-slate-200">
        {t('form.note')} <span className="text-slate-400">{t('form.required')}</span>
      </label>
      <textarea
        id={noteId}
        value={note}
        maxLength={NOTE_MAX}
        rows={inline ? 2 : 3}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t('form.placeholder')}
        className="field resize-y"
      />
      <p className="num text-right text-xs text-slate-500">
        {note.length}/{NOTE_MAX}
      </p>
      <div className={inline ? 'flex flex-wrap gap-2' : 'grid gap-2'}>
        {ACTIONS.map(({ action, icon: Icon, tone }) => (
          <button
            key={action}
            type="button"
            className="btn justify-start"
            disabled={!ready}
            onClick={() => void decide(action)}
          >
            <Icon aria-hidden="true" className={`h-4 w-4 ${tone}`} />
            {t(`action.${action}`)}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">{t('form.immutable')}</p>
      {error && (
        <p role="alert" className="rounded border border-anomaly/50 bg-anomaly/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </form>
  );
}
