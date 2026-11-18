import { Coins, Download, FlaskConical, Play, RotateCcw } from 'lucide-react';
import { useCallback, useId } from 'react';
import { useAction } from '../hooks/useAction';
import { useI18n } from '../i18n/I18nProvider';
import { api } from '../lib/api';
import type { BatchState, LiveRun } from '../types/reconciliation';
import { RunProgress } from './RunProgress';
import { ToleranceControls } from './ToleranceControls';

export function ToleranceAndDemoBar({ state, liveRun }: { state: BatchState; liveRun: LiveRun | null }) {
  const { t, tCode, fmt } = useI18n();
  const { busy, error, run, clearError } = useAction();
  const currencyId = useId();
  const running = state.run.status === 'RUNNING';
  const locked = busy || running;

  const applyTolerance = useCallback(
    (amount: number, days: number) => run(() => api.setTolerance(amount, days)),
    [run],
  );

  return (
    <section aria-labelledby="demo-bar-title" className="panel p-4">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <h2 id="demo-bar-title" className="panel-title">
          {t('demo.title')}
        </h2>
        <div className="text-right">
          <label htmlFor={currencyId} className="flex items-center justify-end gap-2 text-sm text-slate-300">
            <Coins aria-hidden="true" className="h-4 w-4 text-slate-500" />
            {t('demo.currency')}
            <select
              id={currencyId}
              className="field num"
              value={state.currency.code}
              disabled={locked}
              onChange={(event) => void run(() => api.setCurrency(event.target.value))}
            >
              {state.available_currencies.map((code) => (
                <option key={code} value={code}>
                  {code} · {fmt.currencyName(code)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-1 text-xs text-slate-500">{t('demo.currencyHint')}</p>
        </div>
      </div>

      <ToleranceControls
        tolerance={state.tolerance}
        currency={state.currency}
        disabled={running}
        revision={`${state.sequence}`}
        onPreview={api.previewTolerance}
        onApply={applyTolerance}
      />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-4">
        <button type="button" className="btn-primary" disabled={locked} onClick={() => void run(api.run)}>
          <Play aria-hidden="true" className="h-4 w-4" />
          {running ? t('demo.running') : t('demo.run')}
        </button>
        {state.scenarios.map((scenario) => {
          const label = tCode('scenario', `${scenario.code}.label`, scenario.label);
          return (
            <button
              key={scenario.code}
              type="button"
              className="btn"
              disabled={locked || scenario.active}
              title={tCode('scenario', `${scenario.code}.description`, scenario.description)}
              onClick={() => void run(() => api.inject(scenario.code))}
            >
              <FlaskConical aria-hidden="true" className="h-4 w-4 text-red-300" />
              {scenario.active
                ? t('demo.active', { code: scenario.code })
                : t('demo.inject', { code: scenario.code, label })}
            </button>
          );
        })}
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={locked} onClick={() => void run(api.reset)}>
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            {t('demo.reset')}
          </button>
          <a className="btn" href={api.exportExcelUrl} download>
            <Download aria-hidden="true" className="h-4 w-4" />
            {t('demo.export')}
          </a>
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start justify-between gap-3 rounded border border-anomaly/50 bg-anomaly/10 px-3 py-2 text-sm text-red-200">
          {error}
          <button type="button" className="underline" onClick={clearError}>
            {t('common.dismiss')}
          </button>
        </p>
      )}
      <RunProgress state={state} liveRun={liveRun} />
    </section>
  );
}
