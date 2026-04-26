import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { LS, useCollection, generateId } from "../lib/storage.js";
import { CONFIG_DEFAULT, SERVICIOS_DEFAULT } from "../lib/constants.js";
import { calcularNuevoTotal } from "../lib/calc.js";
import { formatMoney, parseMonto } from "../utils/format.js";

export default function TaskManagerView({ order, setView, showToast, serviceToEdit, setServiceToEdit }) {
  const catalogData = useCollection("serviciosCatalogo");
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const servicios = [...SERVICIOS_DEFAULT, ...catalogData];

  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: "", horasBase: 1, dificultad: "normal", montoMO: 0, repuestos: [], insumos: [], observacionesProxima: "",
  });

  useEffect(() => {
    if (serviceToEdit) {
      setEditForm({
        nombre: serviceToEdit.nombre,
        horasBase: serviceToEdit.horasBase || 1,
        dificultad: serviceToEdit.dificultad || "normal",
        montoMO: serviceToEdit.monto || 0,
        repuestos: serviceToEdit.repuestos || [],
        insumos: serviceToEdit.insumos || [],
        observacionesProxima: serviceToEdit.observacionesProxima || order.observacionesProxima || "",
      });
    }
  }, [serviceToEdit, order.observacionesProxima]);

  const handleSelect = (id) => {
    setSelectedId(id);
    if (!id) {
      setEditForm({ nombre: "", horasBase: 1, dificultad: "normal", montoMO: config.valorHoraCliente || 15000, repuestos: [], insumos: [], observacionesProxima: "" });
      return;
    }
    const s = servicios.find((x) => x.id === id);
    if (s) {
      const factor = (config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[s.dificultad] || 1;
      setEditForm({ ...JSON.parse(JSON.stringify(s)), montoMO: (config.valorHoraCliente || 15000) * s.horasBase * factor, observacionesProxima: order.observacionesProxima || "" });
    }
  };

  const updateMOParams = (field, val) => {
    const updated = { ...editForm, [field]: val };
    const factor = (config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[updated.dificultad] || 1;
    updated.montoMO = (config.valorHoraCliente || 15000) * updated.horasBase * factor;
    setEditForm(updated);
  };

  const updateListItem = (lista, idx, field, val) => {
    const list = [...editForm[lista]];
    list[idx][field] = ["monto", "cantidad", "montoCosto"].includes(field) ? parseMonto(val) : val;
    setEditForm({ ...editForm, [lista]: list });
  };

  const stats = useMemo(() => {
    const moPrecio = editForm.montoMO;
    const moCosto = editForm.horasBase * (config.valorHoraInterno || 12000);
    const repPrecio = editForm.repuestos.reduce((s, r) => s + (r.monto * (r.cantidad || 1)), 0);
    const repCosto = editForm.repuestos.reduce((s, r) => s + ((r.montoCosto || r.monto) * (r.cantidad || 1)), 0);
    const insumosCosto = editForm.insumos.reduce((s, i) => s + i.monto, 0);
    const totalCobrar = moPrecio + repPrecio;
    const totalCostoInterno = moCosto + repCosto + insumosCosto;
    const margen = totalCobrar - totalCostoInterno;
    const rentabilidad = totalCobrar > 0 ? (margen / totalCobrar) * 100 : 0;
    return { moPrecio, moCosto, repPrecio, insumosCosto, totalCobrar, margen, rentabilidad };
  }, [editForm, config]);

  const aplicar = () => {
    const nombreTarea = editForm.nombre.trim();
    if (!nombreTarea) { showToast("¡Falta el nombre!"); return; }

    const idx = (order.tareas || []).findIndex((t) => t.nombre.trim().toLowerCase() === nombreTarea.toLowerCase());
    let nuevasTareas = [...(order.tareas || [])];
    const datosTarea = { nombre: nombreTarea, monto: parseMonto(editForm.montoMO), horasBase: editForm.horasBase, horasReal: editForm.horasBase };

    if (idx !== -1) { nuevasTareas[idx] = datosTarea; showToast("Precio actualizado ✓"); }
    else { nuevasTareas.push(datosTarea); showToast("Agregado ✓"); }

    const nuevosRepuestos = [...(order.repuestos || []), ...editForm.repuestos];
    const nuevosInsumos = [...(order.insumos || []), ...editForm.insumos];
    const nTotal = calcularNuevoTotal(nuevasTareas, nuevosRepuestos, order.fletes);
    LS.updateDoc("ordenes", order.id, { tareas: nuevasTareas, repuestos: nuevosRepuestos, insumos: nuevosInsumos, total: nTotal, observacionesProxima: editForm.observacionesProxima || order.observacionesProxima });

    const key = nombreTarea.toLowerCase();
    const existente = catalogData.find((s) => s.nombre.trim().toLowerCase() === key);
    const idCat = existente?.id || generateId();
    LS.setDoc("serviciosCatalogo", idCat, { ...editForm, id: idCat, nombre: nombreTarea });

    setServiceToEdit(null);
    setView("detalleOrden");
  };

  return (
    <div className="p-6 text-left animate-in slide-in-from-bottom duration-300 pb-32">
      <button onClick={() => { setServiceToEdit(null); setView("detalleOrden"); }} className="mb-6 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver
      </button>
      <div className="bg-white p-8 rounded-[2.5rem] space-y-5 shadow-2xl">
        <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-2">Editor de Servicio</h2>
        <select value={selectedId || ""} onChange={(e) => handleSelect(e.target.value)} className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black bg-white outline-none">
          <option value="">-- Nuevo Servicio / Manual --</option>
          {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <div className="space-y-1">
          <label className="text-[10px] uppercase text-slate-400 ml-2 font-black tracking-widest">Nombre</label>
          <input value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} placeholder="Ej: Cambio de Cubierta" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-blue-500" />
        </div>
        <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-slate-400 font-bold ml-1 tracking-widest">Horas</label>
              <input type="number" step="0.5" value={editForm.horasBase} onChange={(e) => updateMOParams("horasBase", Number(e.target.value))} className="w-full bg-white border-2 border-slate-100 rounded-xl p-3 font-black text-center" />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] uppercase text-slate-400 font-bold ml-1 tracking-widest">Dificultad</label>
              <select value={editForm.dificultad} onChange={(e) => updateMOParams("dificultad", e.target.value)} className="w-full bg-white border-2 border-slate-100 rounded-xl p-3 font-black text-xs uppercase">
                <option value="facil">Fácil</option><option value="normal">Normal</option><option value="dificil">Difícil</option><option value="complicado">Complicado</option>
              </select>
            </div>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 font-black text-lg">$</span>
            <input type="text" value={editForm.montoMO > 0 ? editForm.montoMO.toLocaleString("es-AR") : ""} onChange={(e) => setEditForm({ ...editForm, montoMO: parseMonto(e.target.value) })} placeholder="0" className="w-full pl-10 pr-4 py-4 bg-white border-2 border-blue-200 rounded-2xl text-2xl font-black text-slate-800 outline-none focus:border-blue-500" />
            <label className="absolute -top-2.5 left-4 bg-white px-2 text-[8px] font-black uppercase text-blue-500 tracking-widest">Mano de Obra Cliente</label>
          </div>
          <p className="text-[10px] text-slate-400 text-center tracking-wide">
            {editForm.horasBase}h &times; {(config.valorHoraCliente || 15000).toLocaleString("es-AR")}/h &times; {((config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[editForm.dificultad] || 1).toFixed(1)} ({editForm.dificultad})
          </p>
        </div>

        {["repuestos", "insumos"].map((lista) => (
          <div key={lista} className="space-y-3">
            <div className="flex justify-between items-center px-2">
              <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{lista === "repuestos" ? "Repuestos" : "Insumos / Terceros"}</h3>
              <button onClick={() => setEditForm({ ...editForm, [lista]: [...editForm[lista], { nombre: "Nuevo", monto: 0, cantidad: 1 }] })} className={`p-2 rounded-xl ${lista === "repuestos" ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-600"}`}><Plus size={20} /></button>
            </div>
            {editForm[lista].map((item, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                <input className="flex-1 border-none bg-transparent text-xs font-black uppercase text-slate-700 outline-none" placeholder="Nombre..." value={item.nombre} onChange={(e) => updateListItem(lista, idx, "nombre", e.target.value)} />
                <div className="flex items-center gap-1 border-l border-slate-100 pl-2">
                  <span className="text-[10px] font-black text-slate-300">$</span>
                  <input type="text" className={`w-20 text-xs text-right font-black outline-none bg-transparent ${lista === "repuestos" ? "text-blue-600" : "text-red-600"}`} value={item.monto > 0 ? item.monto.toLocaleString("es-AR") : ""} onChange={(e) => updateListItem(lista, idx, "monto", e.target.value)} placeholder="0" />
                </div>
                <button onClick={() => setEditForm({ ...editForm, [lista]: editForm[lista].filter((_, i) => i !== idx) })} className="p-1 text-slate-300"><X size={16} /></button>
              </div>
            ))}
          </div>
        ))}

        <div className="space-y-1">
          <label className="text-[10px] uppercase text-slate-400 ml-2 font-black tracking-widest">Obs. Próxima Visita</label>
          <textarea value={editForm.observacionesProxima} onChange={(e) => setEditForm({ ...editForm, observacionesProxima: e.target.value })} rows="2" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm outline-none focus:border-blue-500" placeholder="Ej: Revisar transmisión en 2000km..." />
        </div>

        <div className="bg-slate-900 p-6 rounded-[2.5rem] space-y-4 text-white shadow-2xl">
          <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-black uppercase">
            <div className="border-r border-white/10 px-1"><p className="text-white/30 mb-1">Mano Obra</p><p>{formatMoney(stats.moPrecio)}</p></div>
            <div className="border-r border-white/10 px-1"><p className="text-white/30 mb-1">Repuestos</p><p className="text-blue-400">{formatMoney(stats.repPrecio)}</p></div>
            <div className="px-1"><p className="text-white/30 mb-1">Costos Int.</p><p className="text-red-400">{formatMoney(stats.insumosCosto + stats.moCosto)}</p></div>
          </div>
          <div className="pt-4 border-t border-white/10 flex justify-between items-end">
            <div className="text-left">
              <p className="text-[8px] font-black uppercase text-white/40 mb-1 tracking-widest">Margen Estimado</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-2xl font-black tracking-tighter ${stats.rentabilidad < 20 ? "text-red-500" : "text-green-500"}`}>{formatMoney(stats.margen)}</p>
                <span className={`text-xs font-bold ${stats.rentabilidad < 20 ? "text-red-500" : "text-blue-400"}`}>{Math.round(stats.rentabilidad)}%</span>
              </div>
            </div>
            <button onClick={aplicar} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Confirmar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
