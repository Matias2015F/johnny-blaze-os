import React, { useState, useEffect } from "react";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { LS, obtenerOrden, actualizarOrden } from "../lib/storage.js";
import { formatMoney } from "../utils/format.js";

export default function RetiroView({ ordenId, setView, setSelectedOrderId }) {
  const [orden, setOrden] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [moto, setMoto] = useState(null);
  const [retirado, setRetirado] = useState(false);

  useEffect(() => {
    const o = obtenerOrden(ordenId);
    if (!o) return;
    setOrden(o);
    setCliente(LS.getDoc("clientes", o.clientId) || {});
    setMoto(LS.getDoc("motos", o.bikeId) || {});
  }, [ordenId]);

  if (!orden) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-slate-500 text-xs font-black uppercase">
        Cargando...
      </div>
    );
  }

  const totalPagado = (orden.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
  const totalManoObra = (orden.tareas || []).reduce((s, t) => s + (t.monto || 0), 0);
  const fecha = new Date(orden.finalizacion_fecha || orden.updatedAt || Date.now()).toLocaleDateString("es-AR");

  const handleClienteRetira = () => {
    actualizarOrden(ordenId, { retiro_fecha: Date.now() });
    setRetirado(true);
  };

  const handleVerPDF = () => {
    setView("prePdf");
  };

  const handleVolverHome = () => {
    setView("home");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("pago")}
            className="p-3 rounded-2xl bg-slate-900 border border-white/5 active:scale-95"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {moto?.patente} · {cliente?.nombre}
            </p>
            <h1 className="text-xl font-black text-white">Retiro</h1>
          </div>
        </div>

        <div className="text-center space-y-3 py-4">
          <div className="text-6xl">✅</div>
          <h2 className="text-2xl font-black text-white">Trabajo completado y pagado</h2>
          <p className="text-slate-400 text-sm">{cliente?.nombre}</p>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Resumen</p>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">Fecha</span>
            <span className="font-black text-white">{fecha}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">Total pagado</span>
            <span className="font-black text-emerald-400">{formatMoney(totalPagado)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">Tu ganancia</span>
            <span className="font-black text-emerald-400">{formatMoney(orden.ganancia || totalManoObra)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-400">Moto</span>
            <span className="font-black text-white">{moto?.marca} {moto?.modelo}</span>
          </div>
        </div>

        <div className="rounded-[2rem] border border-blue-500/20 bg-blue-500/10 p-5 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Garantía</p>
          <ul className="space-y-2 text-sm text-slate-300">
            <li>✓ 15 días en mano de obra</li>
            <li>✓ Repuestos con garantía de fábrica</li>
            <li>✓ Presentar este comprobante para reclamar</li>
          </ul>
        </div>

        {!retirado && (
          <button
            onClick={handleClienteRetira}
            className="w-full rounded-[2rem] bg-emerald-600 py-5 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
          >
            ✓ Cliente Retiró el Vehículo
          </button>
        )}

        {retirado && (
          <div className="rounded-[1.75rem] border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <p className="text-sm font-black text-emerald-400">✓ Retiro registrado</p>
          </div>
        )}

        <button
          onClick={handleVerPDF}
          className="w-full flex items-center justify-center gap-2 rounded-[2rem] border border-slate-700 bg-slate-900 py-4 text-[11px] font-black uppercase tracking-widest text-slate-300 active:scale-95 transition-all"
        >
          <Download size={16} />
          Descargar Orden (PDF)
        </button>

        <button
          onClick={handleVolverHome}
          className="w-full rounded-[2rem] bg-blue-600 py-5 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
        >
          ← Volver a Inicio
        </button>
      </div>
    </div>
  );
}
