import type { AnomalyType, ReconciledRecord } from '../types/reconciliation';

/** Only an open anomaly can be selected for resolution. */
export const isSelectable = (record: ReconciledRecord) => record.status === 'ANOMALY';

export function toggle(selected: ReadonlySet<string>, txId: string): Set<string> {
  const next = new Set(selected);
  if (!next.delete(txId)) next.add(txId);
  return next;
}

/**
 * Drops ids that are no longer open anomalies (resolved from another tab, a
 * tolerance change, a reset). Returns the same set when nothing was dropped,
 * so React does not re-render for no reason.
 */
export function pruneSelection(
  selected: ReadonlySet<string>,
  records: ReconciledRecord[],
): ReadonlySet<string> {
  const open = new Set(records.filter(isSelectable).map((record) => record.tx_id));
  const kept = [...selected].filter((txId) => open.has(txId));
  return kept.length === selected.size ? selected : new Set(kept);
}

/** Select every selectable row shown, or clear them if all are already selected. */
export function toggleAll(selected: ReadonlySet<string>, shown: ReconciledRecord[]): Set<string> {
  const ids = shown.filter(isSelectable).map((record) => record.tx_id);
  const next = new Set(selected);
  const allSelected = ids.length > 0 && ids.every((txId) => next.has(txId));
  for (const txId of ids) {
    if (allSelected) next.delete(txId);
    else next.add(txId);
  }
  return next;
}

export interface SelectionSummary {
  /** Selected records, in batch order. */
  records: ReconciledRecord[];
  causes: AnomalyType[];
  /** Signed sum of the variances: what the decision covers in total. */
  total: number;
  /** Several causes cannot be justified by a single note. */
  mixed: boolean;
}

export function summarize(
  selected: ReadonlySet<string>,
  records: ReconciledRecord[],
): SelectionSummary {
  const chosen = records.filter((record) => selected.has(record.tx_id) && isSelectable(record));
  const causes = [...new Set(chosen.flatMap((r) => (r.anomaly_type ? [r.anomaly_type] : [])))];
  // Summed in the smallest unit to avoid float drift on amounts such as 0.60.
  const total = chosen.reduce((sum, record) => sum + Math.round(record.variance * 100), 0) / 100;
  return { records: chosen, causes, total, mixed: causes.length > 1 };
}
