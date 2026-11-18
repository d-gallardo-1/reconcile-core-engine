import { useMemo, useState } from 'react';
import { FILTERS, type StatusFilter } from '../lib/statusMeta';
import type { BatchState, LiveRun } from '../types/reconciliation';
import { MatchRow } from './MatchRow';

interface Props {
  state: BatchState;
  liveRun: LiveRun | null;
  onOpen: (txId: string) => void;
}

const HEADERS: { label: string; align?: 'right' }[] = [
  { label: 'TX ID' },
  { label: 'Counterparty' },
  { label: 'ERP Amount & Date', align: 'right' },
  { label: 'Bank Amount & Date', align: 'right' },
  { label: 'Tax/VAT Status' },
  { label: 'Variance (£)', align: 'right' },
  { label: 'Match Classification' },
];

export function ThreeWayMatchTable({ state, liveRun, onOpen }: Props) {
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
          Side-by-Side 3-Way Match · ERP / Bank / Tax Registry
        </h2>
        <div role="group" aria-label="Filter by classification" className="flex flex-wrap gap-1">
          {FILTERS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
              className={`rounded-md border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
                filter === option.value
                  ? 'border-tolerance/60 bg-tolerance/15 text-cyan-100'
                  : 'border-edge text-slate-400 hover:border-slate-500 hover:text-slate-200'
              }`}
            >
              {option.label} <span className="num">{counts[option.value] ?? 0}</span>
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
                  key={header.label}
                  scope="col"
                  className={`px-3 py-2 font-semibold ${header.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {header.label}
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
            No records with this classification in the current batch.
          </p>
        )}
      </div>
    </section>
  );
}
