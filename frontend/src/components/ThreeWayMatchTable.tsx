import { Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useIsWide } from '../hooks/useIsWide';
import { useI18n } from '../i18n/I18nProvider';
import { isSelectable, pruneSelection, summarize, toggle, toggleAll } from '../lib/selection';
import { FILTERS, type StatusFilter } from '../lib/statusMeta';
import { applyView, nextSort, type Sort } from '../lib/tableView';
import type { BatchState, LiveRun } from '../types/reconciliation';
import { BulkResolveBar } from './BulkResolveBar';
import { MatchCardList } from './MatchCardList';
import { MatchRow } from './MatchRow';
import { MatchTableHead } from './MatchTableHead';
import { MobileSort } from './MobileSort';

interface Props {
  state: BatchState;
  liveRun: LiveRun | null;
  onOpen: (txId: string) => void;
  /** Reports the ids shown, in order, so the drawer can step through them. */
  onShownChange: (txIds: string[]) => void;
}

export function ThreeWayMatchTable({ state, liveRun, onOpen, onShownChange }: Props) {
  const { t, fmt } = useI18n();
  const searchId = useId();
  const wide = useIsWide();
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const counts = useMemo(() => {
    const result: Record<string, number> = { ALL: state.records.length };
    for (const record of state.records) result[record.status] = (result[record.status] ?? 0) + 1;
    return result;
  }, [state.records]);

  const rows = useMemo(
    () => applyView(state.records, { filter, query, sort }),
    [state.records, filter, query, sort],
  );

  useEffect(() => onShownChange(rows.map((record) => record.tx_id)), [rows, onShownChange]);
  // A record resolved elsewhere, or matched by new rules, leaves the selection.
  useEffect(() => setSelected((current) => pruneSelection(current, state.records)), [state.records]);

  const selection = useMemo(() => summarize(selected, state.records), [selected, state.records]);
  const selectable = rows.filter(isSelectable);
  const allSelected =
    selectable.length === 0 ? null : selectable.every((record) => selected.has(record.tx_id));

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
        {!wide && <MobileSort sort={sort} onChange={setSort} />}
      </div>

      <BulkResolveBar selection={selection} onClear={() => setSelected(new Set())} />

      {!wide && (
        <MatchCardList
          rows={rows}
          liveRun={liveRun}
          selected={selected}
          onToggle={(txId) => setSelected((current) => toggle(current, txId))}
          onOpen={onOpen}
        />
      )}
      {wide && (
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1020px] border-collapse text-sm">
          <MatchTableHead
            currencyCode={state.currency.code}
            sort={sort}
            onSort={(key) => setSort((current) => nextSort(current, key))}
            allSelected={allSelected}
            onToggleAll={() => setSelected((current) => toggleAll(current, rows))}
          />
          <tbody>
            {rows.map((record) => (
              <MatchRow
                key={record.tx_id}
                record={record}
                liveStatus={liveRun?.overlay ? (liveRun.verdicts[record.tx_id] ?? null) : undefined}
                current={liveRun?.progress?.tx_id === record.tx_id}
                selected={selected.has(record.tx_id)}
                onToggle={(txId) => setSelected((current) => toggle(current, txId))}
                onOpen={onOpen}
              />
            ))}
          </tbody>
        </table>
      </div>
      )}
      {rows.length === 0 && (
        <p className="border-t border-edge p-6 text-center text-sm text-slate-400">
          {query.trim() ? t('table.noMatch') : t('table.empty')}
        </p>
      )}
    </section>
  );
}
