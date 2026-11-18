import { ShieldCheck } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { formatDateTime } from '../i18n/format';
import { useI18n } from '../i18n/I18nProvider';
import { auditEntries, countByAction } from '../lib/auditTrail';
import type { BatchState } from '../types/reconciliation';

interface Props {
  state: BatchState;
  onOpen: (txId: string) => void;
  /** Reports the ids listed, in order, so the drawer can step through them. */
  onShownChange: (txIds: string[]) => void;
}

/** Every decision recorded in the batch, newest first. Laid out as cards so it reads on any width. */
export function AuditTrailView({ state, onOpen, onShownChange }: Props) {
  const { t, tn, fmt } = useI18n();
  const entries = useMemo(() => auditEntries(state.records), [state.records]);
  const totals = countByAction(entries);

  useEffect(() => onShownChange(entries.map((entry) => entry.record.tx_id)), [entries, onShownChange]);

  return (
    <section aria-labelledby="audit-view-title" className="panel p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="audit-view-title" className="panel-title flex items-center gap-2">
          <ShieldCheck aria-hidden="true" className="h-4 w-4 text-amber-300" />
          {t('audit.viewTitle')}
        </h2>
        <p className="text-sm text-slate-300">
          {tn('audit.count', entries.length)}
          {totals.map(({ action, count }) => ` · ${t(`action.${action}`)}: ${fmt.integer(count)}`)}
        </p>
      </div>
      <p className="mb-4 text-xs text-slate-500">{t('audit.noIdentity')}</p>

      {entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">{t('audit.empty')}</p>
      ) : (
        <ol className="grid gap-3">
          {entries.map(({ record, resolution }) => (
            <li key={record.tx_id} className="rounded-md border border-audited/30 bg-audited/5 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <button
                  type="button"
                  onClick={() => onOpen(record.tx_id)}
                  aria-label={t('row.open', { id: record.tx_id })}
                  className="num font-semibold text-cyan-300 underline-offset-2 hover:underline"
                >
                  {record.tx_id}
                </button>
                <span className="num text-xs text-slate-400">{formatDateTime(resolution.resolved_at)}</span>
              </div>
              <p className="text-sm text-slate-200">{record.counterparty}</p>
              <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{t('audit.decision')}</dt>
                  <dd className="font-semibold text-amber-200">{t(`action.${resolution.action}`)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{t('audit.cause')}</dt>
                  <dd className="text-slate-200">{t(`anomaly.${resolution.anomaly_type}`)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-400">{t('drawer.variance')}</dt>
                  <dd className="num text-slate-200">{fmt.signedMoney(resolution.variance)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">{t('audit.note')}</p>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-100">
                {resolution.resolution_note}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
