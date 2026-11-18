import { ListChecks, X } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import { api } from '../lib/api';
import type { SelectionSummary } from '../lib/selection';
import { ResolutionForm } from './ResolutionForm';

interface Props {
  selection: SelectionSummary;
  onClear: () => void;
}

/**
 * One decision and one note for every selected anomaly. Offered only when the
 * selection has a single cause: one note cannot justify unrelated problems.
 */
export function BulkResolveBar({ selection, onClear }: Props) {
  const { t, tn, fmt } = useI18n();
  const count = selection.records.length;
  if (count === 0) return null;
  const ids = selection.records.map((record) => record.tx_id);

  return (
    <div className="border-t border-edge bg-tolerance/5 p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <ListChecks aria-hidden="true" className="h-4 w-4" />
            {t('bulk.title')}
          </h3>
          <p role="status" className="mt-1 text-sm text-slate-300">
            {tn('bulk.selected', count)} · {t('bulk.total', { amount: fmt.signedMoney(selection.total) })}
          </p>
          <p className="num mt-1 text-xs text-slate-400">{ids.join(', ')}</p>
          <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {selection.causes.map((cause) => t(`anomaly.${cause}`)).join(' · ')}
          </p>
        </div>
        <button type="button" className="btn" onClick={onClear}>
          <X aria-hidden="true" className="h-4 w-4" />
          {t('bulk.clear')}
        </button>
      </div>
      {selection.mixed ? (
        <p role="alert" className="rounded border border-audited/40 bg-audited/10 px-3 py-2 text-sm text-amber-200">
          {t('bulk.mixed')}
        </p>
      ) : (
        <ResolutionForm
          inline
          onResolve={(action, note) => api.resolveMany(ids, action, note)}
          onResolved={onClear}
        />
      )}
    </div>
  );
}
