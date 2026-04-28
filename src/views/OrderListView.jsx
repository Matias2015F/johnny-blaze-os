import React from "react";
import { ArrowLeft } from "lucide-react";
import { ESTADO_LABEL, ESTADO_CSS } from "../lib/constants.js";
import { formatMoney } from "../utils/format.js";
import { calcularResultadosOrden } from "../lib/calc.js";

export default function OrderListView({ orders, bikes, clients, setSelectedOrderId, setView }) {
  const activas = orders.filter((o) => o.estado !== "entregada");
  return (
    <div className="p-4 space-y-4 pb-28 text-left animate-in fade-in duration-500">
      <div className="bg-[#141414] p-5 border border-white/5 flex items-center gap-4 sticky top-0 z-40 mb-4 rounded-[2.5rem]">
        <button onClick={() => setView("home")} className="p-3 bg-black/40 rounded-2xl border border-white/5 text-white active:scale-90">
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
            const totalOrden = calcularResultadosOrden(o).total;
            return (
              <div key={o.id} onClick={() => { setSelectedOrderId(o.id); setView("detalleOrden"); }} className="bg-[#141414] p-6 rounded-[2.5rem] flex justify-between items-center active:scale-95 transition-all cursor-pointer border border-white/5">
                <div className="text-left font-bold">
                  <p className="text-2xl font-black text-white leading-none mb-1">{b?.patente || "---"}</p>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{c?.nombre || "S/D"}</p>
                  <span className={`inline-block mt-2 text-[8px] font-black px-2 py-0.5 rounded uppercase ${ESTADO_CSS[o.estado]}`}>{ESTADO_LABEL[o.estado]}</span>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-white tracking-tighter">{formatMoney(totalOrden)}</p>
                  <p className="text-[10px] text-zinc-500 font-black uppercase mt-1">{o.fechaIngreso}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
