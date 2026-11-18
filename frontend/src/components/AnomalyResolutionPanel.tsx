import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatDateTime, formatDayShift, formatVariance, humanize } from '../lib/format';
import type { ReconciledRecord } from '../types/reconciliation';
import { ResolutionForm } from './ResolutionForm';
import { SourceComparison } from './SourceComparison';
import { StatusBadge } from './StatusBadge';

interface Props {
  record: ReconciledRecord;
  onClose: () => void;
}

/** Drawer with the 3-source comparison, the verdict and the audit trail. */
export function AnomalyResolutionPanel({ record, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = `drawer-title-${record.tx_id}`;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  const resolution = record.resolution;
  return (
    <div className="fixed inset-0 z-20 flex justify-end">
      <div aria-hidden="true" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-edge bg-panel p-5 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <h3 id={titleId} className="num text-lg font-semibold text-slate-50">
              {record.tx_id}
            </h3>
            <p className="text-sm text-slate-300">{record.counterparty}</p>
            <p className="num text-xs text-slate-500">{record.invoice_ref}</p>
          </div>
          <button ref={closeRef} type="button" className="btn px-2" onClick={onClose} aria-label="Close details">
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={record.status} />
          {record.anomaly_type && (
            <span className="rounded border border-edge px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
              {humanize(record.anomaly_type)}
            </span>
          )}
          {record.scenario_code && (
            <span className="num rounded border border-edge px-2 py-1 text-[11px] text-slate-400">
              {record.scenario_code}
            </span>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3 rounded-md border border-edge bg-obsidian p-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Variance</dt>
            <dd className={`num text-lg ${record.variance_gbp === 0 ? 'text-slate-200' : 'text-red-300'}`}>
              {formatVariance(record.variance_gbp)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Settlement shift</dt>
            <dd className="num text-lg text-slate-200">{formatDayShift(record.date_shift_days)}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs uppercase tracking-wide text-slate-400">
              Decided in pass {record.matched_in_pass}
            </dt>
            <dd className="text-slate-200">{record.explanation}</dd>
          </div>
        </dl>

        <SourceComparison record={record} />

        {record.status === 'ANOMALY' && <ResolutionForm txId={record.tx_id} />}
        {resolution && (
          <section aria-label="Audit trail" className="rounded-md border border-audited/40 bg-audited/10 p-3 text-sm">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-300">Audit Trail</h4>
            <dl className="grid gap-1">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Decision</dt>
                <dd className="font-semibold text-slate-100">{humanize(resolution.action)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-400">Recorded</dt>
                <dd className="num text-slate-100">{formatDateTime(resolution.resolved_at)}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Note</dt>
                <dd className="whitespace-pre-wrap break-words text-slate-100">{resolution.resolution_note}</dd>
              </div>
            </dl>
          </section>
        )}
      </aside>
    </div>
  );
}
