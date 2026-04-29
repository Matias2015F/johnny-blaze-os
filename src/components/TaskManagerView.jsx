import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, X, Sparkles } from "lucide-react";
import { LS, useCollection, generateId } from "../lib/storage.js";
import { CONFIG_DEFAULT, SERVICIOS_DEFAULT } from "../lib/constants.js";
import { calcularNuevoTotal } from "../lib/calc.js";
import { obtenerAprendizaje, evaluarConfianza } from "../lib/priceLearning.js";
import { formatMoney } from "../utils/format.js";

const PRESETS = [10, 20, 30, 50, 80];

export default function TaskManagerView({ order, setView, showToast, serviceToEdit, setServiceToEdit }) {
  const catalogData = useCollection("catalogoTareas");
  const bikes       = useCollection("motos");
  const config      = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const servicios   = [...SERVICIOS_DEFAULT, ...catalogData];
  const bike        = bikes.find(b => b.id === order.bikeId) || {};

  const defaultMargen = config.margenPolitica ?? 25;

  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: "", horasBase: 1, dificultad: "normal", repuestos: [], insumos: [], observacionesProxima: "",
  });
  const [sugerencia, setSugerencia] = useState(null);
  const [margenPct, setMargenPct] = useState(defaultMargen);
  const [customMode, setCustomMode] = useState(false);

  // Cargar datos de tarea existente al editar — FIX: incluye repuestos e insumos guardados
  useEffect(() => {
    if (serviceToEdit) {
      const apr = obtenerAprendizaje(serviceToEdit.nombre, bike.cilindrada);
      setSugerencia(apr ? { apr, confianza: evaluarConfianza(apr) } : null);
      setEditForm({
        nombre: serviceToEdit.nombre,
        horasBase: serviceToEdit.horasBase || 1,
        dificultad: serviceToEdit.dificultad || "normal",
        repuestos: serviceToEdit.repuestos || [],
        insumos: serviceToEdit.insumos || [],
        observacionesProxima: serviceToEdit.observacionesProxima || order.observacionesProxima || "",
      });
      setMargenPct(serviceToEdit.margenPct ?? defaultMargen);
    }
  }, [serviceToEdit]);

  const aplicarHistorial = (nombre, horasBase) => {
    const apr = obtenerAprendizaje(nombre, bike.cilindrada);
    if (apr) {
      setSugerencia({ apr, confianza: evaluarConfianza(apr) });
      return Math.round(apr.promedio * 10) / 10;
    }
    setSugerencia(null);
    return horasBase;
  };

  const handleSelect = (id) => {
    setSelectedId(id);
    if (!id) {
      setEditForm({ nombre: "", horasBase: 1, dificultad: "normal", repuestos: [], insumos: [], observacionesProxima: "" });
      setSugerencia(null);
      return;
    }
    const s = servicios.find(x => x.id === id);
    if (s) {
      const horasBase = aplicarHistorial(s.nombre, s.horasBase || 1);
      setEditForm({
        nombre: s.nombre,
        horasBase,
        dificultad: s.dificultad || "normal",
        repuestos: [],
        insumos: [],
        observacionesProxima: order.observacionesProxima || "",
      });
    }
  };

  const updateListItem = (lista, idx, field, val) => {
    const numFields = ["monto", "cantidad", "montoCosto"];
    const parsed = numFields.includes(field) ? (typeof val === "number" ? val : Number(String(val).replace(/\D/g, "")) || 0) : val;
    const list = editForm[lista].map((item, i) => i === idx ? { ...item, [field]: parsed } : item);
    setEditForm({ ...editForm, [lista]: list });
  };

  const stats = useMemo(() => {
    const factor  = (config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[editForm.dificultad] || 1;
    const pct     = Number(margenPct || 0);

    // Mano de obra: costo real → precio con margen (0 si no hay nombre de tarea)
    const activa   = editForm.nombre.trim().length > 0;
    const moCosto  = activa ? editForm.horasBase * (config.valorHoraInterno || 12000) * factor : 0;
    const moPrecio = Math.round(moCosto * (1 + pct / 100));

    // Repuestos: al cliente al costo (sin markup)
    const repCosto  = editForm.repuestos.reduce((s, r) => s + ((r.montoCosto || r.monto || 0) * (r.cantidad || 1)), 0);
    const repPrecio = repCosto;

    // Fletes: al cliente al costo
    const fleCosto  = (order.fletes || []).reduce((s, f) => s + (f.monto || 0), 0);
    const flePrecio = fleCosto;

    // Insumos/terceros: al cliente al costo
    const insCosto  = editForm.insumos.reduce((s, i) => s + (i.monto || 0), 0);
    const insPrecio = insCosto;

    const totalCosto  = moCosto + repCosto + fleCosto + insCosto;
    const totalCobrar = moPrecio + repPrecio + flePrecio + insPrecio;
    const margen      = moPrecio - moCosto;
    const rentabilidad = moCosto > 0 ? (margen / moCosto) * 100 : 0;

    return { moCosto, moPrecio, repCosto, repPrecio, fleCosto, flePrecio, insCosto, insPrecio, totalCosto, totalCobrar, margen, rentabilidad };
  }, [editForm, config, margenPct, order.fletes]);

  const aplicar = () => {
    const nombreTarea = editForm.nombre.trim();
    if (!nombreTarea) { showToast("¡Falta el nombre!"); return; }

    const tareaId = nombreTarea.toLowerCase();
    // Repuestos: precio final tal como lo ingresó el usuario
    const repuestosGuardados = editForm.repuestos.map(r => ({ ...r, _tareaId: tareaId }));
    const insumosGuardados = editForm.insumos.map(i => ({ ...i, _tareaId: tareaId }));

    const datosTarea = {
      nombre: nombreTarea,
      monto: stats.moPrecio,
      horasBase: editForm.horasBase,
      dificultad: editForm.dificultad,
      horasReal: editForm.horasBase,
      repuestos: editForm.repuestos,   // guardado en la tarea para recargar al editar
      insumos: editForm.insumos,
      margenPct,
    };

    const idx = (order.tareas || []).findIndex(t => t.nombre.trim().toLowerCase() === tareaId);
    let nuevasTareas = [...(order.tareas || [])];
    if (idx !== -1) { nuevasTareas[idx] = datosTarea; showToast("Actualizado ✓"); }
    else            { nuevasTareas.push(datosTarea);  showToast("Agregado ✓"); }

    // Reemplaza los repuestos/insumos anteriores de esta tarea sin tocar los de logística
    const prevRepuestos = (order.repuestos || []).filter(r => r._tareaId !== tareaId);
    const prevInsumos   = (order.insumos   || []).filter(i => i._tareaId !== tareaId);
    const nuevosRepuestos = [...prevRepuestos, ...repuestosGuardados];
    const nuevosInsumos   = [...prevInsumos,   ...insumosGuardados];

    const nTotal = calcularNuevoTotal(nuevasTareas, nuevosRepuestos, order.fletes, nuevosInsumos);
    LS.updateDoc("ordenes", order.id, {
      tareas: nuevasTareas,
      repuestos: nuevosRepuestos,
      insumos: nuevosInsumos,
      total: nTotal,
      observacionesProxima: editForm.observacionesProxima || order.observacionesProxima,
    });

    // Catálogo: solo datos del servicio, no repuestos específicos de la orden
    const existente = catalogData.find(s => s.nombre.trim().toLowerCase() === tareaId);
    const idCat = existente?.id || generateId();
    LS.setDoc("catalogoTareas", idCat, {
      id: idCat,
      nombre: nombreTarea,
      horasBase: editForm.horasBase,
      dificultad: editForm.dificultad,
      margenPct,
    });

    setServiceToEdit(null);
    setView("detalleOrden");
  };

  const factor = (config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[editForm.dificultad] || 1;

  return (
    <div className="p-6 text-left animate-in slide-in-from-bottom duration-300 pb-32">
      <button onClick={() => { setServiceToEdit(null); setView("detalleOrden"); }}
        className="mb-6 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver
      </button>

      <div className="space-y-4">

        {/* Selector + nombre */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-4">
          <select value={selectedId || ""} onChange={e => handleSelect(e.target.value)}
            className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black bg-white outline-none text-sm">
            <option value="">-- Escribir manualmente --</option>
            {servicios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
          <div className="space-y-1">
            <label className="text-[10px] uppercase text-slate-400 ml-1 font-black tracking-widest">Nombre del servicio</label>
            <input
              value={editForm.nombre}
              onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
              placeholder="Ej: Cambio de cubierta"
              className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Sugerencia del sistema */}
        {sugerencia && (
          <div className={`rounded-[2rem] border p-5 space-y-3 ${sugerencia.confianza?.badge || "bg-slate-50 border-slate-200"}`}>
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="flex-shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-widest">
                Sugerencia · {sugerencia.apr.muestras} {sugerencia.apr.muestras === 1 ? "trabajo" : "trabajos"} registrados
              </p>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[9px] font-bold opacity-70 uppercase">Tiempo promedio real</p>
                <p className="text-xl font-black">{Math.round(sugerencia.apr.promedio * 10) / 10}h</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold opacity-70 uppercase">Variabilidad</p>
                <p className="text-sm font-black">±{Math.round(sugerencia.apr.desvio * 10) / 10}h</p>
              </div>
              <div className={`px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase ${sugerencia.confianza?.badge || ""}`}>
                {sugerencia.confianza?.texto || "Sin datos"}
              </div>
            </div>
          </div>
        )}

        {/* Mano de obra */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mano de obra</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-slate-400 font-bold ml-1 tracking-widest">Horas</label>
              <input type="number" step="0.5" min="0.5" value={editForm.horasBase}
                onChange={e => setEditForm({ ...editForm, horasBase: Number(e.target.value) })}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-center outline-none focus:border-blue-500" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-slate-400 font-bold ml-1 tracking-widest">Dificultad</label>
              <select value={editForm.dificultad} onChange={e => setEditForm({ ...editForm, dificultad: e.target.value })}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl p-3 font-black text-xs uppercase outline-none focus:border-blue-500">
                <option value="facil">Fácil</option>
                <option value="normal">Normal</option>
                <option value="dificil">Difícil</option>
                <option value="complicado">Complicado</option>
              </select>
            </div>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 text-center space-y-0.5">
            <p className="text-[9px] text-slate-400 font-bold">
              {editForm.horasBase}h × {formatMoney(config.valorHoraInterno || 12000)}/h × {factor.toFixed(1)} = costo {formatMoney(stats.moCosto)}
            </p>
            <p className="text-[10px] font-black text-slate-700">
              con {margenPct}% → <span className="text-blue-600">{formatMoney(stats.moPrecio)} al cliente</span>
            </p>
          </div>
        </div>

        {/* Repuestos — se ingresa el costo, el precio se deriva del margen */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Repuestos</p>
            <button
              onClick={() => setEditForm({ ...editForm, repuestos: [...editForm.repuestos, { nombre: "", monto: 0, cantidad: 1 }] })}
              className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Plus size={18} />
            </button>
          </div>
          {editForm.repuestos.length === 0 && (
            <p className="text-[10px] text-slate-300 font-bold text-center py-1">Sin repuestos cargados</p>
          )}
          {editForm.repuestos.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <input
                className="flex-1 border-none bg-transparent text-xs font-black uppercase text-slate-700 outline-none"
                placeholder="Nombre del repuesto..."
                value={item.nombre}
                onChange={e => updateListItem("repuestos", idx, "nombre", e.target.value)}
              />
              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                <span className="text-[10px] font-black text-slate-300">$</span>
                <input
                  type="text" inputMode="numeric"
                  className="w-20 text-xs text-right font-black outline-none bg-transparent text-blue-600"
                  value={item.monto > 0 ? item.monto.toLocaleString("es-AR") : ""}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, "");
                    updateListItem("repuestos", idx, "monto", digits ? Number(digits) : 0);
                  }}
                  placeholder="0"
                />
              </div>
              <button onClick={() => setEditForm({ ...editForm, repuestos: editForm.repuestos.filter((_, i) => i !== idx) })}
                className="p-1 text-slate-300 active:text-red-500">
                <X size={16} />
              </button>
            </div>
          ))}
          {editForm.repuestos.length > 0 && stats.repPrecio > 0 && (
            <div className="flex justify-between text-[10px] font-black px-1 pt-1 border-t border-slate-100">
              <span className="text-slate-400">Total repuestos</span>
              <span className="text-blue-600">{formatMoney(stats.repPrecio)}</span>
            </div>
          )}
        </div>

        {/* Insumos / Terceros — pasan al cliente sin markup */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Otros gastos (insumos / servicios externos)</p>
              <p className="text-[9px] text-slate-300 font-bold">Se cobran al cliente sin ganancia adicional</p>
            </div>
            <button
              onClick={() => setEditForm({ ...editForm, insumos: [...editForm.insumos, { nombre: "", monto: 0 }] })}
              className="p-2 rounded-xl bg-orange-50 text-orange-500">
              <Plus size={18} />
            </button>
          </div>
          {editForm.insumos.length === 0 && (
            <p className="text-[10px] text-slate-300 font-bold text-center py-1">Sin insumos cargados</p>
          )}
          {editForm.insumos.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <input
                className="flex-1 border-none bg-transparent text-xs font-black uppercase text-slate-700 outline-none"
                placeholder="Nombre..."
                value={item.nombre}
                onChange={e => updateListItem("insumos", idx, "nombre", e.target.value)}
              />
              <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
                <span className="text-[10px] font-black text-slate-300">$</span>
                <input
                  type="text" inputMode="numeric"
                  className="w-20 text-xs text-right font-black outline-none bg-transparent text-orange-500"
                  value={item.monto > 0 ? item.monto.toLocaleString("es-AR") : ""}
                  onChange={e => {
                    const digits = e.target.value.replace(/\D/g, "");
                    updateListItem("insumos", idx, "monto", digits ? Number(digits) : 0);
                  }}
                  placeholder="0"
                />
              </div>
              <button onClick={() => setEditForm({ ...editForm, insumos: editForm.insumos.filter((_, i) => i !== idx) })}
                className="p-1 text-slate-300 active:text-red-500">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* HÉROE: Precio total + Margen */}
        <div className="bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl">

          <div className="p-6 text-center space-y-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio total al cliente</p>
            <p className="text-5xl font-black text-white tracking-tighter leading-none">
              {formatMoney(stats.totalCobrar)}
            </p>
            <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10px] text-slate-500 font-bold mt-2">
              {stats.moPrecio > 0  && <span>MO {formatMoney(stats.moPrecio)}</span>}
              {stats.repPrecio > 0 && <><span className="text-slate-700">+</span><span>Rep {formatMoney(stats.repPrecio)}</span></>}
              {stats.flePrecio > 0 && <><span className="text-slate-700">+</span><span>Fle {formatMoney(stats.flePrecio)}</span></>}
              {stats.insPrecio > 0 && <><span className="text-slate-700">+</span><span>Ins {formatMoney(stats.insPrecio)}</span></>}
            </div>
          </div>

          {/* Control de margen */}
          <div className="px-6 pb-4 space-y-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Margen de ganancia (solo MO)</p>

            <div className="grid grid-cols-3 gap-2">
              {PRESETS.map(p => (
                <button key={p}
                  onClick={() => { setMargenPct(p); setCustomMode(false); }}
                  className={`py-3 rounded-2xl text-sm font-black transition-all active:scale-95 ${
                    !customMode && margenPct === p ? "bg-green-500 text-white" : "bg-slate-800 border border-slate-700 text-slate-400"
                  }`}>
                  {p}%
                </button>
              ))}
              <button
                onClick={() => setCustomMode(true)}
                className={`py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
                  customMode ? "bg-blue-600 text-white" : "bg-slate-800 border border-slate-700 text-slate-400"
                }`}>
                Otro %
              </button>
            </div>

            {customMode && (
              <div className="flex items-center gap-2 bg-slate-800 border border-blue-500 rounded-2xl px-4 py-3">
                <input
                  type="number" min="0" max="500" autoFocus
                  value={margenPct}
                  onChange={e => { const v = Number(e.target.value); setMargenPct(isNaN(v) ? 0 : Math.max(0, v)); }}
                  className="flex-1 bg-transparent text-white font-black text-xl text-center outline-none"
                />
                <span className="text-slate-400 font-black">%</span>
              </div>
            )}
          </div>

          {/* Resultado */}
          <div className="border-t border-slate-800 p-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-black text-slate-400">Costo total</span>
              <span className="font-black text-slate-500">{formatMoney(stats.totalCosto)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-slate-800 pt-2">
              <span className="font-black text-white">Mano de obra</span>
              <div className="flex items-baseline gap-2">
                <span className="font-black text-lg tracking-tighter text-green-400">
                  {formatMoney(stats.moPrecio)}
                </span>
                <span className={`text-[10px] font-black ${stats.rentabilidad < 20 ? "text-red-400" : "text-slate-500"}`}>
                  {Math.round(stats.rentabilidad)}%
                </span>
              </div>
            </div>
            <button onClick={aplicar}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all mt-2">
              Confirmar y agregar a la orden
            </button>
          </div>
        </div>

        {/* Observaciones */}
        <div className="bg-white p-6 rounded-[2rem] shadow-sm space-y-1">
          <label className="text-[10px] uppercase text-slate-400 ml-1 font-black tracking-widest">Notas para la próxima visita</label>
          <textarea
            value={editForm.observacionesProxima}
            onChange={e => setEditForm({ ...editForm, observacionesProxima: e.target.value })}
            rows="2"
            className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm outline-none focus:border-blue-500"
            placeholder="Ej: Revisar transmisión en 2000km..."
          />
        </div>

      </div>
    </div>
  );
}
