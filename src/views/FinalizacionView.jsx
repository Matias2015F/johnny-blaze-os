import React, { useState, useEffect } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { LS, obtenerOrden, actualizarOrden } from "../lib/storage.js";
import { generarEnlaceMontoFinal } from "../lib/whatsappService.js";
import { formatMoney } from "../utils/format.js";

export default function FinalizacionView({ ordenId, setView }) {
  const [orden, setOrden] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [moto, setMoto] = useState(null);
  const [costosAdicionales, setCostosAdicionales] = useState(0);
  const [motivoAdicional, setMotivoAdicional] = useState("");
  const [whatsappEnviado, setWhatsappEnviado] = useState(false);

  useEffect(() => {
    const o = obtenerOrden(ordenId);
    if (!o) return;
    setOrden(o);
    setCliente(LS.getDoc("clientes", o.clientId) || {});
    setMoto(LS.getDoc("motos", o.bikeId) || {});
    setCostosAdicionales(o.costosAdicionales || 0);
    setMotivoAdicional(o.motivoAdicional || "");
  }, [ordenId]);

  if (!orden) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-slate-500 text-xs font-black uppercase">
        Cargando...
      </div>
    );
  }

  const totalManoObra = (orden.tareas || []).reduce((s, t) => s + (t.monto || 0), 0);
  const totalRepuestos = (orden.repuestos || []).reduce((s, r) => s + (r.monto || 0), 0);
  const totalInsumos = (orden.insumos || []).reduce((s, i) => s + (i.monto || 0), 0);
  const totalFletes = (orden.fletes || []).reduce((s, f) => s + (f.monto || 0), 0);
  const totalMateriales = totalRepuestos + totalInsumos + totalFletes;
  const ganancia = totalManoObra;
  const subtotal = totalManoObra + totalMateriales;
  const costoFinal = subtotal + Number(costosAdicionales || 0);

  const handleEnviarWhatsApp = () => {
    const enlace = generarEnlaceMontoFinal(orden, costoFinal, cliente, moto);
    window.open(enlace, "_blank");
    actualizarOrden(ordenId, {
      whatsappFinalEnviado: true,
      costosAdicionales: Number(costosAdicionales || 0),
      motivoAdicional,
      costoFinal,
    });
    setWhatsappEnviado(true);
  };

  const handleIrAPago = () => {
    actualizarOrden(ordenId, {
      costosAdicionales: Number(costosAdicionales || 0),
      motivoAdicional,
      costoFinal,
      estado: "listo_para_emitir",
    });
    setView("pago");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("ejecucion")}
            className="p-3 rounded-2xl bg-slate-900 border border-white/5 active:scale-95"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {moto?.patente} · {cliente?.nombre}
            </p>
            <h1 className="text-xl font-black text-white">Finalización</h1>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Desglose final</p>
          <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Mano de obra</span>
              <span className="font-black text-white">{formatMoney(totalManoObra)}</span>
            </div>
            {totalMateriales > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Repuestos / Insumos / Fletes</span>
                <span className="font-black text-white">{formatMoney(totalMateriales)}</span>
              </div>
            )}
            {Number(costosAdicionales) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Costos adicionales</span>
                <span className="font-black text-orange-400">{formatMoney(Number(costosAdicionales))}</span>
              </div>
            )}
            <div className="border-t border-slate-700 pt-3 flex justify-between items-center">
              <span className="text-sm font-black text-white">Total a cobrar</span>
              <span className="text-xl font-black text-blue-400">{formatMoney(costoFinal)}</span>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-emerald-500/20 bg-emerald-500/10 p-4 flex justify-between items-center">
            <span className="text-sm font-black text-emerald-400">Tu ganancia</span>
            <span className="text-lg font-black text-emerald-400">{formatMoney(ganancia)}</span>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">Costos adicionales</p>
          <input
            type="number"
            inputMode="numeric"
            className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white outline-none focus:border-blue-600"
            placeholder="0"
            value={costosAdicionales || ""}
            onChange={(e) => setCostosAdicionales(e.target.value)}
          />
          <input
            type="text"
            className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-600"
            placeholder="Motivo (opcional)"
            value={motivoAdicional}
            onChange={(e) => setMotivoAdicional(e.target.value)}
          />
        </div>

        <div className="rounded-[2rem] border border-blue-500/20 bg-blue-600/10 p-6 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-2">Total a cobrar</p>
          <p className="text-5xl font-black text-blue-400">{formatMoney(costoFinal)}</p>
        </div>

        <button
          onClick={handleEnviarWhatsApp}
          disabled={whatsappEnviado}
          className={`w-full flex items-center justify-center gap-2 rounded-[2rem] py-4 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${
            whatsappEnviado
              ? "bg-slate-800 text-slate-500 border border-slate-700"
              : "bg-green-600 text-white"
          }`}
        >
          <Share2 size={16} />
          {whatsappEnviado ? "✓ Enviado por WhatsApp" : "Avisar al cliente por WhatsApp"}
        </button>

        <button
          onClick={handleIrAPago}
          className="w-full rounded-[2rem] bg-blue-600 py-5 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
        >
          Registrar Pago →
        </button>
      </div>
    </div>
  );
}
