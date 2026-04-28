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
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView(prefill ? "historial" : "home")} className="p-3 bg-zinc-900 rounded-2xl border border-white/5 text-white active:scale-90 transition-all">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
          {prefill ? "Nuevo Service" : "Nuevo Ingreso"}
        </h1>
      </div>
      <div className="bg-[#141414] p-8 rounded-[2.5rem] space-y-4 border border-white/5 shadow-2xl">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Patente</label>
            <input
              disabled={!!prefill}
              className={`w-full border rounded-2xl p-4 font-black uppercase outline-none ${prefill ? "bg-black/30 text-zinc-600 border-white/5" : "bg-zinc-900 text-white border-white/5 focus:border-blue-600"}`}
              value={f.patente}
              onChange={(e) => setF({ ...f, patente: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Km Actual</label>
            <input
              className="w-full border border-white/5 rounded-2xl p-4 font-black text-white outline-none focus:border-blue-600 bg-zinc-900"
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
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Marca</label>
              <input className="w-full border border-white/5 bg-zinc-900 rounded-2xl p-4 font-black text-white outline-none focus:border-blue-600" value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Modelo</label>
              <input className="w-full border border-white/5 bg-zinc-900 rounded-2xl p-4 font-black text-white outline-none focus:border-blue-600" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Cliente</label>
          <input
            disabled={!!prefill}
            className={`w-full border rounded-2xl p-4 font-black outline-none ${prefill ? "bg-black/30 text-zinc-600 border-white/5" : "bg-zinc-900 text-white border-white/5 focus:border-blue-600"}`}
            placeholder="Nombre completo"
            value={f.nombre}
            onChange={(e) => setF({ ...f, nombre: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Teléfono</label>
          <input
            disabled={!!prefill}
            className={`w-full border rounded-2xl p-4 font-black outline-none ${prefill ? "bg-black/30 text-zinc-600 border-white/5" : "bg-zinc-900 text-white border-white/5 focus:border-blue-600"}`}
            placeholder="Ej: 3434123456"
            value={f.tel}
            onChange={(e) => setF({ ...f, tel: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Motivo del Ingreso</label>
          <textarea
            className="w-full border border-white/5 bg-zinc-900 rounded-2xl p-4 font-bold text-white outline-none focus:border-blue-600"
            rows="2"
            value={f.falla}
            onChange={(e) => setF({ ...f, falla: e.target.value })}
            placeholder="¿Qué le pasa hoy?"
          />
        </div>
        <button onClick={() => handleCreateAll(f)} className="w-full bg-blue-600 text-white py-5 rounded-[2.5rem] font-black uppercase shadow-xl shadow-blue-600/20 active:scale-95 transition-all tracking-widest">
          {prefill ? "Abrir Nueva Orden" : "Ingresar al Taller"}
        </button>
      </div>
    </div>
  );
}
