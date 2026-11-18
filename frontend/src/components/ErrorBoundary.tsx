import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/**
 * Last line of defence: a render error (for example data from a backend of a
 * different version) shows a recovery message instead of a blank page. The
 * text is English on purpose: the language layer itself may be what failed.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Interface error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" lang="en" className="mx-auto mt-16 max-w-lg p-6 text-center">
        <h1 className="text-lg font-semibold text-slate-50">The interface could not be displayed</h1>
        <p className="mt-2 text-sm text-slate-400">
          The data received from the engine does not match what this version of the interface
          expects. Reload the page; if it happens again, the interface and the engine are
          probably different versions.
        </p>
        <button type="button" className="btn mt-4" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
