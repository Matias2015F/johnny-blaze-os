import React, { useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { LS, useCollection } from "../lib/storage.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { formatMoney } from "../utils/format.js";

const DIFICULTADES = [
  { key: "facil",      label: "Fácil" },
  { key: "normal",     label: "Normal" },
  { key: "dificil",    label: "Difícil" },
  { key: "complicado", label: "Complicado" },
];

export default function ConfigView({ setView, showToast }) {
  const [cfg, setCfg] = useState(() => LS.getDoc("config", "global") || CONFIG_DEFAULT);
  const caja = useCollection("caja");
  const balance = useMemo(
    () => caja.reduce((acc, mov) => (mov.tipo === "ingreso" ? acc + mov.monto : acc - mov.monto), 0),
    [caja]
  );

  const margen = cfg.margenPolitica ?? 25;
  const horaCliente = Math.round(cfg.valorHoraInterno * (1 + margen / 100));

  const guardar = () => {
    LS.setDoc("config", "global", { ...cfg, margenPolitica: margen, valorHoraCliente: horaCliente });
    showToast("Guardado ✓");
    setView("home");
  };

  const setFactor = (key, val) => {
    const f = parseFloat(val);
    if (isNaN(f) || f <= 0) return;
    setCfg({ ...cfg, factorDificultad: { ...(cfg.factorDificultad || CONFIG_DEFAULT.factorDificultad), [key]: f } });
  };

  return (
    <div className="p-6 text-left animate-in slide-in-from-right duration-300 pb-28">
      <button onClick={() => setView("home")} className="mb-8 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver
      </button>
      <h1 className="text-4xl font-black text-white tracking-tighter mb-8 uppercase">AJUSTES</h1>

      {/* CAJA */}
      <div className="bg-white p-8 rounded-[2.5rem] mb-6 shadow-2xl">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Caja Actual</p>
        <p className={`text-5xl font-black tracking-tighter ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatMoney(balance)}
        </p>
      </div>

      {/* DATOS TALLER */}
      <div className="space-y-4 bg-white p-8 rounded-[2.5rem] shadow-xl mb-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Datos del Taller</p>
        {[
          ["nombreTaller",        "Nombre Taller"],
          ["mecanicoResponsable", "Responsable"],
          ["dniMecanico",         "DNI"],
          ["telefonoTaller",      "Teléfono"],
        ].map(([field, label]) => (
          <div key={field} className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">{label}</label>
            <input
              value={cfg[field] ?? ""}
              onChange={(e) => setCfg({ ...cfg, [field]: e.target.value })}
              className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-blue-500"
            />
          </div>
        ))}
      </div>

      {/* POLÍTICA DE PRECIOS */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-4 space-y-5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Política de Precios</p>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Costo real por hora</label>
          <input
            type="number"
            value={cfg.valorHoraInterno}
            onChange={(e) => setCfg({ ...cfg, valorHoraInterno: Number(e.target.value) })}
            className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-blue-500"
          />
          <p className="text-[10px] text-slate-400 ml-2">Gastos fijos del taller ÷ horas trabajadas al mes</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Margen de política</label>
            <span className="text-lg font-black text-blue-600">{margen}%</span>
          </div>
          <input
            type="range"
            min="5"
            max="120"
            step="5"
            value={margen}
            onChange={(e) => setCfg({ ...cfg, margenPolitica: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[9px] text-slate-400 font-bold px-1">
            <span>5%</span><span>60%</span><span>120%</span>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[1.5rem] p-5 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio hora al cliente</p>
            <p className="text-[10px] text-slate-500">
              {formatMoney(cfg.valorHoraInterno)} × {(1 + margen / 100).toFixed(2)}
            </p>
          </div>
          <p className="text-3xl font-black text-blue-400">{formatMoney(horaCliente)}</p>
        </div>

        <p className="text-[10px] text-slate-400 ml-1">
          Modificar el costo o el margen recalibra todos los servicios automáticamente.
        </p>
      </div>

      {/* FACTORES DE DIFICULTAD */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-4 space-y-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Multiplicadores por Dificultad</p>
        <div className="grid grid-cols-2 gap-3">
          {DIFICULTADES.map(({ key, label }) => {
            const factor = cfg.factorDificultad?.[key] ?? CONFIG_DEFAULT.factorDificultad[key];
            return (
              <div key={key} className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{label}</label>
                <div className="flex items-center gap-2 border-2 border-slate-100 rounded-xl p-3">
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="5"
                    value={factor}
                    onChange={(e) => setFactor(key, e.target.value)}
                    className="w-full font-black text-center outline-none bg-transparent"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">×</span>
                </div>
                <p className="text-[9px] text-slate-400 ml-1 text-center">
                  = {formatMoney(Math.round(horaCliente * factor))}/h
                </p>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 ml-1">
          Cada factor multiplica el precio hora según la complejidad del trabajo.
        </p>
      </div>

      <button onClick={guardar} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all mt-2">
        Guardar Cambios
      </button>
    </div>
  );
}
