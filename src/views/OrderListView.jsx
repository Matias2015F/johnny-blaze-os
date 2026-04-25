import React from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";

export default function OrderListView({ orders, setView, setSelectedOrder }) {
  const activas = orders.filter(o => o.estado !== "entregada");
  return (
    <div className="p-4 space-y-4 pb-28 text-left animate-in fade-in duration-500">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => setView("home")} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white active:scale-90"><ArrowLeft size={20} /></button>
        <h2 className="text-2xl font-black text-white uppercase italic text-left">Trabajos Activos</h2>
      </div>
      <div className="space-y-3">
        {activas.length === 0 ? (
          <div className="p-20 text-center border border-white/5 rounded-[2.5rem] bg-white/5">
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">No hay motos</p>
          </div>
        ) : (
          activas.map(o => (
            <div key={o.id} onClick={() => { setSelectedOrder(o); setView("detalle"); }} className="bg-white p-6 rounded-[2.5rem] flex justify-between items-center shadow-lg active:scale-95 transition-all border border-white/5 cursor-pointer">
              <div className="text-left font-bold text-black">
                <p className="text-2xl font-black leading-none uppercase tracking-tighter">{o.patente || "S/P"}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{o.modelo}</p>
                <div className="mt-3 px-3 py-1 bg-orange-100 text-orange-600 rounded-full text-[8px] font-black uppercase inline-block">{o.estado}</div>
              </div>
              <ChevronRight className="text-slate-300" size={24} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
