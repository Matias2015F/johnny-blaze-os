import React, { useState } from "react";
import { AlertCircle, ArrowLeft, FileText } from "lucide-react";
import { LS, crearSnapshotVerificable, crearRecordatorioDeOrden, generarNumeroComprobante } from "../lib/storage.js";
import { CONFIG_DEFAULT, PLANTILLAS_GARANTIA, TEXTO_CIERRE_RECHAZO } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { trackEvent } from "../lib/telemetry.js";
import { formatMoney } from "../utils/format.js";
import { generateReceiptToken, crearPublicReceipt } from "../services/receiptVerificationService.js";
import { logAction } from "../services/auditService.js";
import { mensajeComprobanteVerificable, mensajeSolicitudCalificacion, normalizarTelWA } from "../lib/messages.js";

const LABELS_GARANTIA = {
  observacionesTecnicas:      "Observaciones técnicas",
  limitesGarantia:            "Límites de garantía",
  responsabilidadesMecanico:  "Responsabilidad del mecánico",
  responsabilidadesCliente:   "Responsabilidad del cliente",
  repuestosConGarantia:       "Repuestos con garantía",
  repuestosSinGarantia:       "Repuestos sin garantía",
  mantenimientoRecomendado:   "Mantenimiento recomendado",
  proximosServiciosSugeridos: "Próximos servicios sugeridos",
  advertenciasDeUso:          "Advertencias de uso",
};

function compilarGarantia(campos) {
  return Object.entries(campos)
    .filter(([, v]) => v && String(v).trim())
    .map(([k, v]) => `${LABELS_GARANTIA[k]}:\n${String(v).trim()}`)
    .join("\n\n");
}

function calcularVencimiento(dias) {
  if (Number(dias) <= 0) return "";
  const d = new Date();
  d.setDate(d.getDate() + Number(dias));
  return d.toLocaleDateString("sv-SE");
}

