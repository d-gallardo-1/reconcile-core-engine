import { formatDate } from '../i18n/format';
import { useI18n } from '../i18n/I18nProvider';
import { isSelectable } from '../lib/selection';
import type { LiveRun, ReconciledRecord } from '../types/reconciliation';
import { PendingBadge, StatusBadge } from './StatusBadge';

interface Props {
  rows: ReconciledRecord[];
  liveRun: LiveRun | null;
  selected: ReadonlySet<string>;
  onToggle: (txId: string) => void;
  onOpen: (txId: string) => void;
}

/**
 * The match table as stacked cards, for screens too narrow for seven columns.
 * Same records, same selection and the same way into the detail drawer.
 */
export function MatchCardList({ rows, liveRun, selected, onToggle, onOpen }: Props) {
  const { t, fmt } = useI18n();
  return (
    <ul className="grid gap-2 border-t border-edge p-3">
      {rows.map((record) => {
        const liveStatus = liveRun?.overlay ? (liveRun.verdicts[record.tx_id] ?? null) : undefined;
        const variance = record.variance;
        const tone = variance === 0 ? 'text-slate-400' : variance < 0 ? 'text-red-300' : 'text-amber-300';
        return (
          <li
            key={record.tx_id}
            className={`rounded-md border border-edge p-3 ${selected.has(record.tx_id) ? 'bg-tolerance/10' : 'bg-obsidian'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                {isSelectable(record) && (
                  <input
                    type="checkbox"
                    checked={selected.has(record.tx_id)}
                    onChange={() => onToggle(record.tx_id)}
                    aria-label={t('bulk.select', { id: record.tx_id })}
                    className="mt-1 h-5 w-5 accent-cyan-500"
                  />
                )}
                <div>
                  <button
                    type="button"
                    onClick={() => onOpen(record.tx_id)}
                    aria-label={t('row.open', { id: record.tx_id })}
                    className="num font-semibold text-cyan-300 underline-offset-2 hover:underline"
                  >
                    {record.tx_id}
                  </button>
                  <p className="text-sm text-slate-200">{record.counterparty}</p>
                </div>
              </div>
              {liveStatus === null ? <PendingBadge /> : <StatusBadge status={liveStatus ?? record.status} />}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
              <div>
                <dt className="text-xs text-slate-400">{t('col.erp')}</dt>
                <dd className="num text-slate-100">
                  {record.erp_amount === null ? t('row.noEntry') : fmt.money(record.erp_amount)}
                </dd>
                <dd className="num text-xs text-slate-400">{formatDate(record.erp_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{t('col.bank')}</dt>
                <dd className="num text-slate-100">
                  {record.bank_amount === null ? t('row.noEntry') : fmt.money(record.bank_amount)}
                </dd>
                <dd className="num text-xs text-slate-400">{formatDate(record.bank_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{t('col.variance')}</dt>
                <dd className={`num ${tone}`}>{fmt.signedMoney(variance)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-400">{t('col.tax')}</dt>
                <dd className="text-slate-200">{t(`taxCheck.${record.tax_check}`)}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
