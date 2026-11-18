import type { ReconciledRecord } from '../types/reconciliation';

export interface ExposureItem {
  record: ReconciledRecord;
  /** Absolute variance: what is at stake, whatever its sign. */
  amount: number;
  /** Percentage of the gross open exposure, 0-100. */
  share: number;
}

export interface ExposureRanking {
  items: ExposureItem[];
  /** Sum of the absolute variances of every open anomaly. */
  total: number;
  /** Open anomalies not listed in `items`. */
  restCount: number;
}

/**
 * Open anomalies ranked by the size of their variance, largest first.
 * Resolved and matched records are not exposure. Anomalies without an amount
 * difference (a VAT or date problem) are counted in `restCount`, not ranked.
 */
export function rankExposure(records: ReconciledRecord[], limit = 5): ExposureRanking {
  const open = records.filter((record) => record.status === 'ANOMALY');
  const withAmount = open
    .map((record) => ({ record, amount: Math.abs(record.variance) }))
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.record.tx_id.localeCompare(b.record.tx_id));
  const total = withAmount.reduce((sum, item) => sum + item.amount, 0);
  const items = withAmount
    .slice(0, limit)
    .map((item) => ({ ...item, share: total === 0 ? 0 : (item.amount / total) * 100 }));
  return { items, total, restCount: open.length - items.length };
}
