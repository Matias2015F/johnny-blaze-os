import React, { useState } from "react";
import { AlertCircle, ArrowLeft, FileText } from "lucide-react";
import { LS, crearSnapshotVerificable, generarNumeroComprobante } from "../lib/storage.js";
import { CONFIG_DEFAULT, PLANTILLAS_GARANTIA, TEXTO_CIERRE_RECHAZO } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { trackEvent } from "../lib/telemetry.js";
import { formatMoney } from "../utils/format.js";

function calcularVencimiento(dias) {
  if (Number(dias) <= 0) return "";
  const d = new Date();
  d.setDate(d.getDate() + Number(dias));
  return d.toLocaleDateString("sv-SE");
}

export default function PrePdfView({ order, setView, setFinalPdfData }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const esRechazo = order.cierreTipo === "rechazo_cliente";
  const [garantia, setGarantia] = useState(
    order.garantiaFinal || (esRechazo ? TEXTO_CIERRE_RECHAZO : config.garantiaDefault || PLANTILLAS_GARANTIA[0].texto)
  );
  const [vencimientoGarantia, setVencimientoGarantia] = useState(
    esRechazo ? "" : order.vencimientoGarantia || calcularVencimiento(config.garantiaDias)
  );
  const [diasPersonalizados, setDiasPersonalizados] = useState("");

  const totalOrden = calcularResultadosOrden(order).total;
  const totalPagado = (order.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
  const saldo = totalOrden - totalPagado;

  const irAlPdf = () => {
    if (saldo > 0) return;

    const numeroComprobante = generarNumeroComprobante(order.id);
    const cliente = LS.getDoc("clientes", order.clientId);
    const moto = LS.getDoc("motos", order.bikeId);
    const garantiaFinal = esRechazo ? (garantia || TEXTO_CIERRE_RECHAZO) : garantia;
    const vencimientoFinal = esRechazo ? "" : vencimientoGarantia;
    const orderParaSnapshot = {
      ...order,
      estado: "cerrado_emitido",
      total: totalOrden,
      garantiaFinal,
      vencimientoGarantia: vencimientoFinal,
    };
    const snapshotFinal = crearSnapshotVerificable(orderParaSnapshot, numeroComprobante, cliente, moto);

    trackEvent("emitir_comprobante", {
      screen: "prePdf",
      entityType: "trabajo",
      entityId: order.id,
      metadata: { numeroComprobante, total: totalOrden, hashVerificacion: snapshotFinal.hash },
    }).catch(console.error);

    LS.updateDoc("trabajos", order.id, {
      pdfEntregado: true,
      estado: "cerrado_emitido",
      numeroComprobante,
      fechaComprobante: new Date().toISOString(),
      garantiaFinal,
      vencimientoGarantia: vencimientoFinal,
      snapshotFinal,
      aprobacionCliente: {
        fecha: new Date().toISOString(),
        metodo: order.aprobadoPor || "manual",
        comprobante: numeroComprobante,
      },
    });

    setFinalPdfData({
      garantia: garantiaFinal,
      vencimientoGarantia: vencimientoFinal,
      numeroComprobante,
      tipoCierre: esRechazo ? "rechazo_cliente" : "",
      qrData: {
        numeroComprobante,
        orderId: order.id,
        hash: snapshotFinal.hash,
        fecha: snapshotFinal.fechaComprobante,
      },
    });
    setView("imprimirOrden");
  };

  return (
    <div className="p-6 text-left animate-in fade-in pb-32">
      <button onClick={() => setView("detalleOrden")} className="mb-8 flex items-center gap-2 text-xs font-black uppercase text-orange-500 transition-all active:scale-90">
        <ArrowLeft size={16} /> Volver al trabajo
      </button>
      <h2 className="mb-6 text-3xl font-black uppercase tracking-tighter text-white">
        {esRechazo ? "Antes de emitir: cierre sin garantia" : "Antes de emitir: garantía"}
      </h2>

      <div className="space-y-6 rounded-[2.5rem] bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-center gap-3 rounded-3xl border-2 border-orange-200 bg-orange-50 p-4">
          <div className="rounded-xl bg-orange-500 p-2 text-white"><AlertCircle size={20} /></div>
          <p className="text-[10px] font-black uppercase leading-tight text-orange-700">
            {esRechazo
              ? "Al emitir el comprobante, el presupuesto queda cerrado como rechazado o pospuesto y sin garantia."
              : "Al emitir el comprobante, este trabajo se cierra y ya no se puede editar desde la app."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-zinc-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
              {esRechazo ? "Total real cobrado" : "Total del trabajo"}
            </p>
            <p className="text-xl font-black text-zinc-900">{formatMoney(totalOrden)}</p>
          </div>
          <div className={`rounded-2xl p-4 ${saldo <= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <p className={`text-[9px] font-black uppercase tracking-widest ${saldo <= 0 ? "text-green-500" : "text-red-500"}`}>Estado de pago</p>
            <p className={`text-xl font-black ${saldo <= 0 ? "text-green-600" : "text-red-600"}`}>{saldo <= 0 ? "Pagado" : formatMoney(saldo)}</p>
          </div>
        </div>

        {esRechazo ? (
          <div className="space-y-3 rounded-3xl bg-zinc-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Detalle del cierre</p>
            <div className="rounded-2xl border border-zinc-100 bg-white px-4 py-3">
              <p className="text-sm font-black uppercase text-zinc-800">Diagnostico / revision facturable</p>
              <p className="mt-1 text-[10px] font-bold text-zinc-500">
                Presupuesto original no aprobado: {formatMoney(order.presupuestoOriginalTotal || order.cierreRechazo?.presupuestoOriginalTotal || 0)}
              </p>
            </div>
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Sin garantia</p>
              <p className="mt-1 text-[11px] font-bold leading-relaxed text-red-700">
                No se realizaron los trabajos presupuestados ni se cambiaron repuestos.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-5 rounded-3xl bg-zinc-50 p-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Trabajos realizados</p>
              <div className="mt-2 space-y-2">
                {(order.tareas || []).length > 0 ? order.tareas.map((t, i) => (
                  <div key={i} className="rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm">
                    <span className="font-black uppercase text-zinc-800">{t.nombre}</span>
                  </div>
                )) : <p className="text-[10px] font-bold uppercase text-zinc-400">Sin mano de obra cargada</p>}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Repuestos cambiados</p>
              <div className="mt-2 space-y-2">
                {(order.repuestos || []).length > 0 ? order.repuestos.map((r, i) => (
                  <div key={i} className="rounded-2xl border border-zinc-100 bg-white px-4 py-3 text-sm">
                    <span className="font-black uppercase text-zinc-800">{r.cantidad > 1 ? `${r.cantidad}x ` : ""}{r.nombre}</span>
                  </div>
                )) : <p className="text-[10px] font-bold uppercase text-zinc-400">Sin repuestos cargados</p>}
              </div>
            </div>
          </div>
        )}

        {!esRechazo && (
        <div>
          <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">Elegir texto de garantía</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {PLANTILLAS_GARANTIA.map((p) => (
              <button key={p.id} onClick={() => setGarantia(p.texto)} className="rounded-xl bg-zinc-100 px-4 py-2 text-[10px] font-black uppercase transition-colors active:bg-orange-500 active:text-white">
                {p.nombre}
              </button>
            ))}
          </div>
        </div>
        )}

        <div>
          <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {esRechazo ? "Observacion del cierre (editable)" : "Texto de garantía (podés editarlo)"}
          </label>
          <textarea
            value={garantia}
            onChange={(e) => setGarantia(e.target.value)}
            rows="5"
            className="mt-2 w-full rounded-2xl border-2 border-zinc-100 p-4 text-sm font-bold text-zinc-700 outline-none focus:border-orange-500"
          />
        </div>

        {!esRechazo && (
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4">
          <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Término de garantía</label>
          <p className="mt-1 text-[10px] font-bold text-zinc-500">
            Podés dejarla en cero, elegir un período rápido o cargar una fecha manual.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={vencimientoGarantia}
              onChange={(e) => setVencimientoGarantia(e.target.value)}
              className="rounded-2xl border-2 border-zinc-100 bg-white px-4 py-3 text-sm font-black text-zinc-700 outline-none focus:border-orange-500"
            />
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "0d", dias: 0 },
                { label: "7d", dias: 7 },
                { label: "30d", dias: 30 },
                { label: "90d", dias: 90 },
                { label: "180d", dias: 180 },
              ].map(({ label, dias }) => (
                <button
                  key={dias}
                  onClick={() => setVencimientoGarantia(calcularVencimiento(dias))}
                  className="rounded-xl bg-white px-2 py-2 text-[10px] font-black uppercase text-zinc-600 transition-colors active:bg-orange-500 active:text-white"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              value={diasPersonalizados}
              onChange={(e) => setDiasPersonalizados(e.target.value)}
              placeholder="Días personalizados"
              className="rounded-2xl border-2 border-zinc-100 bg-white px-4 py-3 text-sm font-black text-zinc-700 outline-none focus:border-orange-500"
            />
            <button
              type="button"
              onClick={() => setVencimientoGarantia(calcularVencimiento(diasPersonalizados))}
              className="rounded-2xl bg-zinc-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95"
            >
              Aplicar
            </button>
          </div>
          <p className="mt-2 text-[10px] font-bold text-zinc-400">
            {vencimientoGarantia ? "Esta fecha aparece en el comprobante entregado al cliente." : "Sin fecha de vencimiento de garantía."}
          </p>
        </div>
        )}

        {saldo > 0 && (
          <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-4">
            <p className="text-[10px] font-black uppercase leading-tight text-red-600">
              Para emitir el comprobante primero tenés que dejar el pago completo registrado.
            </p>
          </div>
        )}

        <button disabled={saldo > 0} onClick={irAlPdf} className={`flex w-full items-center justify-center gap-3 rounded-3xl py-6 font-black uppercase shadow-xl transition-all ${saldo > 0 ? "bg-zinc-200 text-zinc-400" : "bg-orange-600 text-white active:scale-95"}`}>
          <FileText size={20} /> {esRechazo ? "Generar comprobante sin garantia" : "Generar comprobante para el cliente"}
        </button>
      </div>
    </div>
  );
}
