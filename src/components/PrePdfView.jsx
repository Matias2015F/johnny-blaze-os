import React, { useState } from "react";
import { ArrowLeft, FileText, AlertCircle } from "lucide-react";
import { LS } from "../lib/storage.js";
import { PLANTILLAS_GARANTIA, CONFIG_DEFAULT } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { trackEvent } from "../lib/telemetry.js";
import { formatMoney } from "../utils/format.js";

export default function PrePdfView({ order, setView, setFinalPdfData }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const [garantia, setGarantia] = useState(order.garantiaFinal || config.garantiaDefault || PLANTILLAS_GARANTIA[0].texto);
  const totalOrden = calcularResultadosOrden(order).total;
  const totalPagado = (order.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
  const saldo = totalOrden - totalPagado;

  const irAlPdf = () => {
    if (saldo > 0) return;
    const numeroComprobante = order.numeroComprobante || `COMP-${String(Date.now()).slice(-8)}`;
    trackEvent("emitir_comprobante", {
      screen: "prePdf",
      entityType: "trabajo",
      entityId: order.id,
      metadata: { numeroComprobante, total: totalOrden },
    }).catch(console.error);
    LS.updateDoc("trabajos", order.id, {
      pdfEntregado: true,
      estado: "cerrado_emitido",
      numeroComprobante,
      fechaComprobante: new Date().toISOString(),
      garantiaFinal: garantia,
      snapshotFinal: {
        tareas: order.tareas || [],
        repuestos: order.repuestos || [],
        insumos: order.insumos || [],
        fletes: order.fletes || [],
        pagos: order.pagos || [],
        total: totalOrden,
      },
    });
    setFinalPdfData({ garantia, numeroComprobante });
    setView("imprimirOrden");
  };

  return (
    <div className="p-6 text-left animate-in fade-in pb-32">
      <button onClick={() => setView("detalleOrden")} className="mb-8 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver al trabajo
      </button>
      <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-6">Antes de emitir: garantía</h2>
      <div className="bg-white p-8 rounded-[2.5rem] space-y-6 shadow-2xl">
        <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-3xl flex items-center gap-3">
          <div className="bg-blue-500 p-2 rounded-xl text-white"><AlertCircle size={20} /></div>
          <p className="text-[10px] font-black text-blue-700 uppercase leading-tight">Al emitir el comprobante, este trabajo se cierra y ya no se puede editar desde la app.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total del trabajo</p>
            <p className="text-xl font-black text-slate-900">{formatMoney(totalOrden)}</p>
          </div>
          <div className={`rounded-2xl p-4 ${saldo <= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${saldo <= 0 ? "text-green-500" : "text-red-500"}`}>Estado de pago</p>
            <p className={`text-xl font-black ${saldo <= 0 ? "text-green-600" : "text-red-600"}`}>{saldo <= 0 ? "Pagado" : formatMoney(saldo)}</p>
          </div>
        </div>

        <div className="bg-slate-50 rounded-3xl p-5 space-y-4">
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Trabajos realizados</p>
            <div className="mt-2 space-y-2">
              {(order.tareas || []).length > 0 ? order.tareas.map((t, i) => (
                <div key={i} className="flex justify-between gap-3 text-sm">
                  <span className="font-black text-slate-800 uppercase">{t.nombre}</span>
                  <span className="font-black text-slate-500">{formatMoney(t.monto || 0)}</span>
                </div>
              )) : <p className="text-[10px] font-bold text-slate-400 uppercase">Sin mano de obra cargada</p>}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Repuestos cambiados</p>
            <div className="mt-2 space-y-2">
              {(order.repuestos || []).length > 0 ? order.repuestos.map((r, i) => (
                <div key={i} className="flex justify-between gap-3 text-sm">
                  <span className="font-black text-slate-800 uppercase">{r.cantidad > 1 ? `${r.cantidad}x ` : ""}{r.nombre}</span>
                  <span className="font-black text-slate-500">{formatMoney((r.monto || 0) * (r.cantidad || 1))}</span>
                </div>
              )) : <p className="text-[10px] font-bold text-slate-400 uppercase">Sin repuestos cargados</p>}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Elegir texto de garantía</label>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
            {PLANTILLAS_GARANTIA.map((p) => (
              <button key={p.id} onClick={() => setGarantia(p.texto)} className="bg-slate-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase whitespace-nowrap active:bg-blue-500 active:text-white transition-colors">
                {p.nombre}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-black uppercase text-slate-400 ml-2 tracking-widest">Texto de garantía (podés editarlo)</label>
          <textarea value={garantia} onChange={(e) => setGarantia(e.target.value)} rows="5" className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-sm text-slate-700 outline-none focus:border-blue-500 mt-2" />
        </div>

        {saldo > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-4">
            <p className="text-[10px] font-black text-red-600 uppercase leading-tight">Para emitir el comprobante primero tenés que dejar el pago completo registrado.</p>
          </div>
        )}

        <button disabled={saldo > 0} onClick={irAlPdf} className={`w-full py-6 rounded-3xl font-black uppercase shadow-xl flex items-center justify-center gap-3 transition-all ${saldo > 0 ? "bg-slate-200 text-slate-400" : "bg-blue-600 text-white active:scale-95"}`}>
          <FileText size={20} /> Generar comprobante para el cliente
        </button>
      </div>
    </div>
  );
}
