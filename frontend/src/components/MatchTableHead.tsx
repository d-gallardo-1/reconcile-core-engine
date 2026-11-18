import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useI18n } from '../i18n/I18nProvider';
import type { MessageKey } from '../i18n/messages/types';
import type { Sort, SortKey } from '../lib/tableView';

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

interface Props {
  currencyCode: string;
  sort: Sort | null;
  onSort: (key: SortKey) => void;
  /** State of the "select all shown" box; `null` when no row can be selected. */
  allSelected: boolean | null;
  onToggleAll: () => void;
}

/** Column headers: sortable where it makes sense, plus the select-all box. */
export function MatchTableHead({ currencyCode, sort, onSort, allSelected, onToggleAll }: Props) {
  const { t } = useI18n();
  return (
    <thead>
      <tr className="bg-obsidian/60 text-xs uppercase tracking-wide text-slate-400">
        <th scope="col" className="w-8 px-3 py-2 text-left">
          {allSelected !== null && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleAll}
              aria-label={t('bulk.selectAll')}
              title={t('bulk.selectAll')}
              className="h-4 w-4 accent-cyan-500"
            />
          )}
        </th>
        {HEADERS.map((header) => {
          const suffix = header.key === 'col.variance' ? ` (${currencyCode})` : '';
          const label = `${t(header.key)}${suffix}`;
          const sortKey = header.sort;
          const active = sortKey !== undefined && sort?.key === sortKey ? sort : null;
          const Icon = active ? (active.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
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
                  onClick={() => onSort(sortKey)}
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
  );
}
