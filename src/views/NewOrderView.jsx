import React, { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { LS } from "../lib/storage.js";

export default function NewOrderView({ setView, showToast }) {
  const [formData, setFormData] = useState({ patente: "", modelo: "", problema: "" });

  const handleSave = () => {
    if (!formData.patente || !formData.modelo) return alert("Faltan datos");
    LS.addDoc("motos", { patente: formData.patente, modelo: formData.modelo });
    LS.addDoc("ordenes", {
      ...formData,
      estado: "diagnostico",
      fecha: new Date().toLocaleDateString("es-AR"),
      tareas: [],
    });
    showToast("Ingreso exitoso ✓");
    setView("ordenes");
  };

  return (
    <div className="p-4 space-y-6 pb-28 text-left animate-in slide-in-from-bottom duration-500">
      <div className="flex items-center gap-4 text-left">
        <button onClick={() => setView("home")} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white active:scale-90 transition-all"><ArrowLeft size={20} /></button>
        <h2 className="text-2xl font-black text-white uppercase italic">Nuevo Ingreso</h2>
      </div>
      <div className="bg-[#151515] p-8 rounded-[2.5rem] border border-white/5 space-y-4 shadow-2xl">
        <input
          className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white font-bold uppercase outline-none focus:border-orange-500"
          placeholder="PATENTE"
          value={formData.patente}
          onChange={e => setFormData({ ...formData, patente: e.target.value.toUpperCase() })}
        />
        <input
          className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white font-bold outline-none focus:border-orange-500"
          placeholder="MODELO"
          value={formData.modelo}
          onChange={e => setFormData({ ...formData, modelo: e.target.value })}
        />
        <textarea
          className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white font-bold h-32 outline-none focus:border-orange-500 resize-none"
          placeholder="SÍNTOMA / FALLA"
          value={formData.problema}
          onChange={e => setFormData({ ...formData, problema: e.target.value })}
        />
        <button onClick={handleSave} className="w-full bg-orange-600 text-white p-6 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl">
          <Save size={18} /> Guardar Orden
        </button>
      </div>
    </div>
  );
}
