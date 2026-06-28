import React from "react";
import { ArrowLeft } from "lucide-react";
import { useEsperandoAprobacion } from "../hooks/useEsperandoAprobacion.js";
import { formatMoney, formatMoneyParts } from "../utils/format.js";

export default function EsperandoAprobacionView({ ordenId, setView }) {
  const {
    orden,
    cliente,
    moto,
    horas,
    minutos,
    segundos,
    totalTareas,
    totalRepuestos,
    totalInsumos,
    totalFletes,
    totalPresupuesto,
    aprobar,
  } = useEsperandoAprobacion(ordenId);

  const handleAprobar = () => {
    const { ok } = aprobar();
    if (ok) setView("ejecucion");
  };

  const handleModificar = () => setView("gestionarTareas");

  if (!orden) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-zinc-500 text-xs font-black uppercase">
        Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("detalleOrden")}
            className="p-3 rounded-2xl bg-zinc-900 border border-white/5 active:scale-95"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {moto?.patente} · {cliente?.nombre}
            </p>
            <h1 className="text-xl font-black text-white">Esperando Aprobación</h1>
          </div>
        </div>

        <div className="rounded-[2rem] border border-yellow-500/20 bg-yellow-500/10 p-6 text-center space-y-3">
          <div className="text-4xl">⏳</div>
          <p className="text-[10px] font-black uppercase tracking-widest text-yellow-400">
            Presupuesto enviado a cliente
          </p>
          <p className="font-mono text-5xl font-black text-yellow-400">
            {String(horas).padStart(2, "0")}:{String(minutos).padStart(2, "0")}:{String(segundos).padStart(2, "0")}
          </p>
          <p className="text-[10px] font-bold text-zinc-500">Esperando respuesta...</p>
        </div>

        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Presupuesto enviado</p>
          <div className="flex justify-between items-center">
            <span className="text-sm text-zinc-400">Mano de obra</span>
            <span className="font-black text-white">{formatMoney(totalTareas)}</span>
          </div>
          {totalRepuestos > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Repuestos</span>
              <span className="font-black text-white">{formatMoney(totalRepuestos)}</span>
            </div>
          )}
          {(totalInsumos + totalFletes) > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-zinc-400">Insumos / Fletes</span>
              <span className="font-black text-white">{formatMoney(totalInsumos + totalFletes)}</span>
            </div>
          )}
          <div className="border-t border-zinc-700 pt-3 flex justify-between items-center">
            <span className="text-sm font-black text-white">Total</span>
            {(() => { const { pesos, centavos } = formatMoneyParts(totalPresupuesto); return (
              <p className="leading-none text-right">
                <span className="text-[10px] font-bold text-orange-400/50">ARS </span>
                <span className="text-xl font-black text-orange-400">{pesos}</span>
                <span className="text-sm font-black text-orange-400/60">,{centavos}</span>
              </p>
            ); })()}
          </div>
        </div>

        <button
          onClick={handleAprobar}
          className="w-full rounded-[2rem] bg-emerald-600 py-5 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
        >
          ✓ Cliente Aprobó — Comenzar Ejecución
        </button>

        <button
          onClick={handleModificar}
          className="w-full rounded-[2rem] border border-zinc-700 bg-zinc-900 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-300 active:scale-95 transition-all"
        >
          Modificar presupuesto
        </button>
      </div>
    </div>
  );
}
