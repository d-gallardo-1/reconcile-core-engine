import { Languages, LayoutDashboard, Workflow } from 'lucide-react';
import { useCallback, useId, useState } from 'react';
import { useI18n } from '../i18n/I18nProvider';
import { LOCALES } from '../i18n/locales';
import type { BatchState, LiveRun, StreamStatus } from '../types/reconciliation';
import { AnomalyResolutionPanel } from './AnomalyResolutionPanel';
import { RulePipelineInspector } from './RulePipelineInspector';
import { ThreeWayMatchTable } from './ThreeWayMatchTable';
import { ToleranceAndDemoBar } from './ToleranceAndDemoBar';
import { TopAuditMetrics } from './TopAuditMetrics';

const VIEWS = [
  { id: 'cockpit', label: 'nav.cockpit', icon: LayoutDashboard },
  { id: 'rules', label: 'nav.rules', icon: Workflow },
] as const;
type View = (typeof VIEWS)[number]['id'];

interface Props {
  state: BatchState | null;
  status: StreamStatus;
  liveRun: LiveRun | null;
}

/** Page layout: header with the language selector, view tabs, active view, drawer. */
export function AppShell({ state, status, liveRun }: Props) {
  const { t, locale, setLocale } = useI18n();
  const languageId = useId();
  const [view, setView] = useState<View>('cockpit');
  const [openTxId, setOpenTxId] = useState<string | null>(null);
  const closeDrawer = useCallback(() => setOpenTxId(null), []);

  // Looked up on every render so the drawer follows live updates from other tabs.
  const openRecord = state?.records.find((record) => record.tx_id === openTxId) ?? null;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col gap-4 p-4 lg:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-50">Reconcile Core Engine</h1>
          <p className="text-sm text-slate-400">
            {state ? `${state.entity} · ${t('app.batch')} ` : t('app.subtitle')}
            {state && <span className="num">{state.batch_id}</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <p className="rounded border border-audited/40 bg-audited/10 px-3 py-1.5 text-xs font-medium text-amber-200">
            {t('app.demoBadge')}
          </p>
          <label htmlFor={languageId} className="flex items-center gap-2 text-sm text-slate-300">
            <Languages aria-hidden="true" className="h-4 w-4 text-slate-500" />
            <span className="sr-only">{t('app.language')}</span>
            <select
              id={languageId}
              className="field"
              value={locale.code}
              onChange={(event) => setLocale(event.target.value)}
            >
              {LOCALES.map((option) => (
                <option key={option.code} value={option.code} lang={option.intl}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <nav aria-label={t('nav.aria')} className="flex flex-wrap gap-2">
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-current={view === id ? 'page' : undefined}
            onClick={() => setView(id)}
            className={`inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
              view === id
                ? 'border-tolerance/60 bg-tolerance/15 text-cyan-100'
                : 'border-edge text-slate-400 hover:border-slate-500 hover:text-slate-200'
            }`}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {t(label)}
          </button>
        ))}
      </nav>

      {!state ? (
        <p role="status" className="panel p-8 text-center text-slate-400">
          {status === 'DISCONNECTED' ? t('app.unreachable') : t('app.connecting')}
        </p>
      ) : (
        <main className="flex flex-col gap-4">
          <TopAuditMetrics state={state} stream={status} />
          {view === 'cockpit' ? (
            <>
              <ToleranceAndDemoBar state={state} liveRun={liveRun} />
              <ThreeWayMatchTable state={state} liveRun={liveRun} onOpen={setOpenTxId} />
            </>
          ) : (
            <RulePipelineInspector state={state} />
          )}
        </main>
      )}

      {openRecord && <AnomalyResolutionPanel record={openRecord} onClose={closeDrawer} />}
    </div>
  );
}
