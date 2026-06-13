import React from "react";

export default function AppLoadingScreen({ title = "MotoGestión", detail = "Cargando..." }) {
  return (
    <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-zinc-800 bg-[#111111] p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-sm font-black text-white">
          MG
        </div>
        <p className="mt-4 text-sm font-black uppercase tracking-[0.25em] text-orange-400">{title}</p>
        <p className="mt-2 text-sm text-zinc-400">{detail}</p>
        <div className="mt-5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.35em] text-zinc-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
          Sincronizando shell
        </div>
      </div>
    </div>
  );
}
