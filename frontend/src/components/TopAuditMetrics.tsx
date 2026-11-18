import { Activity, Banknote, Percent, Scale, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import type { BatchState, StreamStatus } from '../types/reconciliation';

const STREAM: Record<StreamStatus, { tone: string; dot: string }> = {
  CONNECTED: { tone: 'text-emerald-300', dot: 'bg-exact motion-safe:animate-pulse' },
  RECONNECTING: { tone: 'text-amber-300', dot: 'bg-audited' },
  DISCONNECTED: { tone: 'text-red-300', dot: 'bg-anomaly' },
};

function Metric(props: { icon: LucideIcon; title: string; value: ReactNode; detail: ReactNode }) {
  const Icon = props.icon;
  return (
    <div className="panel flex flex-col gap-2 p-4">
      <dt className="panel-title flex items-center gap-2">
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-400" />
        {props.title}
      </dt>
      <dd className="num break-words text-2xl font-semibold text-slate-50">{props.value}</dd>
      <dd className="text-xs text-slate-400">{props.detail}</dd>
    </div>
  );
}

export function TopAuditMetrics({ state, stream }: { state: BatchState; stream: StreamStatus }) {
  const { t, tn, fmt } = useI18n();
  const { kpis, tolerance, run } = state;
  const live = STREAM[stream];
  const variance = kpis.net_unreconciled_variance;
  return (
    <dl aria-label={t('kpi.aria')} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric
        icon={Banknote}
        title={t('kpi.volume')}
        value={fmt.money(kpis.total_ledger_volume)}
        detail={t('kpi.volumeDetail', { records: tn('unit.records', kpis.total_records) })}
      />
      <Metric
        icon={Percent}
        title={t('kpi.matchRate')}
        value={fmt.percent(kpis.match_rate_pct, 1)}
        detail={t('kpi.matchDetail', {
          exact: fmt.integer(kpis.exact_count),
          tolerance: fmt.integer(kpis.tolerance_count),
          resolved: fmt.integer(kpis.resolved_count),
        })}
      />
      <Metric
        icon={Scale}
        title={t('kpi.netVariance')}
        value={<span className={variance === 0 ? '' : 'text-red-300'}>{fmt.signedMoney(variance)}</span>}
        detail={t('kpi.varianceDetail', {
          open: fmt.integer(kpis.anomaly_count),
          amount: fmt.money(kpis.gross_unreconciled_exposure),
        })}
      />
      <Metric
        icon={SlidersHorizontal}
        title={t('kpi.toleranceRules')}
        value={`±${fmt.money(tolerance.amount_tolerance)}`}
        detail={t('kpi.windowDetail', { days: tn('unit.days', tolerance.date_window_days) })}
      />
      <Metric
        icon={Activity}
        title={t('kpi.stream')}
        value={
          <span className={`flex items-center gap-2 font-sans text-xl ${live.tone}`} role="status">
            <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${live.dot}`} />
            {t(`stream.${stream}`)}
          </span>
        }
        detail={
          run.status === 'RUNNING'
            ? t('kpi.runInProgress', { id: run.run_id, percent: fmt.percent(run.percent) })
            : t('kpi.sequence', {
                sequence: state.sequence,
                status: t(`runStatus.${run.status}`),
              })
        }
      />
    </dl>
  );
}
