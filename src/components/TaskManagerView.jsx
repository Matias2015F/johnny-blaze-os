import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, X, Search, Sparkles, Bell } from "lucide-react";
import { LS, useCollection, generateId, buscarRepuestosAutocomplete, guardarRepuestoHistorial } from "../lib/storage.js";
import { CONFIG_DEFAULT, SERVICIOS_DEFAULT } from "../lib/constants.js";
import { calcularNuevoTotal } from "../lib/calc.js";
import { obtenerAprendizaje, evaluarConfianza } from "../lib/priceLearning.js";
import { formatMoney } from "../utils/format.js";
import { TIPOS_SERVICIO, detectarProximoControl, buildProximoControl } from "../lib/proximoControl.js";
import { trackEvent } from "../lib/telemetry.js";

// ── helpers ───────────────────────────────────────────────────────────────────
function norm(v = "") { return String(v).trim().toLowerCase(); }
function mismaMoto(a = {}, b = {}) {
  return norm(a.marca) === norm(b.marca) && norm(a.modelo) === norm(b.modelo) &&
    Number(a.cilindrada || 0) === Number(b.cilindrada || 0);
}

// ── Sheet wrapper ─────────────────────────────────────────────────────────────
function Sheet({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-h-[92vh] overflow-y-auto rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto max-w-[440px] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">{title}</h3>
            <button onClick={onClose} className="rounded-xl bg-zinc-800 p-2 text-zinc-400 active:scale-90 transition-all">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Sheet: agregar/editar trabajo ─────────────────────────────────────────────
function TrabajoSheet({ config, bike, bikes, catalogData, orders, editData, editIdx, onSave, onClose }) {
  const defaultMargen = config.margenPolitica ?? 25;
  const [nombre, setNombre] = useState(editData?.nombre || "");
  const [horasBase, setHorasBase] = useState(editData?.horasBase || 1);
  const [dificultad, setDificultad] = useState(editData?.dificultad || "normal");
  const [margenPct, setMargenPct] = useState(editData?.margenPct ?? defaultMargen);
  const [sugerencia, setSugerencia] = useState(null);
  const [mostrarCatalog, setMostrarCatalog] = useState(false);

  const servicios = useMemo(() => {
    const map = new Map();
    const add = (s, p = 0) => {
      const k = norm(s?.nombre); if (!k) return;
      const prev = map.get(k);
      if (!prev || p > prev._p) map.set(k, { ...s, _p: p });
    };
    (orders || []).forEach(t => {
      const m = (bikes || []).find(b => b.id === t.bikeId);
      if (!m || !mismaMoto(m, bike)) return;
      (t.tareas || []).forEach(ta => add(ta, 3));
    });
    (catalogData || []).forEach(s => add(s, s.marca ? 2 : 1));
    SERVICIOS_DEFAULT.forEach(s => add(s, 0));
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [catalogData, orders, bikes, bike]);

  const filtrados = nombre.trim()
    ? servicios.filter(s => norm(s.nombre).includes(norm(nombre)))
    : servicios;

  const seleccionar = (s) => {
    setNombre(s.nombre); setHorasBase(s.horasBase || 1); setDificultad(s.dificultad || "normal");
    if (s.margenPct) setMargenPct(s.margenPct);
    const apr = obtenerAprendizaje(s.nombre, bike?.cilindrada);
    setSugerencia(apr ? { apr, confianza: evaluarConfianza(apr) } : null);
    setMostrarCatalog(false);
  };

  useEffect(() => {
    if (!editData?.nombre) return;
    const apr = obtenerAprendizaje(editData.nombre, bike?.cilindrada);
    setSugerencia(apr ? { apr, confianza: evaluarConfianza(apr) } : null);
  }, []);

  const factor = (config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[dificultad] || 1;
  const moPrecio = Math.round(horasBase * (config.valorHoraInterno || 12000) * factor * (1 + margenPct / 100));

  return (
    <Sheet onClose={onClose} title={editIdx != null ? "Editar trabajo" : "Agregar trabajo"}>
      <div className="relative">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Servicio</label>
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
          <Search size={14} className="text-zinc-500 flex-shrink-0" />
          <input
            className="w-full bg-transparent font-black text-white outline-none placeholder:text-zinc-600"
            placeholder="Buscar o escribir servicio..."
            value={nombre}
            onChange={e => { setNombre(e.target.value); setMostrarCatalog(true); const apr = obtenerAprendizaje(e.target.value, bike?.cilindrada); setSugerencia(apr ? { apr, confianza: evaluarConfianza(apr) } : null); }}
            onFocus={() => setMostrarCatalog(true)}
            onBlur={() => setTimeout(() => setMostrarCatalog(false), 150)}
          />
        </div>
        {mostrarCatalog && filtrados.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-2xl shadow-xl z-10 max-h-48 overflow-y-auto">
            {filtrados.slice(0, 8).map((s, i) => (
              <button key={i} onMouseDown={() => seleccionar(s)}
                className="w-full text-left px-4 py-3 hover:bg-zinc-700 border-b border-zinc-700/40 last:border-0">
                <p className="text-sm font-black text-white">{s.nombre}</p>
                <p className="text-[9px] text-zinc-500">{s.horasBase}h · {s.dificultad || "normal"}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {sugerencia && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center gap-3">
          <Sparkles size={14} className="text-amber-400 flex-shrink-0" />
          <div>
            <p className="text-[9px] font-black text-amber-300 uppercase tracking-widest">
              Promedio real: {Math.round(sugerencia.apr.promedio * 10) / 10}h · {sugerencia.apr.muestras} trabajo{sugerencia.apr.muestras > 1 ? "s" : ""}
            </p>
            <button onClick={() => setHorasBase(Math.round(sugerencia.apr.promedio * 10) / 10)}
              className="text-[9px] font-black text-amber-400 underline">Usar promedio</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Horas</label>
          <input type="text" inputMode="decimal"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-center font-black text-white outline-none focus:border-orange-500 transition-colors"
            value={horasBase}
            onChange={e => setHorasBase(Number(e.target.value.replace(",", ".").replace(/[^0-9.]/g, "")) || 0)}
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Dificultad</label>
          <select className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-black text-white outline-none focus:border-orange-500 transition-colors"
            value={dificultad} onChange={e => setDificultad(e.target.value)}>
            <option value="facil">Fácil</option>
            <option value="normal">Normal</option>
            <option value="dificil">Difícil</option>
            <option value="complicado">Complicado</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Margen de ganancia</label>
        <div className="flex gap-2">
          {[15, 25, 35, 50].map(p => (
            <button key={p} onClick={() => setMargenPct(p)}
              className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${margenPct === p ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
              {p}%
            </button>
          ))}
        </div>
      </div>

      {nombre.trim() && moPrecio > 0 && (
        <div className="flex justify-between items-center rounded-2xl bg-orange-500/10 border border-orange-500/20 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">Precio al cliente</p>
          <p className="font-black text-orange-300">{formatMoney(moPrecio)}</p>
        </div>
      )}

      <button onClick={() => { if (!nombre.trim()) return; onSave({ nombre: nombre.trim(), horasBase, dificultad, monto: moPrecio, margenPct }, editIdx); }}
        disabled={!nombre.trim()}
        className="w-full rounded-2xl bg-orange-600 py-4 font-black uppercase text-white disabled:opacity-40 active:scale-95 transition-all">
        {editIdx != null ? "Guardar cambio" : "Agregar trabajo"}
      </button>
    </Sheet>
  );
}

// ── Sheet: repuesto ───────────────────────────────────────────────────────────
function RepuestoSheet({ bike, editData, editIdx, onSave, onClose }) {
  const [nombre, setNombre] = useState(editData?.nombre || "");
  const [cantidad, setCantidad] = useState(editData?.cantidad || 1);
  const [monto, setMonto] = useState(editData?.monto || 0);
  const [sugs, setSugs] = useState([]);
  const [mostrar, setMostrar] = useState(false);

  const buscar = (v) => {
    setNombre(v);
    const r = v.trim() ? buscarRepuestosAutocomplete(v, bike?.cilindrada, "repuesto") : [];
    setSugs(r); setMostrar(r.length > 0);
  };

  return (
    <Sheet onClose={onClose} title={editIdx != null ? "Editar repuesto" : "Agregar repuesto"}>
      <div className="relative">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Repuesto</label>
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
          <Search size={14} className="text-zinc-500 flex-shrink-0" />
          <input className="w-full bg-transparent font-black text-white outline-none placeholder:text-zinc-600"
            placeholder="Buscar repuesto..." value={nombre}
            onChange={e => buscar(e.target.value)} onBlur={() => setTimeout(() => setMostrar(false), 150)} />
        </div>
        {mostrar && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-2xl shadow-xl z-10 max-h-40 overflow-y-auto">
            {sugs.map((s, i) => (
              <button key={i} onMouseDown={() => { setNombre(s.nombre); setMonto(s.precio); setMostrar(false); }}
                className="w-full text-left px-4 py-3 hover:bg-zinc-700 border-b border-zinc-700/40 last:border-0">
                <p className="text-sm font-black text-white">{s.nombre}</p>
                <p className="text-[9px] text-zinc-400">{formatMoney(s.precio)} · {s.usos || 0} usos</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Cantidad</label>
          <input type="text" inputMode="numeric"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-center font-black text-white outline-none focus:border-orange-500 transition-colors"
            value={cantidad} onChange={e => setCantidad(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))} />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Precio unit.</label>
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
            <span className="font-black text-zinc-400">$</span>
            <input type="text" inputMode="numeric"
              className="w-full bg-transparent font-black text-orange-400 outline-none text-right"
              value={monto > 0 ? monto.toLocaleString("es-AR") : ""}
              onChange={e => setMonto(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="0" />
          </div>
        </div>
      </div>
      {monto > 0 && (
        <div className="flex justify-between items-center rounded-2xl bg-orange-500/10 border border-orange-500/20 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">Total</p>
          <p className="font-black text-orange-300">{formatMoney(cantidad * monto)}</p>
        </div>
      )}
      <button onClick={() => { if (!nombre.trim() || !monto) return; guardarRepuestoHistorial(nombre.trim(), monto, bike?.cilindrada, "repuesto"); onSave({ nombre: nombre.trim(), cantidad, monto }, editIdx); }}
        disabled={!nombre.trim() || !monto}
        className="w-full rounded-2xl bg-orange-600 py-4 font-black uppercase text-white disabled:opacity-40 active:scale-95 transition-all">
        {editIdx != null ? "Guardar cambio" : "Agregar repuesto"}
      </button>
    </Sheet>
  );
}

// ── Sheet: insumo ─────────────────────────────────────────────────────────────
function InsumoSheet({ bike, editData, editIdx, onSave, onClose }) {
  const [nombre, setNombre] = useState(editData?.nombre || "");
  const [cantidad, setCantidad] = useState(editData?.cantidad || 1);
  const [monto, setMonto] = useState(editData?.monto || 0);
  const [sugs, setSugs] = useState([]);
  const [mostrar, setMostrar] = useState(false);

  const buscar = (v) => {
    setNombre(v);
    const r = v.trim() ? buscarRepuestosAutocomplete(v, bike?.cilindrada, "insumo") : [];
    setSugs(r); setMostrar(r.length > 0);
  };

  return (
    <Sheet onClose={onClose} title={editIdx != null ? "Editar insumo" : "Agregar insumo"}>
      <div className="relative">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Insumo / servicio externo</label>
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
          <Search size={14} className="text-zinc-500 flex-shrink-0" />
          <input className="w-full bg-transparent font-black text-white outline-none placeholder:text-zinc-600"
            placeholder="Ej: Aceite 20W50, retén..." value={nombre}
            onChange={e => buscar(e.target.value)} onBlur={() => setTimeout(() => setMostrar(false), 150)} />
        </div>
        {mostrar && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-2xl shadow-xl z-10 max-h-40 overflow-y-auto">
            {sugs.map((s, i) => (
              <button key={i} onMouseDown={() => { setNombre(s.nombre); setMonto(s.precio); setMostrar(false); }}
                className="w-full text-left px-4 py-3 hover:bg-zinc-700 border-b border-zinc-700/40 last:border-0">
                <p className="text-sm font-black text-white">{s.nombre}</p>
                <p className="text-[9px] text-zinc-400">{formatMoney(s.precio)} · {s.usos || 0} usos</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Cantidad</label>
          <input type="text" inputMode="numeric"
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-center font-black text-white outline-none focus:border-orange-500 transition-colors"
            value={cantidad} onChange={e => setCantidad(Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1))} />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Costo unit.</label>
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
            <span className="font-black text-zinc-400">$</span>
            <input type="text" inputMode="numeric"
              className="w-full bg-transparent font-black text-orange-400 outline-none text-right"
              value={monto > 0 ? monto.toLocaleString("es-AR") : ""}
              onChange={e => setMonto(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="0" />
          </div>
        </div>
      </div>
      {monto > 0 && (
        <div className="flex justify-between items-center rounded-2xl bg-orange-500/10 border border-orange-500/20 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">Total insumo</p>
          <p className="font-black text-orange-300">{formatMoney(cantidad * monto)}</p>
        </div>
      )}
      <button onClick={() => { if (!nombre.trim() || !monto) return; guardarRepuestoHistorial(nombre.trim(), monto, bike?.cilindrada, "insumo"); onSave({ nombre: nombre.trim(), cantidad, monto }, editIdx); }}
        disabled={!nombre.trim() || !monto}
        className="w-full rounded-2xl bg-orange-600 py-4 font-black uppercase text-white disabled:opacity-40 active:scale-95 transition-all">
        {editIdx != null ? "Guardar cambio" : "Agregar insumo"}
      </button>
    </Sheet>
  );
}

// ── Sheet: flete ──────────────────────────────────────────────────────────────
function FleteSheet({ editData, editIdx, onSave, onClose }) {
  const [nombre, setNombre] = useState(editData?.nombre || editData?.descripcion || "");
  const [monto, setMonto] = useState(editData?.monto || 0);
  const [sugs, setSugs] = useState([]);
  const [mostrar, setMostrar] = useState(false);

  const buscar = (v) => {
    setNombre(v);
    const r = v.trim() ? buscarRepuestosAutocomplete(v, null, "flete") : [];
    setSugs(r); setMostrar(r.length > 0);
  };

  return (
    <Sheet onClose={onClose} title={editIdx != null ? "Editar flete" : "Agregar flete"}>
      <div className="relative">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Flete / cadetería</label>
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
          <Search size={14} className="text-zinc-500 flex-shrink-0" />
          <input className="w-full bg-transparent font-black text-white outline-none placeholder:text-zinc-600"
            placeholder="Ej: Cadetería repuestos zona norte..." value={nombre}
            onChange={e => buscar(e.target.value)} onBlur={() => setTimeout(() => setMostrar(false), 150)} />
        </div>
        {mostrar && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-2xl shadow-xl z-10 max-h-40 overflow-y-auto">
            {sugs.map((s, i) => (
              <button key={i} onMouseDown={() => { setNombre(s.nombre); setMonto(s.precio); setMostrar(false); }}
                className="w-full text-left px-4 py-3 hover:bg-zinc-700 border-b border-zinc-700/40 last:border-0">
                <p className="text-sm font-black text-white">{s.nombre}</p>
                <p className="text-[9px] text-zinc-400">{formatMoney(s.precio)}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Monto</label>
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
          <span className="font-black text-zinc-400">$</span>
          <input type="text" inputMode="numeric"
            className="w-full bg-transparent font-black text-purple-400 outline-none text-right"
            value={monto > 0 ? monto.toLocaleString("es-AR") : ""}
            onChange={e => setMonto(Number(e.target.value.replace(/\D/g, "")) || 0)} placeholder="0" />
        </div>
      </div>
      <button onClick={() => { if (!nombre.trim() || !monto) return; guardarRepuestoHistorial(nombre.trim(), monto, null, "flete"); onSave({ nombre: nombre.trim(), monto }, editIdx); }}
        disabled={!nombre.trim() || !monto}
        className="w-full rounded-2xl bg-orange-600 py-4 font-black uppercase text-white disabled:opacity-40 active:scale-95 transition-all">
        {editIdx != null ? "Guardar cambio" : "Agregar flete"}
      </button>
    </Sheet>
  );
}

// ── EditIcon inline ───────────────────────────────────────────────────────────
function EditIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

// ── Add dashed button ─────────────────────────────────────────────────────────
function AddBtn({ label, onClick }) {
  return (
    <button onClick={onClick}
      className="w-full mt-3 rounded-2xl border border-dashed border-zinc-700 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:border-orange-500/50 hover:text-orange-400 active:scale-95 transition-all flex items-center justify-center gap-1">
      <Plus size={12} /> {label}
    </button>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function TaskManagerView({ order, setView, showToast, serviceToEdit, setServiceToEdit }) {
  const catalogData = useCollection("catalogoTareas");
  const bikes       = useCollection("motos");
  const orders      = useCollection("trabajos");
  const config      = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const bike        = bikes.find(b => b.id === order.bikeId) || {};

  const [sheet, setSheet] = useState(null); // { tipo, editIdx, editData }
  const [observaciones, setObservaciones] = useState(order.observacionesProxima || "");

  // Abrir sheet si viene con serviceToEdit
  useEffect(() => {
    if (!serviceToEdit) return;
    const tipo = serviceToEdit._editType || "tareas";
    const idx  = typeof serviceToEdit._editIndex === "number" ? serviceToEdit._editIndex : null;
    const data = idx != null ? (order[tipo] || [])[idx] : serviceToEdit;
    const tipoSheet = tipo === "tareas" ? "trabajo" : tipo === "repuestos" ? "repuesto" : tipo === "insumos" ? "insumo" : "flete";
    setSheet({ tipo: tipoSheet, editIdx: idx, editData: data });
  }, [serviceToEdit]);

  useEffect(() => {
    trackEvent("open_gestionar_tareas", {
      screen: "gestionarTareas", entityType: "trabajo", entityId: order.id,
      metadata: { estado: order.estado || "" },
    }).catch(console.error);
  }, [order.id, order.estado]);

  const tareas    = order.tareas    || [];
  const repuestos = order.repuestos || [];
  const insumos   = order.insumos   || [];
  const fletes    = order.fletes    || [];

  const totalMO  = tareas.reduce((s, t) => s + (t.monto || 0), 0);
  const totalRep = repuestos.reduce((s, r) => s + (r.monto || 0) * (r.cantidad || 1), 0);
  const totalIns = insumos.reduce((s, i) => s + (i.monto || 0) * (i.cantidad || 1), 0);
  const totalFle = fletes.reduce((s, f) => s + (f.monto || 0), 0);
  const total    = totalMO + totalRep + totalIns + totalFle;

  const saveAll = (field, lista) => {
    const t = field === "tareas"    ? lista : tareas;
    const r = field === "repuestos" ? lista : repuestos;
    const f = field === "fletes"    ? lista : fletes;
    const i = field === "insumos"   ? lista : insumos;
    const nTotal = calcularNuevoTotal(t, r, f, i);
    LS.updateDoc("trabajos", order.id, { [field]: lista, total: nTotal });
  };

  const closeSheet = () => { setSheet(null); setServiceToEdit?.(null); };

  // Guardar trabajo + actualizar catálogo
  const handleSaveTrabajo = (tarea, editIdx) => {
    const lista = [...tareas];
    if (editIdx != null) lista[editIdx] = tarea; else lista.push(tarea);
    saveAll("tareas", lista);
    const idCat = catalogData.find(s => norm(s.nombre) === norm(tarea.nombre))?.id || generateId();
    LS.setDoc("catalogoTareas", idCat, {
      id: idCat, nombre: tarea.nombre, marca: bike.marca || "", modelo: bike.modelo || "",
      cilindrada: bike.cilindrada || "", horasBase: tarea.horasBase,
      dificultad: tarea.dificultad, margenPct: tarea.margenPct,
    });
    showToast(editIdx != null ? "Trabajo actualizado ✓" : "Trabajo agregado ✓");
    closeSheet();
  };

  const handleSaveRepuesto = (rep, editIdx) => {
    const lista = [...repuestos];
    if (editIdx != null) lista[editIdx] = rep; else lista.push({ ...rep, _tareaId: "" });
    saveAll("repuestos", lista);
    showToast(editIdx != null ? "Repuesto actualizado ✓" : "Repuesto agregado ✓");
    closeSheet();
  };

  const handleSaveInsumo = (ins, editIdx) => {
    const lista = [...insumos];
    if (editIdx != null) lista[editIdx] = ins; else lista.push({ ...ins, _tareaId: "" });
    saveAll("insumos", lista);
    showToast(editIdx != null ? "Insumo actualizado ✓" : "Insumo agregado ✓");
    closeSheet();
  };

  const handleSaveFlete = (fle, editIdx) => {
    const lista = [...fletes];
    if (editIdx != null) lista[editIdx] = fle; else lista.push(fle);
    saveAll("fletes", lista);
    showToast(editIdx != null ? "Flete actualizado ✓" : "Flete agregado ✓");
    closeSheet();
  };

  const del = (field, idx) => {
    const lista = (order[field] || []).filter((_, i) => i !== idx);
    saveAll(field, lista);
    showToast("Eliminado ✓");
  };

  const guardarObservaciones = () => {
    LS.updateDoc("trabajos", order.id, { observacionesProxima: observaciones });
    showToast("Notas guardadas ✓");
  };

  return (
    <div className="min-h-screen bg-zinc-950 pb-40">

      {/* Header */}
      <div className="bg-zinc-900 px-4 pt-5 pb-4 border-b border-white/5">
        <div className="mx-auto max-w-[440px] flex items-center gap-4">
          <button onClick={() => { setServiceToEdit?.(null); setView("detalleOrden"); }}
            className="p-3 bg-zinc-800 rounded-2xl border border-white/5 text-white active:scale-90 transition-all">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-black text-white uppercase leading-tight">Presupuesto</h1>
            <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
              {order.numeroTrabajo || `#${order.id?.slice(-4).toUpperCase()}`} · {bike.patente || ""}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[440px] px-4 pt-5 space-y-4">

        {/* TRABAJOS / MANO DE OBRA */}
        <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-200">🔧 Trabajos / Mano de obra</p>
            <p className="text-sm font-black text-orange-400">{formatMoney(totalMO)}</p>
          </div>

          {tareas.length === 0 ? (
            <p className="text-[10px] text-zinc-600 font-bold text-center py-3">Sin trabajos cargados</p>
          ) : (
            <div>
              {tareas.map((t, i) => (
                <div key={i} className="flex items-start gap-2 py-2.5 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase text-zinc-200 leading-tight truncate">{t.nombre}</p>
                    {t.horasBase > 0 && (
                      <p className="text-[9px] font-bold text-zinc-500 mt-0.5">{t.horasBase}h · {t.dificultad || "normal"}</p>
                    )}
                  </div>
                  <p className="text-xs font-black text-orange-400 shrink-0">{formatMoney(t.monto || 0)}</p>
                  <button onClick={() => setSheet({ tipo: "trabajo", editIdx: i, editData: t })}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 active:text-orange-300 active:scale-90 transition-all shrink-0">
                    <EditIcon />
                  </button>
                  <button onClick={() => del("tareas", i)}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 active:text-red-300 active:scale-90 transition-all shrink-0">
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <AddBtn label="Agregar trabajo" onClick={() => setSheet({ tipo: "trabajo", editIdx: null, editData: null })} />
        </div>

        {/* REPUESTOS */}
        <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-200">📦 Repuestos</p>
            <p className="text-sm font-black text-orange-400">{formatMoney(totalRep)}</p>
          </div>

          {repuestos.length === 0 ? (
            <p className="text-[10px] text-zinc-600 font-bold text-center py-3">Sin repuestos cargados</p>
          ) : (
            <div>
              {repuestos.map((r, i) => (
                <div key={i} className="flex items-start gap-2 py-2.5 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase text-zinc-200 leading-tight truncate">{r.nombre}</p>
                    <p className="text-[9px] font-bold text-zinc-500 mt-0.5">Cant. {r.cantidad || 1} · {formatMoney(r.monto || 0)} c/u</p>
                  </div>
                  <p className="text-xs font-black text-orange-400 shrink-0">{formatMoney((r.monto || 0) * (r.cantidad || 1))}</p>
                  <button onClick={() => setSheet({ tipo: "repuesto", editIdx: i, editData: r })}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 active:text-orange-300 active:scale-90 transition-all shrink-0"><EditIcon /></button>
                  <button onClick={() => del("repuestos", i)}
                    className="p-1.5 rounded-lg bg-zinc-800 text-zinc-400 active:text-red-300 active:scale-90 transition-all shrink-0"><X size={11} /></button>
                </div>
              ))}
            </div>
          )}
          <AddBtn label="Agregar repuesto" onClick={() => setSheet({ tipo: "repuesto", editIdx: null, editData: null })} />
        </div>

        {/* INSUMOS + FLETES (2 columnas) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Insumos */}
          <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-200">Insumos</p>
              <p className="text-xs font-black text-orange-400">{formatMoney(totalIns)}</p>
            </div>
            {insumos.length === 0
              ? <p className="text-[9px] text-zinc-600 font-bold text-center py-2">Sin insumos</p>
              : insumos.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-1 py-1.5 border-b border-white/5 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-black text-zinc-300 truncate leading-tight">{item.nombre}</p>
                    <p className="text-[8px] text-zinc-600">x{item.cantidad || 1}</p>
                  </div>
                  <p className="text-[9px] font-black text-orange-400 shrink-0">{formatMoney((item.monto || 0) * (item.cantidad || 1))}</p>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => setSheet({ tipo: "insumo", editIdx: i, editData: item })} className="p-1 text-zinc-600 active:text-orange-300"><EditIcon /></button>
                    <button onClick={() => del("insumos", i)} className="p-1 text-zinc-600 active:text-red-300"><X size={10} /></button>
                  </div>
                </div>
              ))
            }
            <button onClick={() => setSheet({ tipo: "insumo", editIdx: null, editData: null })}
              className="w-full mt-2 rounded-xl border border-dashed border-zinc-700 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:border-orange-500/40 hover:text-orange-400 active:scale-95 transition-all flex items-center justify-center gap-1">
              <Plus size={10} /> Agregar
            </button>
          </div>

          {/* Fletes */}
          <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-200">Fletes</p>
              <p className="text-xs font-black text-purple-400">{formatMoney(totalFle)}</p>
            </div>
            {fletes.length === 0
              ? <p className="text-[9px] text-zinc-600 font-bold text-center py-2">Sin fletes</p>
              : fletes.map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-1 py-1.5 border-b border-white/5 last:border-0">
                  <p className="flex-1 text-[9px] font-black text-zinc-300 truncate min-w-0 leading-tight">{item.nombre || item.descripcion}</p>
                  <p className="text-[9px] font-black text-purple-400 shrink-0">{formatMoney(item.monto || 0)}</p>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => setSheet({ tipo: "flete", editIdx: i, editData: item })} className="p-1 text-zinc-600 active:text-orange-300"><EditIcon /></button>
                    <button onClick={() => del("fletes", i)} className="p-1 text-zinc-600 active:text-red-300"><X size={10} /></button>
                  </div>
                </div>
              ))
            }
            <button onClick={() => setSheet({ tipo: "flete", editIdx: null, editData: null })}
              className="w-full mt-2 rounded-xl border border-dashed border-zinc-700 py-2 text-[9px] font-black uppercase tracking-widest text-zinc-500 hover:border-orange-500/40 hover:text-orange-400 active:scale-95 transition-all flex items-center justify-center gap-1">
              <Plus size={10} /> Agregar
            </button>
          </div>
        </div>

        {/* NOTAS */}
        <div className="rounded-[2rem] border border-white/10 bg-zinc-900/80 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell size={13} className="text-yellow-500" />
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-200">Notas / próximo service</p>
          </div>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            onBlur={guardarObservaciones}
            rows={2}
            className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-bold text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500 transition-colors resize-none"
            placeholder="Ej: Revisar transmisión en 2000 km, verificar frenos..."
          />
        </div>

        {/* Resumen de totales */}
        {total > 0 && (
          <div className="rounded-[2rem] border border-orange-500/20 bg-orange-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">Total calculado</p>
              <p className="text-xl font-black text-orange-300">{formatMoney(total)}</p>
            </div>
            <div className="border-t border-orange-500/15 pt-2 space-y-1">
              {totalMO  > 0 && <div className="flex justify-between text-[9px] font-bold text-zinc-500"><span>Mano de obra</span><span>{formatMoney(totalMO)}</span></div>}
              {totalRep > 0 && <div className="flex justify-between text-[9px] font-bold text-zinc-500"><span>Repuestos</span><span>{formatMoney(totalRep)}</span></div>}
              {totalIns > 0 && <div className="flex justify-between text-[9px] font-bold text-zinc-500"><span>Insumos</span><span>{formatMoney(totalIns)}</span></div>}
              {totalFle > 0 && <div className="flex justify-between text-[9px] font-bold text-zinc-500"><span>Fletes</span><span>{formatMoney(totalFle)}</span></div>}
            </div>
          </div>
        )}

      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-[64px] left-0 right-0 z-40 px-4">
        <div className="mx-auto max-w-[440px]">
          <div className="rounded-2xl bg-zinc-900 border border-orange-500/25 px-4 py-3 shadow-2xl flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total presupuestado</p>
              <p className="text-xl font-black text-white">{formatMoney(total)}</p>
            </div>
            <button
              onClick={() => { setServiceToEdit?.(null); setView("detalleOrden"); }}
              className="rounded-2xl bg-orange-600 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/30 active:scale-95 transition-all whitespace-nowrap">
              Listo ✓
            </button>
          </div>
        </div>
      </div>

      {/* Sheets */}
      {sheet?.tipo === "trabajo"  && <TrabajoSheet  config={config} bike={bike} bikes={bikes} catalogData={catalogData} orders={orders} editData={sheet.editData} editIdx={sheet.editIdx} onSave={handleSaveTrabajo}  onClose={closeSheet} />}
      {sheet?.tipo === "repuesto" && <RepuestoSheet bike={bike} editData={sheet.editData} editIdx={sheet.editIdx} onSave={handleSaveRepuesto} onClose={closeSheet} />}
      {sheet?.tipo === "insumo"   && <InsumoSheet   bike={bike} editData={sheet.editData} editIdx={sheet.editIdx} onSave={handleSaveInsumo}  onClose={closeSheet} />}
      {sheet?.tipo === "flete"    && <FleteSheet    editData={sheet.editData} editIdx={sheet.editIdx} onSave={handleSaveFlete}   onClose={closeSheet} />}
    </div>
  );
}
