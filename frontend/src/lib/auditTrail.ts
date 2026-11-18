import type { ReconciledRecord, Resolution, ResolutionAction } from '../types/reconciliation';

export interface AuditEntry {
  record: ReconciledRecord;
  resolution: Resolution;
}

/** Every recorded decision, newest first; ties keep the batch order. */
export function auditEntries(records: ReconciledRecord[]): AuditEntry[] {
  return records
    .flatMap((record, index) =>
      record.resolution ? [{ record, resolution: record.resolution, index }] : [],
    )
    .sort(
      (a, b) =>
        Date.parse(b.resolution.resolved_at) - Date.parse(a.resolution.resolved_at) ||
        a.index - b.index,
    )
    .map(({ record, resolution }) => ({ record, resolution }));
}

/** How many decisions of each kind were taken, in a fixed order. */
export function countByAction(entries: AuditEntry[]): { action: ResolutionAction; count: number }[] {
  const order: ResolutionAction[] = ['APPROVE_VARIANCE', 'FLAG_FOR_CREDIT_NOTE', 'REJECT'];
  return order
    .map((action) => ({
      action,
      count: entries.filter((entry) => entry.resolution.action === action).length,
    }))
    .filter((item) => item.count > 0);
}
