import { Download, FlaskConical, Play, RotateCcw } from 'lucide-react';
import { useCallback } from 'react';
import { useAction } from '../hooks/useAction';
import { api } from '../lib/api';
import type { BatchState, LiveRun } from '../types/reconciliation';
import { ToleranceControls } from './ToleranceControls';

function RunProgress({ state, liveRun }: { state: BatchState; liveRun: LiveRun | null }) {
  const { run } = state;
  if (run.status === 'IDLE') return null;
  const progress = liveRun?.progress;
  const running = run.status === 'RUNNING';
  const failed = run.status === 'FAILED';
  const percent = run.status === 'COMPLETED' ? 100 : (progress?.percent ?? run.percent);
  // Pass names come from the server, so both views always use the same wording.
  const passLabel = progress
    ? `Pass ${progress.pass_number} of 3 · ${progress.pass_name}`
    : run.pass_number > 0
      ? `Pass ${run.pass_number} of 3`
      : 'Starting run…';
  return (
    <div aria-live="polite" className="mt-4 border-t border-edge pt-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="text-slate-300">
          {running && passLabel}
          {failed && (
            <span role="alert" className="text-red-300">
              Run #{run.run_id} stopped before finishing ({run.processed} of {run.total} rule
              evaluations). Record statuses below are still correct; run it again.
            </span>
          )}
          {run.status === 'COMPLETED' &&
            `Run #${run.run_id} completed · ${run.total} rule evaluations`}
        </span>
        <span className="num text-slate-400">
          {running && progress?.tx_id ? `${progress.tx_id} · ` : ''}
          {percent.toFixed(0)}%
        </span>
      </div>
      <progress max={100} value={percent} aria-label="Reconciliation run progress" />
    </div>
  );
}

export function ToleranceAndDemoBar({ state, liveRun }: { state: BatchState; liveRun: LiveRun | null }) {
  const { busy, error, run, clearError } = useAction();
  const running = state.run.status === 'RUNNING';
  const locked = busy || running;

  const commitTolerance = useCallback(
    (amountGbp: number, days: number) => run(() => api.setTolerance(amountGbp, days)),
    [run],
  );

  return (
    <section aria-labelledby="demo-bar-title" className="panel p-4">
      <h2 id="demo-bar-title" className="panel-title mb-4">
        Tolerance Rules &amp; Demo Controls
      </h2>
      <ToleranceControls tolerance={state.tolerance} disabled={running} onCommit={commitTolerance} />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-4">
        <button type="button" className="btn-primary" disabled={locked} onClick={() => void run(api.run)}>
          <Play aria-hidden="true" className="h-4 w-4" />
          {running ? 'Reconciliation Running…' : 'Run Live 3-Pass Reconciliation'}
        </button>
        {state.scenarios.map((scenario) => (
          <button
            key={scenario.code}
            type="button"
            className="btn"
            disabled={locked || scenario.active}
            title={scenario.description}
            onClick={() => void run(() => api.inject(scenario.code))}
          >
            <FlaskConical aria-hidden="true" className="h-4 w-4 text-red-300" />
            {scenario.active ? `${scenario.code} Active` : `Inject ${scenario.code} ${scenario.label}`}
          </button>
        ))}
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={locked} onClick={() => void run(api.reset)}>
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Reset Batch
          </button>
          <a className="btn" href={api.exportExcelUrl} download>
            <Download aria-hidden="true" className="h-4 w-4" />
            Export .XLSX Audit Pack
          </a>
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start justify-between gap-3 rounded border border-anomaly/50 bg-anomaly/10 px-3 py-2 text-sm text-red-200">
          {error}
          <button type="button" className="underline" onClick={clearError}>
            Dismiss
          </button>
        </p>
      )}
      <RunProgress state={state} liveRun={liveRun} />
    </section>
  );
}
