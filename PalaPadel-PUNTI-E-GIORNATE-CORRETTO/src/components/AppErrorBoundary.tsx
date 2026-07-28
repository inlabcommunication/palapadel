import React from "react";

interface State {
  error: Error | null;
}

async function report(error: Error, source: string) {
  try {
    await fetch("/api/analytics/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message || "Errore applicazione",
        source,
        path: window.location.pathname,
        userAgent: navigator.userAgent,
        release: import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA || "local",
      }),
    });
  } catch {
    // Il monitoraggio non deve causare un secondo errore nell'interfaccia.
  }
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    void report(error, "react-boundary");
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-lg p-6">
          <h1 className="text-lg font-bold">Si è verificato un errore</h1>
          <p className="my-3 text-sm text-[rgba(251,243,222,0.58)]">L’errore è stato registrato. Ricarica la pagina per riprovare.</p>
          <button onClick={() => window.location.reload()} className="rounded-lg bg-[#BBFF5E] px-4 py-2 text-sm font-bold text-[#081208]">Ricarica</button>
        </main>
      );
    }
    return this.props.children;
  }
}
