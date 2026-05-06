import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Play, Pause, Square } from "lucide-react";
import { LS, obtenerOrden, actualizarOrden } from "../lib/storage.js";
import { formatMoney } from "../utils/format.js";

export default function EjecucionView({ ordenId, setView }) {
  const [orden, setOrden] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [moto, setMoto] = useState(null);
  const [cronometro, setCronometro] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [notas, setNotas] = useState("");
  const [tareas, setTareas] = useState([]);

  useEffect(() => {
    const o = obtenerOrden(ordenId);
    if (!o) return;
    setOrden(o);
    setCliente(LS.getDoc("clientes", o.clientId) || {});
    setMoto(LS.getDoc("motos", o.bikeId) || {});
    setNotas(o.notasEjecucion || "");
    setTareas((o.tareas || []).map((t) => ({ ...t, completada: t.completada || false })));
    setCronometro(o.cronometroEjecucion || 0);
  }, [ordenId]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setCronometro((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const minutos = Math.floor(cronometro / 60);
  const segundos = cronometro % 60;
  const horas = Math.floor(minutos / 60);
  const minutosRest = minutos % 60;

  const totalTareas = useMemo(
    () => tareas.reduce((s, t) => s + (t.monto || 0), 0),
    [tareas]
  );
  const totalRepuestos = useMemo(
    () => (orden?.repuestos || []).reduce((s, r) => s + (r.monto || 0), 0),
    [orden]
  );
  const totalFletes = useMemo(
    () => (orden?.fletes || []).reduce((s, f) => s + (f.monto || 0), 0),
    [orden]
  );
  const totalActual = totalTareas + totalRepuestos + totalFletes;
  const presupuestoBase = orden?.total || 0;
  const supera = presupuestoBase > 0 && totalActual > presupuestoBase;

  const toggleTarea = (idx) => {
    setTareas((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, completada: !t.completada } : t))
    );
  };

  const handleFinalizar = () => {
    actualizarOrden(ordenId, {
      cronometroEjecucion: cronometro,
      notasEjecucion: notas,
      tareas: tareas,
      estado: "finalizada",
      finalizacion_fecha: Date.now(),
    });
    setView("finalizacion");
  };

  const handleGuardar = () => {
    actualizarOrden(ordenId, {
      cronometroEjecucion: cronometro,
      notasEjecucion: notas,
      tareas: tareas,
    });
  };

  if (!orden) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-slate-500 text-xs font-black uppercase">
        Cargando...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("detalleOrden")}
              className="p-3 rounded-2xl bg-slate-900 border border-white/5 active:scale-95"
            >
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                {moto?.patente} · {cliente?.nombre}
              </p>
              <h1 className="text-xl font-black text-white">En Ejecución</h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total</p>
            <p className="text-lg font-black text-blue-400">{formatMoney(orden.total || 0)}</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-blue-500/20 bg-gradient-to-b from-blue-600/10 to-transparent p-6 text-center space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Cronómetro</p>
          <p className="font-mono text-6xl font-black text-blue-400 tracking-tight">
            {String(horas).padStart(2, "0")}:{String(minutosRest).padStart(2, "0")}:{String(segundos).padStart(2, "0")}
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm transition-all active:scale-95 ${
                isRunning
                  ? "bg-yellow-500 text-black"
                  : "bg-blue-600 text-white"
              }`}
            >
              {isRunning ? <Pause size={16} /> : <Play size={16} />}
              {isRunning ? "Pausar" : "Iniciar"}
            </button>
            <button
              onClick={handleGuardar}
              className="px-5 py-3 rounded-2xl bg-slate-800 border border-white/5 text-slate-300 text-sm font-black active:scale-95"
            >
              Guardar
            </button>
          </div>
        </div>

        {supera && (
          <div className="rounded-[1.75rem] border border-red-500/30 bg-red-500/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
              ⚠️ Total actual supera el presupuesto ({formatMoney(presupuestoBase)})
            </p>
          </div>
        )}

        <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Total en vivo</p>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">Mano de obra</span>
            <span className="font-black text-white">{formatMoney(totalTareas)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">Repuestos</span>
            <span className="font-black text-white">{formatMoney(totalRepuestos)}</span>
          </div>
          {totalFletes > 0 && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-400">Fletes</span>
              <span className="font-black text-white">{formatMoney(totalFletes)}</span>
            </div>
          )}
          <div className="border-t border-emerald-500/20 pt-2 flex justify-between">
            <span className="text-sm font-black text-white">Total actual</span>
            <span className="font-black text-emerald-400">{formatMoney(totalActual)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tareas</p>
          {tareas.map((tarea, idx) => (
            <button
              key={idx}
              onClick={() => toggleTarea(idx)}
              className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all active:scale-95 ${
                tarea.completada
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-slate-700 bg-slate-900/50"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  tarea.completada ? "border-emerald-500 bg-emerald-500" : "border-slate-600"
                }`}
              >
                {tarea.completada && <span className="text-[10px] text-white font-black">✓</span>}
              </div>
              <div className="flex-1 text-left">
                <p className={`text-sm font-black ${tarea.completada ? "text-emerald-300 line-through" : "text-white"}`}>
                  {tarea.nombre}
                </p>
              </div>
              <span className="text-sm font-black text-slate-400">{formatMoney(tarea.monto || 0)}</span>
            </button>
          ))}
          {tareas.length === 0 && (
            <p className="text-xs text-slate-500 text-center py-2">Sin tareas cargadas</p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notas del trabajo</p>
          <textarea
            className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-600 resize-none"
            rows={3}
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Qué se hizo, qué se encontró..."
          />
        </div>

        <button
          onClick={handleFinalizar}
          className="w-full rounded-[2rem] bg-emerald-600 py-5 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
        >
          <Square size={14} className="inline mr-2" />
          Trabajo Finalizado
        </button>
      </div>
    </div>
  );
}
