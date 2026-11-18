import { Activity, Banknote, Percent, Scale, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatGbp, formatVariance } from '../lib/format';
import type { BatchState, StreamStatus } from '../types/reconciliation';

const STREAM: Record<StreamStatus, { label: string; tone: string; dot: string }> = {
  CONNECTED: { label: 'LIVE', tone: 'text-emerald-300', dot: 'bg-exact motion-safe:animate-pulse' },
  RECONNECTING: { label: 'RECONNECTING', tone: 'text-amber-300', dot: 'bg-audited' },
  DISCONNECTED: { label: 'OFFLINE', tone: 'text-red-300', dot: 'bg-anomaly' },
};

function Metric(props: { icon: LucideIcon; title: string; value: ReactNode; detail: ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="panel flex flex-col gap-2 p-4">
      <dt className="panel-title flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 text-slate-500" />
        {props.title}
      </dt>
      <dd className="num text-2xl font-semibold text-slate-50">{props.value}</dd>
      <dd className="text-xs text-slate-400">{props.detail}</dd>
    </div>
  );
}

export function TopAuditMetrics({ state, stream }: { state: BatchState; stream: StreamStatus }) {
  const { kpis, tolerance, run } = state;
  const live = STREAM[stream];
  const variance = kpis.net_unreconciled_variance_gbp;
  return (
    <dl aria-label="Batch key figures" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric
        icon={Banknote}
        title="Total Ledger Volume"
        value={formatGbp(kpis.total_ledger_volume_gbp)}
        detail={`${kpis.total_records} records · ERP gross`}
      />
      <Metric
        icon={Percent}
        title="Match Rate"
        value={`${kpis.match_rate_pct.toFixed(1)}%`}
        detail={`${kpis.exact_count} exact · ${kpis.tolerance_count} tolerance · ${kpis.resolved_count} resolved`}
      />
      <Metric
        icon={Scale}
        title="Net Unreconciled Variance"
        value={
          <span className={variance === 0 ? '' : 'text-red-300'}>{formatVariance(variance)}</span>
        }
        detail={`${kpis.anomaly_count} open · gross exposure ${formatGbp(kpis.gross_unreconciled_exposure_gbp)}`}
      />
      <Metric
        icon={SlidersHorizontal}
        title="Active Tolerance Rules"
        value={`±${formatGbp(tolerance.amount_tolerance_gbp)}`}
        detail={`±${tolerance.date_window_days} day${tolerance.date_window_days === 1 ? '' : 's'} settlement window`}
      />
      <Metric
        icon={Activity}
        title="SSE Engine Status"
        value={
          <span className={`flex items-center gap-2 font-sans text-xl ${live.tone}`} role="status">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${live.dot}`} />
            {live.label}
          </span>
        }
        detail={
          run.status === 'RUNNING'
            ? `Run #${run.run_id} in progress · ${run.percent.toFixed(0)}%`
            : `Event sequence ${state.sequence} · run ${run.status.toLowerCase()}`
        }
      />
    </dl>
  );
}
