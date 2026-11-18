import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useReconciliationStream } from './hooks/useReconciliationStream';
import { I18nProvider } from './i18n/I18nProvider';

// Shown only until the first snapshot arrives with the real batch currency.
const FALLBACK_CURRENCY = 'GBP';

/** Orchestrator: owns the stream and gives the UI its language and currency. */
export default function App() {
  const { state, status, liveRun } = useReconciliationStream();
  return (
    <ErrorBoundary>
      <I18nProvider currencyCode={state?.currency?.code ?? FALLBACK_CURRENCY}>
        <AppShell state={state} status={status} liveRun={liveRun} />
      </I18nProvider>
    </ErrorBoundary>
  );
}
