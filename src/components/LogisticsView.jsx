import React, { useState } from "react";
import { ArrowLeft, Truck, Search } from "lucide-react";
import { LS, guardarRepuestoHistorial, buscarRepuestosAutocomplete } from "../lib/storage.js";
import { hoyEstable } from "../lib/constants.js";
import { parseMonto, formatMoney } from "../utils/format.js";
import { calcularNuevoTotal } from "../lib/calc.js";

export default function LogisticsView({ order, setView, showToast }) {
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  const handleMotivo = (valor) => {
    setMotivo(valor);
    if (!valor.trim()) { setSugerencias([]); setMostrarSugerencias(false); return; }
    const r = buscarRepuestosAutocomplete(valor, null, "flete");
    setSugerencias(r);
    setMostrarSugerencias(r.length > 0);
  };

  const seleccionarSugerencia = (item) => {
    setMotivo(item.nombre);
    setMonto(item.precio > 0 ? item.precio.toLocaleString("es-AR") : "");
    setSugerencias([]);
    setMostrarSugerencias(false);
  };

  const cargar = () => {
    const m = parseMonto(monto);
    if (!m) return;
    const concepto = motivo.trim() || "Flete / Cadetería";
    const nuevos = [...(order.fletes || []), { nombre: concepto, monto: m, fecha: hoyEstable() }];
    const nTotal = calcularNuevoTotal(order.tareas || [], order.repuestos || [], nuevos, order.insumos || []);
    LS.updateDoc("trabajos", order.id, { fletes: nuevos, total: nTotal });
    guardarRepuestoHistorial(concepto, m, null, "flete");
    showToast("Flete cargado ✓");
    setView("detalleOrden");
  };

  const totalFletes = (order.fletes || []).reduce((s, f) => s + (f.monto || 0), 0);

  return (
    <div className="p-6 text-left animate-in slide-in-from-bottom duration-300">
      <button onClick={() => setView("detalleOrden")} className="mb-8 text-orange-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver
      </button>
      <div className="bg-white p-8 rounded-[2.5rem] space-y-5 shadow-2xl text-left">
        <h2 className="text-2xl font-black text-zinc-900 tracking-tighter mb-2 uppercase flex items-center gap-2">
          <Truck size={24} /> Agregar flete o cadetería
        </h2>

        {/* Fletes ya cargados */}
        {(order.fletes || []).length > 0 && (
          <div className="bg-zinc-50 rounded-2xl p-4 space-y-2">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-2">Fletes anteriores en este trabajo</p>
            {order.fletes.map((f, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <span className="font-bold text-zinc-700 truncate">{f.nombre || "Flete"}</span>
                <span className="font-black text-purple-600 ml-2 flex-shrink-0">{formatMoney(f.monto)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center border-t border-zinc-200 pt-2 mt-2">
              <span className="text-[10px] font-black text-zinc-400 uppercase">Total fletes</span>
              <span className="font-black text-purple-700">{formatMoney(totalFletes)}</span>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-zinc-400 ml-2 font-black">Descripción del flete</label>
            <div className="relative">
              <div className="flex items-center gap-2 border-2 border-zinc-200 rounded-2xl px-4 py-3 focus-within:border-orange-500 transition-colors">
                <Search size={16} className="text-zinc-400 flex-shrink-0" />
                <input
                  value={motivo}
                  onChange={(e) => handleMotivo(e.target.value)}
                  onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
                  placeholder="Ej: Cadetería zona norte"
                  autoComplete="off"
                  className="w-full font-black outline-none bg-transparent"
                />
              </div>
              {mostrarSugerencias && sugerencias.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-2xl shadow-xl z-10 max-h-48 overflow-y-auto">
                  {sugerencias.map((item, i) => (
                    <button
                      key={i}
                      onMouseDown={() => seleccionarSugerencia(item)}
                      className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b border-zinc-100 last:border-b-0 active:bg-orange-100"
                    >
                      <p className="text-sm font-black text-zinc-800">{item.nombre}</p>
                      <p className="text-[10px] text-zinc-400">{formatMoney(item.precio)} · {item.usos || 0} usos</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-zinc-400 ml-2 font-black">Monto ($)</label>
            <input
              type="text"
              inputMode="numeric"
              value={monto}
              onChange={(e) => setMonto(e.target.value.replace(/[^0-9.,]/g, ""))}
              placeholder="0"
              className="w-full border-2 border-zinc-200 rounded-2xl p-4 font-black outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <button onClick={cargar} className="w-full bg-orange-600 text-white py-5 rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all">
            Agregar flete o cadetería
          </button>
        </div>
      </div>
    </div>
  );
}
