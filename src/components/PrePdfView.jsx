import React, { useState } from "react";
import { ArrowLeft, FileText, AlertCircle } from "lucide-react";
import { LS } from "../lib/storage.js";
import { PLANTILLAS_GARANTIA, CONFIG_DEFAULT } from "../lib/constants.js";

export default function PrePdfView({ order, setView, setFinalPdfData }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const [garantia, setGarantia] = useState(config.garantiaDefault || PLANTILLAS_GARANTIA[0].texto);

  const irAlPdf = () => {
    LS.updateDoc("ordenes", order.id, { pdfEntregado: true });
    setFinalPdfData({ garantia });
    setView("imprimirOrden");
  };

  return (
    <div className="p-6 text-left animate-in fade-in pb-32">
      <button onClick={() => setView("detalleOrden")} className="mb-8 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Cancelar
      </button>
      <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-6">Último Paso: Garantía</h2>
      <div className="bg-white p-8 rounded-[2.5rem] space-y-6 shadow-2xl">
        <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-3xl flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-xl text-white"><AlertCircle size={20} /></div>
          <p className="text-[10px] font-black text-blue-700 uppercase leading-tight">Al generar este PDF, la orden se BLOQUEARÁ para evitar cambios de último momento.</p>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Seleccionar Plantilla</label>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
            {PLANTILLAS_GARANTIA.map((p) => (
              <button key={p.id} onClick={() => setGarantia(p.texto)} className="bg-slate-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap active:bg-blue-500 active:text-white transition-colors">
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Texto de la Garantía (Editable)</label>
          <textarea value={garantia} onChange={(e) => setGarantia(e.target.value)} rows="5" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 mt-2" />
        </div>
        <button onClick={irAlPdf} className="w-full bg-blue-600 text-white py-6 rounded-3xl font-black uppercase shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
          <FileText size={20} /> Generar PDF Final
        </button>
      </div>
    </div>
  );
}
