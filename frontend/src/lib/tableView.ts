import type { MatchStatus, ReconciledRecord } from '../types/reconciliation';
import type { StatusFilter } from './statusMeta';

export type SortKey = 'tx_id' | 'counterparty' | 'erp_amount' | 'bank_amount' | 'variance' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface Sort {
  key: SortKey;
  direction: SortDirection;
}

export interface TableView {
  filter: StatusFilter;
  query: string;
  /** `null` keeps the order of the batch. */
  sort: Sort | null;
}

// What needs attention comes first when sorting by classification.
const STATUS_ORDER: Record<MatchStatus, number> = {
  ANOMALY: 0,
  RESOLVED: 1,
  TOLERANCE_MATCH: 2,
  EXACT_MATCH: 3,
};

/** Lower case without accents, so "lumiere" finds "Lumière". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Every word of the query must appear in the id, the invoice or the counterparty. */
export function matchesQuery(record: ReconciledRecord, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalize(`${record.tx_id} ${record.invoice_ref} ${record.counterparty}`);
  return words.every((word) => haystack.includes(word));
}

function sortValue(record: ReconciledRecord, key: SortKey): number | string | null {
  switch (key) {
    case 'variance':
      // By size: a shortfall and an excess of the same amount weigh the same.
      return Math.abs(record.variance);
    case 'status':
      return STATUS_ORDER[record.status];
    case 'erp_amount':
    case 'bank_amount':
      return record[key];
    default:
      return normalize(record[key]);
  }
}

function compare(a: ReconciledRecord, b: ReconciledRecord, sort: Sort): number {
  const left = sortValue(a, sort.key);
  const right = sortValue(b, sort.key);
  // A missing amount goes last in both directions: it is not "the smallest".
  if (left === null || right === null) {
    if (left === right) return 0;
    return left === null ? 1 : -1;
  }
  const order =
    typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right), 'en', { numeric: true });
  return sort.direction === 'asc' ? order : -order;
}

/** Filter, search and sort. Records that compare equal keep their batch order. */
export function applyView(records: ReconciledRecord[], view: TableView): ReconciledRecord[] {
  const visible = records.filter(
    (record) =>
      (view.filter === 'ALL' || record.status === view.filter) && matchesQuery(record, view.query),
  );
  const { sort } = view;
  if (!sort) return visible;
  return visible
    .map((record, index) => ({ record, index }))
    .sort((a, b) => compare(a.record, b.record, sort) || a.index - b.index)
    .map(({ record }) => record);
}

const NUMERIC: SortKey[] = ['erp_amount', 'bank_amount', 'variance'];

/**
 * Next state of a column header: first click, second click reverses, third
 * click returns to the batch order. Amounts start with the largest first.
 */
export function nextSort(current: Sort | null, key: SortKey): Sort | null {
  const first: SortDirection = NUMERIC.includes(key) ? 'desc' : 'asc';
  if (current?.key !== key) return { key, direction: first };
  if (current.direction === first) return { key, direction: first === 'asc' ? 'desc' : 'asc' };
  return null;
}
