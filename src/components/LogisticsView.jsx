import React, { useState } from "react";
import { ArrowLeft, Truck } from "lucide-react";
import { LS } from "../lib/storage.js";
import { hoyEstable } from "../lib/constants.js";
import { parseMonto } from "../utils/format.js";

export default function LogisticsView({ order, setView, showToast }) {
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("Retiro/Entrega");

  const cargar = () => {
    const m = parseMonto(monto);
    if (!m) return;
    const nuevos = [...(order.fletes || []), { nombre: motivo, monto: m, fecha: hoyEstable() }];
    const nTotal = (order.total || 0) + m;
    LS.updateDoc("ordenes", order.id, { fletes: nuevos, total: nTotal });
    LS.addDoc("caja", { fecha: hoyEstable(), tipo: "egreso", concepto: `VIAJE: ${motivo}`, monto: m });
    showToast("Viaje cargado ✓");
    setView("detalleOrden");
  };

  return (
    <div className="p-6 text-left animate-in slide-in-from-bottom duration-300">
      <button onClick={() => setView("detalleOrden")} className="mb-8 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver
      </button>
      <div className="bg-white p-8 rounded-[2.5rem] space-y-5 shadow-2xl text-left">
        <h2 className="text-2xl font-black text-slate-900 tracking-tighter mb-2 uppercase flex items-center gap-2">
          <Truck size={24} /> Gestión Logística
        </h2>
        <div className="space-y-4 pt-4">
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-400 ml-2 font-black">Motivo</label>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full border-2 border-slate-200 rounded-2xl p-4 font-black outline-none focus:border-blue-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-400 ml-2 font-black">Costo ($)</label>
            <input type="text" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0" className="w-full border-2 border-slate-200 rounded-2xl p-4 font-black outline-none focus:border-blue-500" />
          </div>
          <button onClick={cargar} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all">
            Cargar Viaje
          </button>
        </div>
      </div>
    </div>
  );
}
