import { Hourglass } from 'lucide-react';
import { STATUS_META } from '../lib/statusMeta';
import type { MatchStatus } from '../types/reconciliation';

const BASE =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded border px-2 py-1 text-[11px] font-semibold tracking-wide';

/** Colour + icon + text label, so the status never depends on colour alone. */
export function StatusBadge({ status }: { status: MatchStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`${BASE} ${meta.badge}`}>
      <Icon
        aria-hidden="true"
        className={`h-3.5 w-3.5 shrink-0 ${meta.pulse ? 'motion-safe:animate-pulse' : ''}`}
      />
      {meta.label}
    </span>
  );
}

/** Shown during a live run for records no pass has decided yet. */
export function PendingBadge() {
  return (
    <span className={`${BASE} border-edge bg-obsidian text-slate-400`}>
      <Hourglass aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      IN QUEUE
    </span>
  );
}
