import React from "react";
import { ArrowLeft } from "lucide-react";
import { ESTADO_LABEL, ESTADO_CSS } from "../lib/constants.js";
import { formatMoney } from "../utils/format.js";

export default function OrderListView({ orders, bikes, clients, setSelectedOrderId, setView }) {
  const activas = orders.filter((o) => o.estado !== "entregada");
  return (
    <div className="p-4 space-y-4 pb-28 text-left animate-in fade-in duration-500">
      <div className="bg-black/80 backdrop-blur-xl p-5 border-b border-white/10 flex items-center gap-4 sticky top-0 z-40 mb-4 rounded-3xl">
        <button onClick={() => setView("home")} className="p-3 bg-white/5 rounded-2xl border border-white/5 text-white active:scale-90">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-black uppercase tracking-widest text-white">Trabajos Activos</h2>
      </div>
      <div className="space-y-3">
        {activas.length === 0 ? (
          <p className="text-center py-20 text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">No hay órdenes activas</p>
        ) : (
          activas.map((o) => {
            const b = bikes.find((x) => x.id === o.bikeId);
            const c = clients.find((x) => x.id === o.clientId);
            return (
              <div key={o.id} onClick={() => { setSelectedOrderId(o.id); setView("detalleOrden"); }} className="bg-white p-6 rounded-[2.5rem] flex justify-between items-center shadow-md active:scale-95 transition-all cursor-pointer border border-slate-100">
                <div className="text-left font-bold">
                  <p className="text-2xl font-black text-black leading-none mb-1">{b?.patente || "---"}</p>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c?.nombre || "S/D"}</p>
                  <span className={`inline-block mt-2 text-[8px] font-black px-2 py-0.5 rounded uppercase ${ESTADO_CSS[o.estado]}`}>{ESTADO_LABEL[o.estado]}</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-black tracking-tighter">{formatMoney(o.total)}</p>
                  <p className="text-[10px] text-slate-400 font-black uppercase mt-1">{o.fechaIngreso}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
