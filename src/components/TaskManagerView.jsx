import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, X, RefreshCw, Sparkles } from "lucide-react";
import { LS, useCollection, generateId } from "../lib/storage.js";
import { CONFIG_DEFAULT, SERVICIOS_DEFAULT } from "../lib/constants.js";
import { calcularNuevoTotal } from "../lib/calc.js";
import { obtenerAprendizaje, evaluarConfianza } from "../lib/priceLearning.js";
import { formatMoney, parseMonto } from "../utils/format.js";

const MARGEN_PASOS = [5, 10, 15, 20, 30];

export default function TaskManagerView({ order, setView, showToast, serviceToEdit, setServiceToEdit }) {
  const catalogData = useCollection("serviciosCatalogo");
  const bikes       = useCollection("motos");
  const config      = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const servicios   = [...SERVICIOS_DEFAULT, ...catalogData];
  const bike        = bikes.find(b => b.id === order.bikeId) || {};

  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: "", horasBase: 1, dificultad: "normal", montoMO: 0, repuestos: [], insumos: [], observacionesProxima: "",
  });
  const [moBase, setMoBase] = useState(0);
  const [sugerencia, setSugerencia] = useState(null);
  const [margenPct, setMargenPct] = useState(0);

  const calcMO = (horasBase, dificultad) => {
    const factor = (config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[dificultad] || 1;
    return Math.round((config.valorHoraCliente || 15000) * horasBase * factor);
  };

  useEffect(() => {
    if (serviceToEdit) {
      const mo = serviceToEdit.monto || 0;
      const apr = obtenerAprendizaje(serviceToEdit.nombre, bike.cilindrada);
      setSugerencia(apr ? { apr, confianza: evaluarConfianza(apr) } : null);
      setEditForm({
        nombre: serviceToEdit.nombre,
        horasBase: serviceToEdit.horasBase || 1,
        dificultad: serviceToEdit.dificultad || "normal",
        montoMO: mo,
        repuestos: serviceToEdit.repuestos || [],
        insumos: serviceToEdit.insumos || [],
        observacionesProxima: serviceToEdit.observacionesProxima || order.observacionesProxima || "",
      });
      setMoBase(mo);
    }
  }, [serviceToEdit, order.observacionesProxima]);

  const aplicarHistorial = (nombre, horasBase, dificultad) => {
    const apr = obtenerAprendizaje(nombre, bike.cilindrada);
    if (apr) {
      const confianza = evaluarConfianza(apr);
      setSugerencia({ apr, confianza });
      // Usa tiempo real histórico como horasBase
      const horasHistorial = Math.round(apr.promedio * 10) / 10;
      const mo = calcMO(horasHistorial, dificultad);
      return { horasBase: horasHistorial, montoMO: mo };
    }
    setSugerencia(null);
    return { horasBase, montoMO: calcMO(horasBase, dificultad) };
  };

  const handleSelect = (id) => {
    setSelectedId(id);
    if (!id) {
      const mo = calcMO(1, "normal");
      setEditForm({ nombre: "", horasBase: 1, dificultad: "normal", montoMO: mo, repuestos: [], insumos: [], observacionesProxima: "" });
      setMoBase(mo);
      setSugerencia(null);
      return;
    }
    const s = servicios.find((x) => x.id === id);
    if (s) {
      const { horasBase, montoMO } = aplicarHistorial(s.nombre, s.horasBase || 1, s.dificultad || "normal");
      const form = { ...JSON.parse(JSON.stringify(s)), horasBase, montoMO, observacionesProxima: order.observacionesProxima || "" };
      setEditForm(form);
      setMoBase(montoMO);
    }
  };

  // Cambia horas o dificultad → recalcula MO automáticamente
  const updateMOParams = (field, val) => {
    const updated = { ...editForm, [field]: val };
    const mo = calcMO(updated.horasBase, updated.dificultad);
    updated.montoMO = mo;
    setMoBase(mo);
    setEditForm(updated);
  };

  // Ajuste manual del total (modifica montoMO porque repuestos son costo fijo)
  const ajustarTotal = (delta) => {
    setEditForm(f => ({ ...f, montoMO: Math.max(0, f.montoMO + delta) }));
  };

  const resetMO = () => {
    setEditForm(f => ({ ...f, montoMO: moBase }));
  };

  const updateListItem = (lista, idx, field, val) => {
    const parsed = ["monto", "cantidad", "montoCosto"].includes(field) ? parseMonto(val) : val;
    const list = editForm[lista].map((item, i) =>
      i === idx ? { ...item, [field]: parsed } : item
    );
    setEditForm({ ...editForm, [lista]: list });
  };

  const stats = useMemo(() => {
    const moPrecio     = editForm.montoMO;
    const moCosto      = editForm.horasBase * (config.valorHoraInterno || 12000);
    const repPrecio    = editForm.repuestos.reduce((s, r) => s + ((r.monto || 0) * (r.cantidad || 1)), 0);
    const repCosto     = editForm.repuestos.reduce((s, r) => s + ((r.montoCosto || r.monto || 0) * (r.cantidad || 1)), 0);
    const insumosPrecio= editForm.insumos.reduce((s, i) => s + (i.monto || 0), 0); // cobrado al cliente
    const insumosCosto = insumosPrecio; // sin markup

    const totalBase        = moPrecio + repPrecio + insumosPrecio;
    const margenExtra      = margenPct > 0 ? Math.round(totalBase * margenPct / 100) : 0;
    const totalCobrar      = totalBase + margenExtra;
    const totalCostoInterno= moCosto + repCosto + insumosCosto;
    const margen           = totalCobrar - totalCostoInterno;
    const rentabilidad     = totalCobrar > 0 ? (margen / totalCobrar) * 100 : 0;

    return { moPrecio, moCosto, repPrecio, repCosto, insumosPrecio, insumosCosto, totalBase, margenExtra, totalCobrar, totalCostoInterno, margen, rentabilidad };
  }, [editForm, config, margenPct]);

  const moAjustada = editForm.montoMO !== moBase && moBase > 0;

  const aplicar = () => {
    const nombreTarea = editForm.nombre.trim();
    if (!nombreTarea) { showToast("¡Falta el nombre!"); return; }

    const idx = (order.tareas || []).findIndex((t) => t.nombre.trim().toLowerCase() === nombreTarea.toLowerCase());
    let nuevasTareas = [...(order.tareas || [])];
    // El margen extra (%) se suma al monto de MO al guardar
    const montoMOFinal = parseMonto(editForm.montoMO) + stats.margenExtra;
    const datosTarea = { nombre: nombreTarea, monto: montoMOFinal, horasBase: editForm.horasBase, horasReal: editForm.horasBase };

    if (idx !== -1) { nuevasTareas[idx] = datosTarea; showToast("Precio actualizado ✓"); }
    else { nuevasTareas.push(datosTarea); showToast("Agregado ✓"); }

    const nuevosRepuestos = [...(order.repuestos || []), ...editForm.repuestos];
    const nuevosInsumos = [...(order.insumos || []), ...editForm.insumos];
    const nTotal = calcularNuevoTotal(nuevasTareas, nuevosRepuestos, order.fletes, nuevosInsumos);
    LS.updateDoc("ordenes", order.id, {
      tareas: nuevasTareas, repuestos: nuevosRepuestos, insumos: nuevosInsumos,
      total: nTotal, observacionesProxima: editForm.observacionesProxima || order.observacionesProxima,
    });

    const key = nombreTarea.toLowerCase();
    const existente = catalogData.find((s) => s.nombre.trim().toLowerCase() === key);
    const idCat = existente?.id || generateId();
    LS.setDoc("serviciosCatalogo", idCat, { ...editForm, id: idCat, nombre: nombreTarea });

    setServiceToEdit(null);
    setView("detalleOrden");
  };

  const factor = (config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[editForm.dificultad] || 1;

  return (
    <div className="p-6 text-left animate-in slide-in-from-bottom duration-300 pb-32">
      <button onClick={() => { setServiceToEdit(null); setView("detalleOrden"); }} className="mb-6 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="space-y-4">

        {/* Selector + nombre */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
          <select value={selectedId || ""} onChange={(e) => handleSelect(e.target.value)} className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black bg-white outline-none text-sm">
            <option value="">-- Nuevo / Manual --</option>
            {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-400 ml-1 font-black tracking-widest">Nombre del servicio</label>
            <input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} placeholder="Ej: Cambio de cubierta" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-blue-500" />
          </div>
        </div>

        {/* SUGERENCIA DEL SISTEMA — solo cuando hay historial */}
        {sugerencia && (
          <div className={`rounded-[2rem] border p-5 space-y-3 ${sugerencia.confianza?.badge || "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="flex-shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-widest">
                Sugerencia del sistema · {sugerencia.apr.muestras} {sugerencia.apr.muestras === 1 ? "trabajo" : "trabajos"} registrados
              </p>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] font-bold opacity-70 uppercase tracking-wide">Tiempo promedio real</p>
                <p className="text-xl font-black">{Math.round(sugerencia.apr.promedio * 10) / 10}h</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold opacity-70 uppercase tracking-wide">Variabilidad</p>
                <p className="text-sm font-black">±{Math.round(sugerencia.apr.desvio * 10) / 10}h</p>
              </div>
              <div className={`px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase tracking-wide ${sugerencia.confianza?.badge || ""}`}>
                {sugerencia.confianza?.texto || "Sin datos"}
              </div>
            </div>
            <p className="text-[9px] opacity-60 font-bold">
              Las horas y el precio de abajo ya reflejan este historial. Podés ajustar si este trabajo es diferente.
            </p>
          </div>
        )}

        {/* Parámetros MO — compacto, secundario */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mano de obra</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-slate-400 font-bold ml-1 tracking-widest">Horas</label>
              <input type="number" step="0.5" min="0.5" value={editForm.horasBase}
                onChange={(e) => updateMOParams("horasBase", Number(e.target.value))}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-center outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-slate-400 font-bold ml-1 tracking-widest">Dificultad</label>
              <select value={editForm.dificultad} onChange={(e) => updateMOParams("dificultad", e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-xs uppercase outline-none focus:border-blue-500">
                <option value="facil">Fácil</option>
                <option value="normal">Normal</option>
                <option value="dificil">Difícil</option>
                <option value="complicado">Complicado</option>
              </select>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 text-center">
            {editForm.horasBase}h × {(config.valorHoraCliente || 15000).toLocaleString("es-AR")}/h × {factor.toFixed(1)} = <span className="font-black text-slate-600">{formatMoney(moBase)}</span>
          </p>
        </div>

        {/* Repuestos + Insumos */}
        {["repuestos", "insumos"].map((lista) => (
          <div key={lista} className="bg-white p-6 rounded-[2rem] shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{lista === "repuestos" ? "Repuestos" : "Insumos / Terceros"}</p>
              <button onClick={() => setEditForm({ ...editForm, [lista]: [...editForm[lista], { nombre: "", monto: 0, cantidad: 1 }] })}
                className={`p-2 rounded-xl ${lista === "repuestos" ? "bg-blue-50 text-blue-600" : "bg-orange-50 text-orange-500"}`}>
                <Plus size={18} />
              </button>
            </div>
            {editForm[lista].length === 0 && (
              <p className="text-[10px] text-slate-300 font-bold text-center py-1">Sin {lista === "repuestos" ? "repuestos" : "insumos"}</p>
            )}
            {editForm[lista].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <input className="flex-1 border-none bg-transparent text-xs font-black uppercase text-slate-700 outline-none" placeholder="Nombre..." value={item.nombre} onChange={(e) => updateListItem(lista, idx, "nombre", e.target.value)} />
                <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                  <span className="text-[10px] font-black text-slate-300">$</span>
                  <input type="text" inputMode="numeric" className={`w-20 text-xs text-right font-black outline-none bg-transparent ${lista === "repuestos" ? "text-blue-600" : "text-orange-500"}`}
                    value={item.monto > 0 ? item.monto.toLocaleString("es-AR") : ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      updateListItem(lista, idx, "monto", digits ? Number(digits) : 0);
                    }} placeholder="0" />
                </div>
                <button onClick={() => setEditForm({ ...editForm, [lista]: editForm[lista].filter((_, i) => i !== idx) })} className="p-1 text-slate-300 active:text-red-500">
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        ))}

        {/* PRECIO TOTAL AL CLIENTE — HÉROE */}
        <div className="bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl">

          {/* Número dominante */}
          <div className="p-6 text-center space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio total al cliente</p>
            <p className="text-5xl font-black text-white tracking-tighter leading-none">
              {formatMoney(stats.totalCobrar)}
            </p>
            {/* Composición del total */}
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-bold mt-2">
              {stats.moPrecio > 0      && <span>MO {formatMoney(stats.moPrecio)}</span>}
              {stats.repPrecio > 0     && <><span className="text-slate-700">+</span><span>Repuestos {formatMoney(stats.repPrecio)}</span></>}
              {stats.insumosPrecio > 0 && <><span className="text-slate-700">+</span><span>Insumos {formatMoney(stats.insumosPrecio)}</span></>}
              {stats.margenExtra > 0   && <><span className="text-slate-700">+</span><span className="text-green-500">Margen {formatMoney(stats.margenExtra)}</span></>}
            </div>
          </div>

          {/* Margen adicional % */}
          <div className="px-6 pb-4 space-y-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Agregar margen de ganancia</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {MARGEN_PASOS.map(p => (
                <button key={p}
                  onClick={() => setMargenPct(prev => prev === p ? 0 : p)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all active:scale-95 ${
                    margenPct === p
                      ? "bg-green-500 text-white"
                      : "bg-slate-800 border border-slate-700 text-slate-400"
                  }`}>
                  +{p}%
                </button>
              ))}
            </div>
            {margenPct > 0 && (
              <p className="text-[10px] text-green-400 font-black text-center">
                +{margenPct}% = +{formatMoney(stats.margenExtra)} sobre el total
              </p>
            )}
            {moAjustada && (
              <button onClick={resetMO} className="w-full flex items-center justify-center gap-1.5 text-[9px] text-slate-600 font-black uppercase tracking-widest py-1 active:text-slate-400 transition-all">
                <RefreshCw size={11} /> Volver al precio de fórmula ({formatMoney(moBase)})
              </button>
            )}
          </div>

          {/* Resultado — directamente accionable */}
          <div className="border-t border-slate-800 p-6 space-y-3">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-black text-slate-400">Cobrás</span>
                <span className="font-black text-white">{formatMoney(stats.totalCobrar)}</span>
              </div>
              {stats.margenExtra > 0 && (
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-500">Margen adicional +{margenPct}%</span>
                  <span className="font-black text-green-400">+{formatMoney(stats.margenExtra)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="font-black text-slate-400">Te cuesta</span>
                <span className="font-black text-slate-500">{formatMoney(stats.totalCostoInterno)}</span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-800 pt-2 mt-2">
                <span className="font-black text-white">Ganás</span>
                <div className="flex items-baseline gap-2">
                  <span className={`font-black text-lg tracking-tighter ${stats.margen >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {formatMoney(stats.margen)}
                  </span>
                  <span className={`text-[10px] font-black ${stats.rentabilidad < 20 ? "text-red-400" : "text-slate-500"}`}>
                    {Math.round(stats.rentabilidad)}%
                  </span>
                </div>
              </div>
            </div>

            <button onClick={aplicar} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all mt-2">
              Confirmar y agregar a la orden
            </button>
          </div>
        </div>

        {/* Observaciones */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-1">
          <label className="text-[10px] uppercase text-slate-400 ml-1 font-black tracking-widest">Obs. próxima visita</label>
          <textarea value={editForm.observacionesProxima} onChange={(e) => setEditForm({ ...editForm, observacionesProxima: e.target.value })}
            rows="2" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm outline-none focus:border-blue-500"
            placeholder="Ej: Revisar transmisión en 2000km..." />
        </div>

      </div>
    </div>
  );
}
