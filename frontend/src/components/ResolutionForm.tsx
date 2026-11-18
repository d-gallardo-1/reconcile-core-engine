import { Ban, FileMinus2, ShieldCheck, type LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { useAction } from '../hooks/useAction';
import { useI18n } from '../i18n/I18nProvider';
import { api } from '../lib/api';
import type { ResolutionAction } from '../types/reconciliation';

const NOTE_MAX = 500;

const ACTIONS: { action: ResolutionAction; icon: LucideIcon; tone: string }[] = [
  { action: 'APPROVE_VARIANCE', icon: ShieldCheck, tone: 'text-emerald-300' },
  { action: 'FLAG_FOR_CREDIT_NOTE', icon: FileMinus2, tone: 'text-amber-300' },
  { action: 'REJECT', icon: Ban, tone: 'text-red-300' },
];

/** Audit note plus the three decisions. The result reaches every tab over SSE. */
export function ResolutionForm({ txId }: { txId: string }) {
  const { t } = useI18n();
  const noteId = useId();
  const [note, setNote] = useState('');
  const { busy, error, run } = useAction();
  const ready = note.trim().length > 0 && !busy;

  return (
    <form onSubmit={(event) => event.preventDefault()} className="grid gap-3">
      <label htmlFor={noteId} className="text-sm font-medium text-slate-200">
        {t('form.note')} <span className="text-slate-400">{t('form.required')}</span>
      </label>
      <textarea
        id={noteId}
        value={note}
        maxLength={NOTE_MAX}
        rows={3}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t('form.placeholder')}
        className="field resize-y"
      />
      <p className="num text-right text-xs text-slate-500">
        {note.length}/{NOTE_MAX}
      </p>
      <div className="grid gap-2">
        {ACTIONS.map(({ action, icon: Icon, tone }) => (
          <button
            key={action}
            type="button"
            className="btn justify-start"
            disabled={!ready}
            onClick={() => void run(() => api.resolve(txId, action, note.trim()))}
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
