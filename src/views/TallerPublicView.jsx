import React from "react";
import { useTallerPublicView } from "../hooks/useTallerPublicView.js";

function MgLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-xs font-black text-white">MG</div>
      <span className="text-sm font-black tracking-tight text-zinc-700">Moto Gestión</span>
    </div>
  );
}

function ScoreBar({ label, value }) {
  if (!value) return null;
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[11px] font-bold text-zinc-600 uppercase tracking-wide">{label}</span>
        <span className="text-[11px] font-black text-orange-600">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
        <div className="h-full rounded-full bg-orange-500" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
    </div>
  );
}

const SCORE_LABELS = [
  { key: "scoreAtencion",     label: "Atención" },
  { key: "scoreClaridad",     label: "Claridad del presupuesto" },
  { key: "scoreTrabajo",      label: "Calidad del trabajo" },
  { key: "scoreCumplimiento", label: "Cumplimiento" },
];

export default function TallerPublicView({ uid }) {
  const { estado, taller } = useTallerPublicView(uid);

  return (
    <div className="min-h-screen bg-zinc-50 font-sans">
      <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
        <MgLogo />
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Red MotoGestión</span>
      </nav>

      <div className="mx-auto max-w-md space-y-4 px-4 py-8">
        {estado === "cargando" && (
          <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-8 text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-orange-200 border-t-orange-600" />
            <p className="text-sm font-bold text-zinc-500">Cargando perfil del taller...</p>
          </div>
        )}

        {estado === "no_encontrado" && (
          <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl font-black text-zinc-400">?</div>
            <div>
              <p className="text-lg font-black text-zinc-900">Taller no encontrado</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">Este taller no tiene perfil público en la Red MotoGestión.</p>
            </div>
          </div>
        )}

        {estado === "ok" && taller && (
          <>
            {/* Header del taller */}
            <div className="space-y-4 rounded-3xl border border-orange-200 bg-white p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-600 text-xl font-black text-white">
                  {(taller.nombreTaller || "T").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-orange-600">Taller verificado · MotoGestión</p>
                  <p className="text-xl font-black leading-tight text-zinc-900">{taller.nombreTaller}</p>
                  {(taller.ciudad || taller.provincia) && (
                    <p className="text-sm text-zinc-500 mt-0.5">
                      {[taller.ciudad, taller.provincia].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Sello */}
              <div className="flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-orange-600 text-[9px] font-black text-white">MG</div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-orange-700">Sello MotoGestión Verificado</p>
                  <p className="text-[9px] text-orange-600">Calificaciones asociadas a comprobantes reales</p>
                </div>
              </div>
            </div>

            {/* Reputación */}
            {taller.ratingCount > 0 && (
              <div className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Reputación verificada</p>

                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-2xl font-black text-orange-600 leading-none">{taller.ratingAvg?.toFixed(1) ?? "—"}</p>
                    <p className="text-[9px] text-zinc-500 mt-1">promedio</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-2xl font-black text-zinc-900 leading-none">{taller.ratingCount}</p>
                    <p className="text-[9px] text-zinc-500 mt-1">calificaciones</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-3">
                    <p className="text-2xl font-black text-green-600 leading-none">
                      {taller.recomiendaPct != null ? `${taller.recomiendaPct}%` : "—"}
                    </p>
                    <p className="text-[9px] text-zinc-500 mt-1">recomienda</p>
                  </div>
                </div>

                <div className="space-y-3 border-t border-zinc-100 pt-4">
                  {SCORE_LABELS.map(({ key, label }) =>
                    taller[key] ? <ScoreBar key={key} label={label} value={taller[key]} /> : null
                  )}
                </div>
              </div>
            )}

            {/* Comentarios recientes */}
            {taller.comentariosRecientes?.length > 0 && (
              <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Comentarios recientes</p>
                {taller.comentariosRecientes.map((c, i) => (
                  <p key={i} className="text-sm italic text-zinc-600 border-l-2 border-orange-400 pl-3 leading-relaxed">
                    "{c.texto}"
                  </p>
                ))}
              </div>
            )}

            {/* Trabajos documentados */}
            {taller.trabajosDocumentados > 0 && (
              <div className="rounded-3xl border border-zinc-200 bg-white p-6">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Actividad documentada</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-zinc-50 p-3 text-center">
                    <p className="text-2xl font-black text-zinc-900 leading-none">{taller.trabajosDocumentados}</p>
                    <p className="text-[9px] text-zinc-500 mt-1">trabajos registrados</p>
                  </div>
                  <div className="rounded-2xl bg-zinc-50 p-3 text-center">
                    <p className="text-sm font-black text-orange-600 leading-none mt-1">{taller.nivel || "—"}</p>
                    <p className="text-[9px] text-zinc-500 mt-1">nivel de actividad</p>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 text-center">
              <p className="text-[10px] text-zinc-300">motogestion.ar · Red de talleres verificados</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
