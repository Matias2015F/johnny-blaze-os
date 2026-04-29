import React, { useState } from "react";
import { ArrowLeft, PlusCircle, ChevronDown } from "lucide-react";
import { formatMoney } from "../utils/format.js";
import { calcularResultadosOrden } from "../lib/calc.js";

export default function BikeProfileView({ bikeId, orders, bikes, clients, setView, handleStartNewService }) {
  const b = bikes.find((x) => x.id === bikeId);
  const c = clients.find((x) => x.id === b?.clienteId);
  const history = orders
    .filter((o) => o.bikeId === bikeId)
    .sort((a, z) => z.fechaIngreso.localeCompare(a.fechaIngreso));
  const [expandedId, setExpandedId] = useState(null);

  if (!b) return null;

  return (
    <div className="min-h-screen bg-slate-100 text-left animate-in slide-in-from-right duration-300 pb-32">
      <div className="bg-slate-900 p-8 text-white">
        <button onClick={() => setView("historial")} className="mb-6 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
          <ArrowLeft size={16} /> Historial
        </button>
        <div className="flex justify-between items-start">
          <div className="text-left">
            <h2 className="text-5xl font-black tracking-tighter leading-none mb-2">{b.patente}</h2>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em]">{b.marca} {b.modelo}</p>
            <div className="flex gap-4 mt-4">
              <div className="bg-white/10 px-4 py-2 rounded-2xl">
                <p className="text-[8px] font-black uppercase text-slate-400">Cliente</p>
                <p className="text-xs font-black">{c?.nombre || "---"}</p>
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-2xl">
                <p className="text-[8px] font-black uppercase text-slate-400">Km Actual</p>
                <p className="text-xs font-black">{b.km} KM</p>
              </div>
            </div>
          </div>
          <button onClick={() => handleStartNewService(b, c)} className="bg-blue-600 text-white p-4 rounded-3xl shadow-xl active:scale-95 transition-all">
            <PlusCircle size={32} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest px-2">Historial de Servicios</h3>
        {history.length === 0 && (
          <p className="text-center py-10 text-slate-400 font-bold uppercase text-[10px]">Sin servicios registrados</p>
        )}
        {history.map((order) => {
          const isExpanded = expandedId === order.id;
          const totalOrden = calcularResultadosOrden(order).total;
          return (
            <div key={order.id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
              <div onClick={() => setExpandedId(isExpanded ? null : order.id)} className="p-6 flex justify-between items-center cursor-pointer active:bg-slate-50">
                <div className="text-left">
                  <p className="text-xs font-black text-slate-400 uppercase mb-1 tracking-widest">{order.fechaIngreso}</p>
                  <p className="text-xl font-black text-black leading-none">{formatMoney(totalOrden)}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Kilometraje: {order.km} km</p>
                </div>
                <div className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                  <ChevronDown size={24} className="text-slate-300" />
                </div>
              </div>
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-50 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Trabajos realizados y repuestos</p>
                    <div className="space-y-1">
                      {order.tareas?.map((t, i) => (
                        <div key={i} className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {t.nombre}
                        </div>
                      ))}
                      {order.repuestos?.map((r, i) => (
                        <div key={i} className="text-xs font-bold text-blue-700 uppercase flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {r.nombre} ({r.cantidad || 1}x)
                        </div>
                      ))}
                    </div>
                  </div>
                  {order.diagnostico && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Diagnóstico</p>
                      <p className="text-xs font-bold italic text-slate-600">"{order.diagnostico}"</p>
                    </div>
                  )}
                  {order.observacionesProxima && (
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-[8px] font-black uppercase text-blue-400 mb-1">Notas para la próxima visita</p>
                      <p className="text-xs font-bold italic text-blue-900">"{order.observacionesProxima}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
