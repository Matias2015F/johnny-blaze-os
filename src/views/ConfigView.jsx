import React, { useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { LS, useCollection } from "../lib/storage.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { formatMoney } from "../utils/format.js";

export default function ConfigView({ setView, showToast }) {
  const [cfg, setCfg] = useState(() => LS.getDoc("config", "global") || CONFIG_DEFAULT);
  const caja = useCollection("caja");
  const balance = useMemo(
    () => caja.reduce((acc, mov) => (mov.tipo === "ingreso" ? acc + mov.monto : acc - mov.monto), 0),
    [caja]
  );

  const guardar = () => {
    LS.setDoc("config", "global", cfg);
    showToast("Guardado ✓");
    setView("home");
  };

  return (
    <div className="p-6 text-left animate-in slide-in-from-right duration-300 pb-28">
      <button onClick={() => setView("home")} className="mb-8 text-orange-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver
      </button>
      <h1 className="text-4xl font-black text-white tracking-tighter mb-8 uppercase">AJUSTES</h1>

      <div className="bg-white p-8 rounded-[2.5rem] mb-6 shadow-2xl">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Caja Actual</p>
        <p className={`text-5xl font-black tracking-tighter ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatMoney(balance)}
        </p>
      </div>

      <div className="space-y-4 bg-white p-8 rounded-[2.5rem] shadow-xl">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nombre Taller</label>
          <input value={cfg.nombreTaller} onChange={(e) => setCfg({ ...cfg, nombreTaller: e.target.value })} className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-orange-500" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Responsable</label>
          <input value={cfg.mecanicoResponsable} onChange={(e) => setCfg({ ...cfg, mecanicoResponsable: e.target.value })} className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-orange-500" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">DNI</label>
          <input value={cfg.dniMecanico} onChange={(e) => setCfg({ ...cfg, dniMecanico: e.target.value })} className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-orange-500" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Teléfono</label>
          <input value={cfg.telefonoTaller} onChange={(e) => setCfg({ ...cfg, telefonoTaller: e.target.value })} className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-orange-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Hora Costo</label>
            <input type="number" value={cfg.valorHoraInterno} onChange={(e) => setCfg({ ...cfg, valorHoraInterno: Number(e.target.value) })} className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-orange-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Hora Cliente</label>
            <input type="number" value={cfg.valorHoraCliente} onChange={(e) => setCfg({ ...cfg, valorHoraCliente: Number(e.target.value) })} className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-orange-500" />
          </div>
        </div>
        <button onClick={guardar} className="w-full bg-orange-600 text-white py-5 rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all mt-4">
          Guardar Cambios
        </button>
      </div>
    </div>
  );
}
