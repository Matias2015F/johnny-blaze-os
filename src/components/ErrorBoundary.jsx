import React from "react";

export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error.message, info?.componentStack?.slice(0, 300));
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      if (fallback) return fallback(this.state.error, () => this.setState({ error: null }));

      return (
        <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-8 text-center gap-6">
          <div className="text-5xl select-none">⚠️</div>
          <div>
            <p className="text-white font-black text-base uppercase tracking-tight">Algo salió mal</p>
            <p className="text-zinc-500 text-sm mt-2">
              La app encontró un error inesperado.<br />Tus datos están guardados.
            </p>
          </div>
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <button
              onClick={() => this.setState({ error: null })}
              className="w-full rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-transform"
            >
              Reintentar
            </button>
            <button
              onClick={async () => {
                try {
                  // Fuerza actualización real (PWA): desregistrar SW + limpiar caches.
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
          </div>
          {import.meta.env.DEV && (
            <p className="text-zinc-700 text-[9px] font-mono max-w-xs break-all">
              {this.state.error?.message}
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
