import { useI18n } from '../i18n/I18nProvider';
import type { BatchState, LiveRun } from '../types/reconciliation';

/** Progress bar and status line of the live run. */
export function RunProgress({ state, liveRun }: { state: BatchState; liveRun: LiveRun | null }) {
  const { t, tCode, fmt } = useI18n();
  const { run } = state;
  if (run.status === 'IDLE') return null;
  const progress = liveRun?.progress;
  const running = run.status === 'RUNNING';
  const percent = run.status === 'COMPLETED' ? 100 : (progress?.percent ?? run.percent);
  const passNumber = progress?.pass_number ?? run.pass_number;
  const passLabel =
    passNumber > 0
      ? t('run.pass', {
          number: passNumber,
          name: tCode('pass', String(passNumber), progress?.pass_name ?? ''),
        })
      : t('run.starting');
  return (
    <div aria-live="polite" className="mt-4 border-t border-edge pt-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-slate-300">
          {running && passLabel}
          {run.status === 'FAILED' && (
            <span role="alert" className="text-red-300">
              {t('run.failed', { id: run.run_id, processed: run.processed, total: run.total })}
            </span>
          )}
          {run.status === 'COMPLETED' && t('run.completed', { id: run.run_id, total: run.total })}
        </span>
        <span className="num text-slate-400">
          {running && progress?.tx_id ? `${progress.tx_id} · ` : ''}
          {fmt.percent(percent)}
        </span>
      </div>
      <progress max={100} value={percent} aria-label={t('run.progressAria')} />
    </div>
  );
}
