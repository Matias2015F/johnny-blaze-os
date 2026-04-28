import React from "react";
import { PlusCircle, Clock, History, LogOut } from "lucide-react";
import { auth } from "../firebase.js";
import { LS } from "../lib/storage.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { evaluarEstado } from "../lib/calc.js";
import { obtenerTiempoActual } from "../lib/timer.js";
import { formatMoney } from "../utils/format.js";

const ESTADO_BADGE = {
  NORMAL:   "bg-green-500/20 text-green-400 border-green-500/30",
  ALERTA:   "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  BLOQUEADO:"bg-red-500/20 text-red-400 border-red-500/30",
};
const ESTADO_LABEL_CRON = { NORMAL: "Normal", ALERTA: "Alerta", BLOQUEADO: "Detenido" };
const ORDEN_ESTADO = { BLOQUEADO: 0, ALERTA: 1, NORMAL: 2 };

export default function HomeView({ stats, setView, bikes, orders, setSelectedOrderId, handleLogout }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const user = auth.currentUser;
  const userLabel = user?.email || user?.phoneNumber || "";
  const valorHora = config.valorHoraCliente || 15000;

  const ordenesActivas = (orders || [])
    .filter(o => o.estado !== "entregada")
    .map(o => {
      const tiempoHoras = obtenerTiempoActual(o);
      const { estadoCron, costoActual } = evaluarEstado({
        tiempoHoras,
        valorHora,
        maxAutorizado: o.maxAutorizado || 0,
      });
      return { ...o, estadoCron, costoActual };
    })
    .sort((a, b) => ORDEN_ESTADO[a.estadoCron] - ORDEN_ESTADO[b.estadoCron]);

  const alerta   = ordenesActivas.filter(o => o.estadoCron === "ALERTA").length;
  const bloqueado= ordenesActivas.filter(o => o.estadoCron === "BLOQUEADO").length;

  return (
    <div className="p-4 space-y-5 pb-28 text-left animate-in fade-in duration-500">

      {/* HEADER */}
      <header className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="relative z-10 text-left font-bold">
          <p className="text-blue-500 font-black text-xs uppercase tracking-[0.4em] mb-1">Taller OS</p>
          <h1 className="text-4xl font-black text-white tracking-tighter leading-none mb-1">JOHNNY BLAZE</h1>
          <div className="flex items-center justify-between mb-5">
            <p className="text-[10px] text-slate-400 font-normal truncate max-w-[75%]">{userLabel}</p>
            <button onClick={handleLogout} className="flex items-center gap-1 text-slate-500 hover:text-red-400 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest">
              <LogOut size={13} /> Salir
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Órdenes activas", ordenesActivas.length, "text-blue-400"],
              ["En alerta",       alerta,                "text-yellow-400"],
              ["Detenidos",       bloqueado,             "text-red-400"],
            ].map(([l, v, c]) => (
              <div key={l} className="bg-black/40 border border-white/5 p-3 rounded-2xl text-center">
                <div className={`text-2xl font-black ${c}`}>{v}</div>
                <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-0.5 leading-tight">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* NUEVO INGRESO */}
      <button onClick={() => setView("nuevaOrden")} className="w-full bg-blue-600 text-white p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl active:scale-[0.98] transition-all">
        <div className="flex items-center gap-5 text-left font-bold">
          <div className="bg-white/20 p-4 rounded-3xl"><PlusCircle size={32} /></div>
          <div>
            <p className="text-2xl font-black uppercase tracking-tighter leading-none mb-1">Nuevo Ingreso</p>
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Ingresar moto al taller</p>
          </div>
        </div>
      </button>

      {/* ÓRDENES ACTIVAS CON ESTADO */}
      {ordenesActivas.length > 0 && (
        <div className="bg-slate-900 rounded-[2rem] p-5 space-y-3 border border-slate-800">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Órdenes en curso</p>
          {ordenesActivas.map(o => {
            const bike = bikes?.find(b => b.id === o.bikeId) || {};
            return (
              <button
                key={o.id}
                onClick={() => { setSelectedOrderId(o.id); setView("detalleOrden"); }}
                className="w-full bg-slate-800 hover:bg-slate-700 rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-all border border-slate-700"
              >
                <div className="text-left">
                  <p className="text-sm font-black text-white uppercase tracking-tight">
                    {bike.patente || "---"} · {bike.marca || ""} {bike.modelo || ""}
                  </p>
                  <span className={`inline-block mt-1 text-[9px] font-black px-2 py-0.5 rounded-lg border uppercase tracking-widest ${ESTADO_BADGE[o.estadoCron]}`}>
                    {ESTADO_LABEL_CRON[o.estadoCron]}
                  </span>
                </div>
                {o.maxAutorizado > 0 && (
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase">Acumulado</p>
                    <p className="text-sm font-black text-white">{formatMoney(o.costoActual)}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* NAVEGACIÓN */}
      <div className="grid grid-cols-2 gap-4 font-bold">
        <button onClick={() => setView("ordenes")} className="bg-[#141414] border border-white/5 p-6 rounded-3xl flex flex-col gap-3 active:scale-95 transition-all text-left">
          <Clock className="text-blue-500" size={24} />
          <span className="font-black uppercase text-xs tracking-widest text-white">Trabajos</span>
        </button>
        <button onClick={() => setView("historial")} className="bg-[#141414] border border-white/5 p-6 rounded-3xl flex flex-col gap-3 active:scale-95 transition-all text-left">
          <History className="text-blue-500" size={24} />
          <span className="font-black uppercase text-xs tracking-widest text-white">Historial</span>
        </button>
      </div>


    </div>
  );
}
