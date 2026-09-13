import { Component, type ErrorInfo, type ReactNode } from "react";

export default class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Yuniko UI crash", error, info.componentStack);
  }

  private reload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen bg-background text-white flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center rounded-3xl border border-white/10 bg-white/5 p-6">
          <h1 className="text-xl font-bold">Yuniko needs to reload</h1>
          <p className="mt-2 text-sm text-white/60">Something went wrong in the app. Your account session is kept.</p>
          <button onClick={this.reload} className="mt-5 rounded-2xl px-5 py-3 font-semibold bg-white/10">Reload Yuniko</button>
        </div>
      </div>
    );
  }
}
