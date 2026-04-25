import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";

export default function NewOrderView({ handleCreateAll, setView, prefill }) {
  const [f, setF] = useState({
    nombre: prefill?.client?.nombre || "",
    tel: prefill?.client?.tel || "",
    patente: prefill?.bike?.patente || "",
    marca: prefill?.bike?.marca || "",
    modelo: prefill?.bike?.modelo || "",
    cilindrada: prefill?.bike?.cilindrada || 110,
    km: prefill?.bike?.km || "",
    falla: "",
  });

  return (
    <div className="p-6 text-left animate-in slide-in-from-bottom duration-300">
      <button onClick={() => setView(prefill ? "historial" : "home")} className="mb-8 text-orange-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver
      </button>
      <h1 className="text-4xl font-black text-white tracking-tighter mb-8 uppercase">
        {prefill ? "Nuevo Service" : "Nuevo Ingreso"}
      </h1>
      <div className="bg-white p-8 rounded-[2.5rem] space-y-4 shadow-2xl">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Patente</label>
            <input
              disabled={!!prefill}
              className={`w-full border-2 rounded-xl p-3 font-black uppercase text-black outline-none ${prefill ? "bg-slate-50 text-slate-400 border-slate-200" : "border-slate-200 focus:border-orange-500"}`}
              value={f.patente}
              onChange={(e) => setF({ ...f, patente: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Km Actual</label>
            <input
              className="w-full border-2 border-orange-200 rounded-xl p-3 font-black text-black outline-none focus:border-orange-500 bg-orange-50/30"
              type="number"
              value={f.km}
              onChange={(e) => setF({ ...f, km: e.target.value })}
              placeholder="Ej: 15400"
            />
          </div>
        </div>
        {!prefill && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Marca</label>
              <input className="w-full border-2 border-slate-200 rounded-xl p-3 font-black text-black outline-none focus:border-orange-500" value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Modelo</label>
              <input className="w-full border-2 border-slate-200 rounded-xl p-3 font-black text-black outline-none focus:border-orange-500" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cliente</label>
          <input
            disabled={!!prefill}
            className={`w-full border-2 rounded-xl p-3 font-black text-black outline-none ${prefill ? "bg-slate-50 text-slate-400 border-slate-200" : "border-slate-200 focus:border-orange-500"}`}
            placeholder="Nombre completo"
            value={f.nombre}
            onChange={(e) => setF({ ...f, nombre: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Teléfono</label>
          <input
            disabled={!!prefill}
            className={`w-full border-2 rounded-xl p-3 font-black text-black outline-none ${prefill ? "bg-slate-50 text-slate-400 border-slate-200" : "border-slate-200 focus:border-orange-500"}`}
            placeholder="Ej: 3434123456"
            value={f.tel}
            onChange={(e) => setF({ ...f, tel: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Motivo del Ingreso</label>
          <textarea
            className="w-full border-2 border-slate-200 rounded-xl p-3 font-bold text-black outline-none focus:border-orange-500"
            rows="2"
            value={f.falla}
            onChange={(e) => setF({ ...f, falla: e.target.value })}
            placeholder="¿Qué le pasa hoy?"
          />
        </div>
        <button onClick={() => handleCreateAll(f)} className="w-full bg-orange-600 text-white py-5 rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all">
          {prefill ? "Abrir Nueva Orden" : "Ingresar al Taller"}
        </button>
      </div>
    </div>
  );
}
