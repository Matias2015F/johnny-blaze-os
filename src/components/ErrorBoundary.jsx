import React from "react";

export default class ErrorBoundary extends React.Component {
  state = { error: null, showDetails: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error?.message || error, info?.componentStack?.slice(0, 300));
    try {
      const payload = {
        message: String(error?.message || ""),
        name: String(error?.name || "Error"),
        stack: String(error?.stack || ""),
        componentStack: String(info?.componentStack || ""),
        at: Date.now(),
      };
      localStorage.setItem("jbos:lastError", JSON.stringify(payload).slice(0, 2000));
    } catch {
      // ignore
    }
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      if (fallback) return fallback(this.state.error, () => this.setState({ error: null, showDetails: false }));

      return (
        <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-8 text-center gap-6">
          <div className="text-5xl select-none" aria-hidden="true">!</div>
          <div>
            <p className="text-white font-black text-base uppercase tracking-tight">Algo salio mal en esta pantalla</p>
            <p className="text-zinc-500 text-sm mt-2">
              La app encontro un error inesperado.<br />Tus datos estan guardados.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => this.setState({ error: null, showDetails: false })}
              className="w-full rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-transform"
            >
              Reintentar
            </button>
            <button
              onClick={async () => {
                try {
                  // Fuerza actualizacion real (PWA): desregistrar SW + limpiar caches.
                  if ("serviceWorker" in navigator) {
                    const regs = await navigator.serviceWorker.getRegistrations();
                    await Promise.all(regs.map((r) => r.unregister().catch(() => null)));
                  }
                  if ("caches" in window) {
                    const keys = await caches.keys();
                    await Promise.all(keys.map((k) => caches.delete(k).catch(() => null)));
                  }
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
              className="w-full rounded-2xl bg-zinc-900 border border-zinc-700 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-400 active:scale-95 transition-transform"
            >
              Recargar app
            </button>
            <button
              type="button"
              onClick={() => this.setState((s) => ({ ...s, showDetails: !s.showDetails }))}
              className="w-full rounded-2xl bg-zinc-800/60 border border-zinc-700 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 active:scale-95 transition-transform"
            >
              {this.state.showDetails ? "Ocultar detalle" : "Ver detalle"}
            </button>
          </div>
          {this.state.showDetails && (
            <div className="w-full max-w-xs rounded-2xl border border-zinc-800 bg-black/30 p-4 text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Detalle tecnico</p>
              <p className="text-[10px] font-mono text-zinc-200 break-all">
                {this.state.error?.name}: {this.state.error?.message}
              </p>
              {import.meta.env.DEV && this.state.error?.stack && (
                <pre className="mt-2 text-[9px] font-mono text-zinc-500 whitespace-pre-wrap break-words max-h-40 overflow-auto">
                  {this.state.error.stack}
                </pre>
              )}
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = `${this.state.error?.name || "Error"}: ${this.state.error?.message || ""}`;
                    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
                  } catch {
                    // ignore
                  }
                }}
                className="mt-3 w-full rounded-2xl bg-zinc-900 border border-zinc-700 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 active:scale-95 transition-transform"
              >
                Copiar error
              </button>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