export default function PrePdfView({ order, setView, setFinalPdfData, showToast }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const client = LS.getDoc("clientes", order.clientId);
  const esRechazo = order.cierreTipo === "rechazo_cliente";
  const [generatedToken, setGeneratedToken] = useState(order.receiptToken || null);
  const [garantia, setGarantia] = useState(
    order.garantiaFinal || (esRechazo ? TEXTO_CIERRE_RECHAZO : config.garantiaDefault || PLANTILLAS_GARANTIA[0].texto)
  );
  const [vencimientoGarantia, setVencimientoGarantia] = useState(
    esRechazo ? "" : order.vencimientoGarantia || calcularVencimiento(config.garantiaDias)
  );
  const [diasPersonalizados, setDiasPersonalizados] = useState("");
  const [garantiaEstructurada, setGarantiaEstructurada] = useState(
    order.garantiaEstructurada ||
    config.garantiaEstructurada ||
    CONFIG_DEFAULT.garantiaEstructurada
  );
  const [receiptError, setReceiptError] = useState("");
  const [generandoPdf, setGenerandoPdf] = useState(false);

  const totalOrden = calcularResultadosOrden(order).total;
  const totalPagado = (order.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
  const saldo = totalOrden - totalPagado;

  const irAlPdf = async () => {
    if (saldo > 0 || generandoPdf) return;
    setReceiptError("");
    setGenerandoPdf(true);

    const numeroComprobante = generarNumeroComprobante(order.id);
    const cliente = LS.getDoc("clientes", order.clientId);
    const moto = LS.getDoc("motos", order.bikeId);
    const garantiaCompilada = compilarGarantia(garantiaEstructurada);
    const garantiaFinal = esRechazo
      ? (garantia || TEXTO_CIERRE_RECHAZO)
      : (garantiaCompilada || garantia || PLANTILLAS_GARANTIA[0].texto);
    const vencimientoFinal = esRechazo ? "" : vencimientoGarantia;
    const orderParaSnapshot = {
      ...order,
      estado: "cerrado_emitido",
      total: totalOrden,
      garantiaFinal,
      vencimientoGarantia: vencimientoFinal,
    };
    const snapshotFinal = crearSnapshotVerificable(orderParaSnapshot, numeroComprobante, cliente, moto);

    // Generar token de verificación pública
    let receiptToken = order.receiptToken || null;
    let ratingExpiresAt = order.ratingExpiresAt || null;
    const puedeCalificar = !order.isDemo && !order.isTest && !order.excludedFromReputation;

    if (puedeCalificar && !receiptToken) {
      const tokenCandidato = generateReceiptToken();
      const venceCalificacion = Date.now() + 30 * 24 * 60 * 60 * 1000;
      const telRaw = (cliente?.celular || cliente?.tel || cliente?.whatsapp || cliente?.telefono || "").replace(/\D/g, "");
      const phoneLast4 = telRaw.length >= 4 ? telRaw.slice(-4) : null;

      try {
        await crearPublicReceipt({
          order,
          token: tokenCandidato,
          hash: snapshotFinal.hash,
          numeroComprobante,
          config,
          moto,
          phoneLast4,
        });
        receiptToken = tokenCandidato;
        ratingExpiresAt = venceCalificacion;
      } catch (error) {
        console.error("No se pudo crear el comprobante publico verificable", error);
        setReceiptError(
          "No se pudo generar el link verificable del comprobante. Revisá la conexión e intentá de nuevo antes de entregar el PDF."
        );
        setGenerandoPdf(false);
        return;
      }
    }

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
      garantiaEstructurada,
      vencimientoGarantia: vencimientoFinal,
      snapshotFinal,
      receiptToken,
      ratingEnabled: !!receiptToken,
      ratingUsed: false,
      ratingExpiresAt,
      aprobacionCliente: {
        fecha: new Date().toISOString(),
        metodo: order.aprobadoPor || "manual",
        comprobante: numeroComprobante,
      },
    });
    logAction("orden_cerrada", order.id, "trabajo", {
      numeroComprobante,
      total: totalOrden,
      numeroTrabajo: order.numeroTrabajo || "",
    }).catch(() => {});

    const kmEntrega = Number(order.kmEntrega) || 0;
    if (kmEntrega > 0 && order.bikeId) {
      LS.updateDoc("motos", order.bikeId, { km: kmEntrega, kilometrajeActual: kmEntrega });
    }

    crearRecordatorioDeOrden(order);

    setFinalPdfData({
      garantia: garantiaFinal,
      vencimientoGarantia: vencimientoFinal,
      numeroComprobante,
      tipoCierre: esRechazo ? "rechazo_cliente" : "",
      receiptToken,
      qrData: {
        numeroComprobante,
        orderId: order.id,
        hash: snapshotFinal.hash,
        fecha: snapshotFinal.fechaComprobante,
      },
    });
    setGeneratedToken(receiptToken || null);
    setGenerandoPdf(false);
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

        {esRechazo ? (
          <div>
            <label className="ml-2 text-[10px] font-black uppercase tracking-widest text-zinc-400">
              Observación del cierre (editable)
            </label>
            <textarea
              value={garantia}
              onChange={(e) => setGarantia(e.target.value)}
              rows="5"
              className="mt-2 w-full rounded-2xl border-2 border-zinc-100 p-4 text-sm font-bold text-zinc-700 outline-none focus:border-orange-500"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="ml-1 text-[10px] font-black uppercase tracking-widest text-zinc-400">Garantía y observaciones</p>
            <p className="ml-1 text-[9px] text-zinc-400">Los campos vacíos no aparecen en el comprobante.</p>
            {Object.keys(LABELS_GARANTIA).map((campo) => (
              <div key={campo}>
                <label className="ml-1 text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  {LABELS_GARANTIA[campo]}
                </label>
                <textarea
                  value={garantiaEstructurada[campo] || ""}
                  onChange={(e) =>
                    setGarantiaEstructurada((prev) => ({ ...prev, [campo]: e.target.value }))
                  }
                  rows={2}
                  placeholder="(vacío = no aparece en el PDF)"
                  className="mt-1 w-full rounded-2xl border-2 border-zinc-100 p-3 text-sm font-bold text-zinc-700 outline-none focus:border-orange-500"
                />
              </div>
            ))}
          </div>
        )}

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
              type="text"
              inputMode="numeric"
              value={diasPersonalizados}
              onChange={(e) => setDiasPersonalizados(e.target.value.replace(/\D/g, ""))}
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

        {receiptError && (
          <div className="rounded-3xl border-2 border-red-200 bg-red-50 p-4">
            <p className="text-[10px] font-black uppercase leading-tight text-red-600">{receiptError}</p>
          </div>
        )}

        {!generatedToken && (
          <button disabled={saldo > 0 || generandoPdf} onClick={irAlPdf} className={`flex w-full items-center justify-center gap-3 rounded-3xl py-6 font-black uppercase shadow-xl transition-all ${saldo > 0 || generandoPdf ? "bg-zinc-200 text-zinc-400" : "bg-orange-600 text-white active:scale-95"}`}>
            <FileText size={20} /> {generandoPdf ? "Generando comprobante..." : esRechazo ? "Generar comprobante sin garantia" : "Generar comprobante para el cliente"}
          </button>
        )}

        {generatedToken && (
          <div className="space-y-3 rounded-3xl border border-orange-200 bg-orange-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-600">
              Comprobante disponible para el cliente
            </p>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Tu cliente puede revisar el detalle, validar el trabajo y calificar desde este link.
            </p>
            <div className="rounded-2xl bg-white border border-zinc-200 px-4 py-3">
              <p className="font-mono text-xs text-zinc-500 break-all">
                {`https://app.motogestion.ar/verificar/${generatedToken}`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://app.motogestion.ar/verificar/${generatedToken}`);
                  showToast?.("Link copiado");
                }}
                className="rounded-2xl border border-zinc-200 bg-white py-3 text-[10px] font-black uppercase tracking-widest text-zinc-700 active:scale-95 transition-all"
              >
                Copiar link
              </button>
              <button
                onClick={() => {
                  const mensaje = mensajeComprobanteVerificable({
                    clienteNombre: client?.nombre,
                    verifyUrl: `https://app.motogestion.ar/verificar/${generatedToken}`,
                    nombreTaller: config.nombreTaller,
                    documentType: esRechazo ? "diagnostico_presupuesto_cerrado" : "servicio_realizado",
                  });
                  const tel = normalizarTelWA(client?.whatsapp || client?.tel || "");
                  const waUrl = tel
                    ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
                    : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
                  window.open(waUrl, "_blank");
                }}
                className="rounded-2xl bg-green-600 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
              >
                Enviar WA
              </button>
            </div>
            {!esRechazo && (
              <button
                onClick={() => {
                  const mensaje = mensajeSolicitudCalificacion({
                    clienteNombre: client?.nombre,
                    verifyUrl: `https://app.motogestion.ar/verificar/${generatedToken}`,
                    nombreTaller: config.nombreTaller,
                  });
                  const tel = normalizarTelWA(client?.whatsapp || client?.tel || "");
                  const waUrl = tel
                    ? `https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`
                    : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
                  window.open(waUrl, "_blank");
                }}
                className="w-full rounded-2xl border border-green-600/40 bg-green-600/10 py-3 text-[10px] font-black uppercase tracking-widest text-green-400 active:scale-95 transition-all"
              >
                Pedir calificación por WA
              </button>
            )}
            <button
              onClick={() => setView("imprimirOrden")}
              className="w-full rounded-2xl bg-orange-600 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
            >
              Ver comprobante completo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
