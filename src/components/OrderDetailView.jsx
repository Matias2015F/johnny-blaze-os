import React, { useState } from "react";
import { ArrowLeft, Plus, Check, ShieldCheck } from "lucide-react";
import { LS } from "../lib/storage.js";
import { formatMoney, formatMoneyInput, parseMonto } from "../utils/format.js";

export default function OrderDetailView({ order, setView, showToast, configGlobal }) {
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [tiempoTarea, setTiempoTarea] = useState("");
  const [costoRepuestos, setCostoRepuestos] = useState("");

  const tareas = order.tareas || [];

  const totalCostos = configGlobal?.gastos?.reduce((acc, g) => acc + (Number(g.monto) || 0), 0) || 0;
  const ganancia = Number(configGlobal?.objetivos?.gananciaDeseada) || 0;
  const horasCapacidad = Number(configGlobal?.objetivos?.horasMes) || 1;
  const valorHoraTaller = (totalCostos + ganancia) / horasCapacidad;

  const addTarea = () => {
    if (!nuevaTarea) return;
    const hs = Number(tiempoTarea.replace(",", ".")) || 0;
    const rep = parseMonto(costoRepuestos) || 0;
    const subtotalManoObra = hs * valorHoraTaller;

    const actualizadas = [
      ...tareas,
      { id: Date.now(), texto: nuevaTarea, horas: hs, repuestos: rep, total: subtotalManoObra + rep, check: false },
    ];

    LS.updateDoc("ordenes", order.id, { tareas: actualizadas });
    setNuevaTarea("");
    setTiempoTarea("");
    setCostoRepuestos("");
    showToast("Tarea añadida");
  };

  const toggleTarea = (id) => {
    const actualizadas = tareas.map(t => t.id === id ? { ...t, check: !t.check } : t);
    LS.updateDoc("ordenes", order.id, { tareas: actualizadas });
  };

  const cambiarEstado = (nuevo) => {
    LS.updateDoc("ordenes", order.id, { estado: nuevo });
    showToast(`Estado: ${nuevo}`);
    if (nuevo === "entregada") setView("ordenes");
  };

  const totalOrden = tareas.reduce((acc, t) => acc + (t.total || 0), 0);

  return (
    <div className="p-4 space-y-6 pb-28 text-left animate-in slide-in-from-right duration-500">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setView("ordenes")} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white active:scale-95"><ArrowLeft size={20} /></button>
        <div className="text-right">
          <p className="text-2xl font-black text-white uppercase italic leading-none text-right">{order.patente}</p>
          <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest text-right">{order.modelo}</p>
        </div>
      </div>

      <div className="bg-green-600 p-8 rounded-[2.5rem] shadow-xl text-white text-left">
        <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1 leading-none text-left">Presupuesto Acumulado</p>
        <h2 className="text-5xl font-black tracking-tighter text-left">{formatMoney(totalOrden)}</h2>
      </div>

      <div className="bg-[#151515] p-8 rounded-[2.5rem] border border-white/5 space-y-6 shadow-2xl">
        <div className="grid grid-cols-3 gap-2 text-left">
          {['diagnostico', 'reparacion', 'lista'].map(e => (
            <button key={e} onClick={() => cambiarEstado(e)} className={`p-3 rounded-xl text-[8px] font-black uppercase transition-all ${order.estado === e ? 'bg-orange-600 text-white shadow-lg' : 'bg-black text-slate-500 border border-white/10'}`}>
              {e}
            </button>
          ))}
        </div>

        <div className="space-y-3 pt-4 border-t border-white/5 text-left">
          <input className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white text-sm outline-none" placeholder="Tarea..." value={nuevaTarea} onChange={e => setNuevaTarea(e.target.value)} />
          <div className="flex gap-2">
            <input className="flex-1 bg-black border border-white/10 p-4 rounded-2xl text-white text-sm outline-none font-bold" placeholder="Horas" inputMode="decimal" value={tiempoTarea} onChange={e => setTiempoTarea(e.target.value)} />
            <input className="flex-1 bg-black border border-white/10 p-4 rounded-2xl text-white text-sm outline-none font-bold" placeholder="Repuestos $" inputMode="numeric" value={formatMoneyInput(costoRepuestos)} onChange={e => setCostoRepuestos(e.target.value)} />
            <button onClick={addTarea} className="p-4 bg-orange-600 rounded-2xl text-white active:scale-90"><Plus size={24} /></button>
          </div>
        </div>

        <div className="space-y-2">
          {tareas.map(t => (
            <div key={t.id} onClick={() => toggleTarea(t.id)} className={`p-4 rounded-2xl border transition-all text-left ${t.check ? 'bg-green-900/10 border-green-500/30' : 'bg-black border-white/10'}`}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className={`p-1 rounded-md ${t.check ? 'bg-green-500 text-black' : 'border border-white/20 text-transparent'}`}><Check size={12} /></div>
                  <p className={`text-sm font-bold ${t.check ? 'text-green-500 line-through' : 'text-white'}`}>{t.texto}</p>
                </div>
                <p className="text-xs font-black text-white/40">{formatMoney(t.total)}</p>
              </div>
              <div className="ml-8 mt-1 text-[9px] text-slate-500 uppercase font-bold text-left italic">
                {t.horas} hs mano de obra + {formatMoney(t.repuestos)} repuestos
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => cambiarEstado('entregada')} className="w-full bg-green-600 text-white p-6 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 active:scale-95 shadow-lg">
          <ShieldCheck size={20} /> Entregar y Finalizar
        </button>
      </div>
    </div>
  );
}
