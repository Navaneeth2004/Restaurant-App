import { Component, ErrorInfo, ReactNode } from 'react';

interface State { failed: boolean }

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('Unhandled UI error', error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-white font-bold">Something went wrong</p>
        <p className="text-zinc-500 text-sm">Reload the page to continue. Your orders are safe on the server.</p>
        <button type="button" className="btn btn-brand" onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }
}
