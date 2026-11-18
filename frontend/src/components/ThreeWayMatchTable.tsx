import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages/types';
import { FILTERS, type StatusFilter } from '../lib/statusMeta';
import type { BatchState, LiveRun } from '../types/reconciliation';
import { MatchRow } from './MatchRow';

interface Props {
  state: BatchState;
  liveRun: LiveRun | null;
  onOpen: (txId: string) => void;
}

const HEADERS: { key: MessageKey; align?: 'right' }[] = [
  { key: 'col.txId' },
  { key: 'col.counterparty' },
  { key: 'col.erp', align: 'right' },
  { key: 'col.bank', align: 'right' },
  { key: 'col.tax' },
  { key: 'col.variance', align: 'right' },
  { key: 'col.classification' },
];

export function ThreeWayMatchTable({ state, liveRun, onOpen }: Props) {
  const { t, fmt } = useI18n();
  const [filter, setFilter] = useState<StatusFilter>('ALL');

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: state.records.length };
    for (const record of state.records) result[record.status] = (result[record.status] ?? 0) + 1;
    return result;
  }, [state.records]);

  const rows = filter === 'ALL' ? state.records : state.records.filter((r) => r.status === filter);

  return (
    <section aria-labelledby="match-table-title" className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h2 id="match-table-title" className="panel-title">
          {t('table.title')}
        </h2>
        <div role="group" aria-label={t('filter.aria')} className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => setFilter(option)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
                filter === option
                  ? 'border-tolerance/60 bg-tolerance/15 text-cyan-100'
                  : 'border-edge text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              {t(`filter.${option}`)} <span className="num">{fmt.integer(counts[option] ?? 0)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="bg-obsidian/60 text-xs uppercase tracking-wide text-slate-400">
              {HEADERS.map((header) => (
                <th
                  key={header.key}
                  scope="col"
                  className={`px-3 py-2 font-semibold ${header.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {t(header.key)}
                  {header.key === 'col.variance' ? ` (${state.currency.code})` : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <MatchRow
                key={record.tx_id}
                record={record}
                liveStatus={liveRun?.overlay ? (liveRun.verdicts[record.tx_id] ?? null) : undefined}
                current={liveRun?.progress?.tx_id === record.tx_id}
                onOpen={onOpen}
              />
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="border-t border-edge p-6 text-center text-sm text-slate-400">
            {t('table.empty')}
          </p>
        )}
      </div>
    </section>
  );
}
