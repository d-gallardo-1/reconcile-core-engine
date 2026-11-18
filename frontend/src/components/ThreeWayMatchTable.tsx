import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages/types';
import { FILTERS, type StatusFilter } from '../lib/statusMeta';
import { applyView, nextSort, type Sort, type SortKey } from '../lib/tableView';
import type { BatchState, LiveRun } from '../types/reconciliation';
import { MatchRow } from './MatchRow';

interface Props {
  state: BatchState;
  liveRun: LiveRun | null;
  onOpen: (txId: string) => void;
}

const HEADERS: { key: MessageKey; sort?: SortKey; align?: 'right' }[] = [
  { key: 'col.txId', sort: 'tx_id' },
  { key: 'col.counterparty', sort: 'counterparty' },
  { key: 'col.erp', sort: 'erp_amount', align: 'right' },
  { key: 'col.bank', sort: 'bank_amount', align: 'right' },
  { key: 'col.tax' },
  { key: 'col.variance', sort: 'variance', align: 'right' },
  { key: 'col.classification', sort: 'status' },
];

const ARIA_SORT = { asc: 'ascending', desc: 'descending' } as const;

export function ThreeWayMatchTable({ state, liveRun, onOpen }: Props) {
  const { t, fmt } = useI18n();
  const searchId = useId();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort | null>(null);

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: state.records.length };
    for (const record of state.records) result[record.status] = (result[record.status] ?? 0) + 1;
    return result;
  }, [state.records]);

  const rows = useMemo(
    () => applyView(state.records, { filter, query, sort }),
    [state.records, filter, query, sort],
  );

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

      <div className="flex flex-wrap items-center gap-3 border-t border-edge px-4 py-3">
        <label htmlFor={searchId} className="sr-only">
          {t('table.search')}
        </label>
        <div className="relative w-full max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-500" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('table.searchPlaceholder')}
            className="field w-full pl-8 pr-8"
          />
          {query && (
            <button
              type="button"
              aria-label={t('common.dismiss')}
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1.5 rounded p-0.5 text-slate-400 hover:text-slate-100"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          )}
        </div>
        <p role="status" className="num text-xs text-slate-400">
          {t('table.count', { shown: fmt.integer(rows.length), total: fmt.integer(state.records.length) })}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="bg-obsidian/60 text-xs uppercase tracking-wide text-slate-400">
              {HEADERS.map((header) => {
                const label = `${t(header.key)}${header.key === 'col.variance' ? ` (${state.currency.code})` : ''}`;
                const active = header.sort !== undefined && sort?.key === header.sort ? sort : null;
                const Icon = active ? (active.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                const sortKey = header.sort;
                return (
                  <th
                    key={header.key}
                    scope="col"
                    aria-sort={active ? ARIA_SORT[active.direction] : sortKey ? 'none' : undefined}
                    className={`px-3 py-2 font-semibold ${header.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {sortKey ? (
                      <button
                        type="button"
                        title={t('sort.by', { column: label })}
                        onClick={() => setSort((current) => nextSort(current, sortKey))}
                        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-slate-100 ${active ? 'text-cyan-200' : ''}`}
                      >
                        {label}
                        <Icon aria-hidden="true" className={`h-3.5 w-3.5 ${active ? '' : 'opacity-40'}`} />
                      </button>
                    ) : (
                      label
                    )}
                  </th>
                );
              })}
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
            {query.trim() ? t('table.noMatch') : t('table.empty')}
          </p>
        )}
      </div>
    </section>
  );
}
