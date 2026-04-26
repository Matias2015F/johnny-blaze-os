import React, { useState, useMemo } from "react";
import { ArrowLeft, Search, ChevronRight } from "lucide-react";

export default function HistoryView({ orders, bikes, clients, setView, setSelectedBikeId }) {
  const [search, setSearch] = useState("");

  const results = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return [];
    const unique = new Map();
    orders.forEach((o) => {
      const b = bikes.find((bx) => bx.id === o.bikeId);
      const c = clients.find((cx) => cx.id === o.clientId);
      if (b?.patente?.toLowerCase().includes(q) || c?.nombre?.toLowerCase().includes(q)) {
        if (b && !unique.has(b.id)) unique.set(b.id, { bike: b, client: c });
      }
    });
    return Array.from(unique.values());
  }, [search, orders, bikes, clients]);

  return (
    <div className="p-4 space-y-4 pb-28 text-left animate-in slide-in-from-right duration-300">
      <div className="bg-black/80 backdrop-blur-xl p-5 border-b border-white/10 flex items-center gap-4 sticky top-0 z-40 mb-4 rounded-3xl">
        <button onClick={() => setView("home")} className="p-3 bg-white/5 rounded-2xl border border-white/5 text-white active:scale-90">
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-black uppercase tracking-widest text-white">HISTORIAL</h2>
      </div>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          placeholder="Buscar patente o cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white border-2 border-slate-200 p-5 pl-12 rounded-3xl font-black text-black outline-none focus:border-blue-500"
        />
      </div>
      <div className="space-y-4 mt-6">
        {results.length > 0 ? (
          results.map((res) => (
            <div
              key={res.bike.id}
              onClick={() => { setSelectedBikeId(res.bike.id); setView("perfilMoto"); }}
              className="bg-white p-6 rounded-[2.5rem] shadow-md border border-slate-100 flex justify-between items-center active:scale-95 transition-all cursor-pointer"
            >
              <div className="text-left font-bold">
                <p className="text-3xl font-black text-black leading-none">{res.bike.patente}</p>
                <p className="text-[10px] font-black text-slate-400 uppercase mt-1 tracking-widest">
                  {res.client?.nombre} — {res.bike.marca}
                </p>
              </div>
              <ChevronRight size={24} className="text-slate-300" />
            </div>
          ))
        ) : (
          <p className="text-center py-20 text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">
            Escribí para buscar una moto...
          </p>
        )}
      </div>
    </div>
  );
}
