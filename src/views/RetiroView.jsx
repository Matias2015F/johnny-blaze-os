import React from "react";
import { ArrowLeft, Download, Share2 } from "lucide-react";
import { formatMoney } from "../utils/format.js";
import { abrirWhatsApp, mensajeComprobanteVerificable } from "../lib/messages.js";
import { useRetiroView } from "../hooks/useRetiroView.js";

export default function RetiroView({ ordenId, setView, setSelectedOrderId }) {
  const {
    isLoading,
    contexto,
    resumen,
    garantia,        setGarantia,
    editGarantia,    setEditGarantia,
    retirado,
    ordenEstado,
    receiptToken,
    clienteTelefono,
    registrarRetiro,
    clienteRetira,
    guardarGarantia,
  } = useRetiroView({ ordenId });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-zinc-500 text-xs font-black uppercase">
        Cargando...
      </div>
    );
  }

  // Handlers de navegacion — llaman acciones del hook y luego redirigen
  const handleVerPDF = async () => {
    await registrarRetiro();
    setView("prePdf");
  };

  const handleAbrirParaEnviar = async () => {
    const next = await registrarRetiro();
    setSelectedOrderId?.(next?.id || ordenId);
    const token = next?.receiptToken || receiptToken;
    if (token) {
      abrirWhatsApp(clienteTelefono, mensajeComprobanteVerificable({
        clienteNombre: contexto.clienteNombre || "cliente",
        verifyUrl: `https://app.motogestion.ar/verificar/${token}`,
        nombreTaller: "MotoGestion",
        documentType: "comprobante_garantia",
      }));
    }
    setView("imprimirOrden");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("pago")}
            className="p-3 rounded-2xl bg-zinc-900 border border-white/5 active:scale-95"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {contexto.patente} · {contexto.clienteNombre}
            </p>
            <h1 className="text-xl font-black text-white">Retiro</h1>
          </div>
        </div>

        <div className="text-center space-y-3 py-4">
          <div className="text-6xl">OK</div>
          <h2 className="text-2xl font-black text-white">Trabajo completado y pagado</h2>
          <p className="text-zinc-400 text-sm">{contexto.clienteNombre}</p>
        </div>

        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-5 space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Resumen</p>
          <div className="flex justify-between">
            <span className="text-sm text-zinc-400">Fecha</span>
            <span className="font-black text-white">{resumen.fecha}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-zinc-400">Total pagado</span>
            <span className="font-black text-emerald-400">{formatMoney(resumen.totalPagado)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-zinc-400">Tu ganancia</span>
            <span className="font-black text-emerald-400">{formatMoney(resumen.gananciaTaller)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-zinc-400">Moto</span>
            <span className="font-black text-white">{resumen.marca} {resumen.modelo}</span>
          </div>
        </div>

        <div className="rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Garantia</p>
            <button
              type="button"
              onClick={() => setEditGarantia((v) => !v)}
              className="rounded-xl bg-zinc-900/60 border border-white/10 px-3 py-2 text-[9px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
            >
              {editGarantia ? "Cerrar" : "Editar"}
            </button>
          </div>

          {!editGarantia ? (
            <p className="text-sm font-bold text-zinc-200 whitespace-pre-wrap">
              {garantia?.trim() || "Sin texto de garantia cargado."}
            </p>
          ) : (
            <div className="space-y-2">
              <textarea
                value={garantia}
                onChange={(e) => setGarantia(e.target.value)}
                rows={6}
                className="w-full rounded-2xl border border-white/10 bg-zinc-950/60 p-4 text-sm font-bold text-white outline-none focus:border-orange-500"
                placeholder="Escribi condiciones de garantia / cierre..."
              />
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-200/70">
                Nota: si el comprobante ya fue emitido, este cambio no modifica el PDF entregado.
              </p>
              <button
                type="button"
                onClick={guardarGarantia}
                className="w-full rounded-2xl bg-orange-600 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
              >
                Guardar garantia
              </button>
            </div>
          )}
        </div>

        {!retirado && (
          <button
            onClick={clienteRetira}
            className="w-full rounded-[2rem] bg-emerald-600 py-5 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
          >
            Cliente retiro el vehiculo
          </button>
        )}

        {retirado && (
          <div className="rounded-[1.75rem] border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <p className="text-sm font-black text-emerald-400">Retiro registrado</p>
          </div>
        )}

        {ordenEstado !== "cerrado_emitido" && (
          <div className="rounded-[1.75rem] border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Comprobante listo</p>
            <p className="text-xs text-zinc-400 mt-1">
              Al descargar o enviar, se registra el retiro y se habilita el comprobante final.
            </p>
          </div>
        )}

        <button
          onClick={handleVerPDF}
          className="w-full flex items-center justify-center gap-2 rounded-[2rem] border border-zinc-700 bg-zinc-900 py-4 text-[11px] font-black uppercase tracking-widest text-zinc-300 active:scale-95 transition-all"
        >
          <Download size={16} />
          Descargar orden (PDF)
        </button>

        <button
          onClick={handleAbrirParaEnviar}
          className="w-full flex items-center justify-center gap-2 rounded-[2rem] bg-emerald-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
        >
          <Share2 size={16} />
          Abrir / enviar comprobante (WhatsApp)
        </button>

        <button
          onClick={() => setView("home")}
          className="w-full rounded-[2rem] bg-orange-600 py-5 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
        >
          Volver a inicio
        </button>
      </div>
    </div>
  );
}
