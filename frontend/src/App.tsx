import { LayoutDashboard, Workflow } from 'lucide-react';
import { useCallback, useState } from 'react';
import { AnomalyResolutionPanel } from './components/AnomalyResolutionPanel';
import { RulePipelineInspector } from './components/RulePipelineInspector';
import { ThreeWayMatchTable } from './components/ThreeWayMatchTable';
import { ToleranceAndDemoBar } from './components/ToleranceAndDemoBar';
import { TopAuditMetrics } from './components/TopAuditMetrics';
import { useReconciliationStream } from './hooks/useReconciliationStream';

type View = 'cockpit' | 'rules';

const VIEWS = [
  { id: 'cockpit', label: 'Live Reconciliation Cockpit', icon: LayoutDashboard },
  { id: 'rules', label: 'Rule Engine & Schema Inspector', icon: Workflow },
] as const;

/** Orchestrator: owns the stream, the active view and the open drawer. */
export default function App() {
  const { state, status, liveRun } = useReconciliationStream();
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
            {state ? `${state.entity} · batch ` : 'Multi-source ledger, bank and tax reconciliation'}
            {state && <span className="num">{state.batch_id}</span>}
          </p>
        </div>
        <p className="rounded border border-audited/40 bg-audited/10 px-3 py-1.5 text-xs font-medium text-amber-200">
          Reference demo · 100% synthetic data · no real financial records
        </p>
      </header>

      <nav aria-label="Workspace views" className="flex flex-wrap gap-2">
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
            {label}
          </button>
        ))}
      </nav>

      {!state ? (
        <p role="status" className="panel p-8 text-center text-slate-400">
          {status === 'DISCONNECTED'
            ? 'The reconciliation engine is not reachable. Retrying…'
            : 'Connecting to the reconciliation engine…'}
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
