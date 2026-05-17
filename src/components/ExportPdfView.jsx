import React, { useEffect } from "react";
import { Printer } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { LS } from "../lib/storage.js";
import { CONFIG_DEFAULT, TEXTO_CIERRE_RECHAZO } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { formatMoney } from "../utils/format.js";

function labelMetodo(metodo = "") {
  const limpio = String(metodo).trim().toLowerCase();
  if (limpio === "mercadopago") return "Mercado Pago";
  if (limpio === "transferencia") return "Transferencia";
  if (limpio === "efectivo") return "Efectivo";
  if (limpio === "debito") return "Débito";
  if (limpio === "credito") return "Crédito";
  return metodo || "---";
}

const bloqueCompletoStyle = {
  breakInside: "avoid",
  pageBreakInside: "avoid",
};

export default function ExportPdfView({ order, bike, client, setView, extraData }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const snapshot = order.snapshotFinal || {};
  const esRechazo = (snapshot.cierreTipo || order.cierreTipo) === "rechazo_cliente" || extraData?.tipoCierre === "rechazo_cliente";
  const cierreRechazo = snapshot.cierreRechazo || order.cierreRechazo || {};
  const tareas = esRechazo ? [] : snapshot.tareas || order.tareas || [];
  const repuestos = esRechazo ? [] : snapshot.repuestos || order.repuestos || [];
  const pagos = snapshot.pagos || order.pagos || [];
  const totalOrden = typeof snapshot.total === "number" ? snapshot.total : calcularResultadosOrden(order).total;
  const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
  const saldo = totalOrden - totalPagado;
  const numeroComprobante = extraData?.numeroComprobante || order.numeroComprobante || `COMP-${order.id.slice(-6).toUpperCase()}`;
  const kilometraje = order.kmIngreso || order.km || bike?.kilometrajeActual || bike?.km;
  const proximoControl = order.proximoControl || null;
  const vencimientoRaw = extraData?.vencimientoGarantia || order.vencimientoGarantia || null;
  const vencimientoLabel = vencimientoRaw
    ? new Date(vencimientoRaw + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = numeroComprobante;
    return () => {
      document.title = tituloAnterior;
    };
  }, [numeroComprobante]);

  return (
    <div className="min-h-screen bg-zinc-100 p-4 text-left font-sans text-zinc-900 animate-in fade-in print:bg-white print:p-0">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 12mm 12mm 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; margin: 0; }
          .print-root { max-width: 100% !important; width: 100% !important; overflow: visible !important; }
        }
      `}</style>

      <div className="print-root mx-auto max-w-[680px] bg-white print:max-w-none print:w-full overflow-hidden print:overflow-visible">
        <div className="border-b-2 border-zinc-900 px-8 py-6 print:px-0 print:py-4" style={bloqueCompletoStyle}>
          <div className="flex items-start justify-between gap-8">
            <div className="flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-orange-600">
                {esRechazo ? "Constancia de diagnostico y presupuesto cerrado" : "Constancia de servicio técnico"}
              </p>
              <h1 className="mt-3 max-w-xs text-2xl font-black uppercase leading-tight tracking-tight">
                {config.nombreTaller}
              </h1>
              <p className="mt-2 text-xs font-bold text-zinc-600">
                {esRechazo
                  ? "Cliente rechaza o pospone la reparacion presupuestada. Se cobra solo el cierre acordado."
                  : "Documento de entrega y detalle del trabajo realizado"}
              </p>
              <div className="mt-4 space-y-1 text-[10px] leading-relaxed text-zinc-700">
                <p><span className="font-black">Técnico:</span> {config.mecanicoResponsable}</p>
                {config.direccionTaller && <p>{config.direccionTaller}</p>}
                <p><span className="font-black">WhatsApp:</span> {config.telefonoTaller}</p>
                <p><span className="font-black">Mail:</span> {config.emailNotificacion || "---"}</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4" style={bloqueCompletoStyle}>
              <div className="text-center">
                <p className="text-[9px] font-black uppercase tracking-wide text-orange-600">Comprobante N°</p>
                <p className="mt-1 text-lg font-black tracking-tight">{numeroComprobante}</p>
                <p className="mt-2 text-[9px] font-bold text-zinc-600">
                  Trabajo {order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`}
                </p>
                <p className="mt-1 text-[10px] font-bold text-zinc-700">
                  {order.fechaComprobante?.slice(0, 10) || order.fechaIngreso}
                </p>
              </div>

              {snapshot.hash && (
                <div className="rounded-lg border-2 border-zinc-900 bg-white p-2 print:p-3" style={bloqueCompletoStyle}>
                  <QRCodeCanvas
                    value={JSON.stringify({
                      numeroComprobante,
                      orderId: order.id,
                      fecha: order.fechaComprobante,
                      hash: snapshot.hash,
                    })}
                    size={110}
                    level="H"
                    marginSize={2}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                  />
                  <p className="mt-2 text-center text-[8px] font-bold text-zinc-700">ESCANEÁ PARA VALIDAR</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5 px-8 py-5 print:px-0 print:py-3">
          <div className="grid grid-cols-2 gap-4" style={bloqueCompletoStyle}>
            <div className="border border-zinc-300 bg-zinc-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">Cliente</p>
              <p className="mt-2 text-sm font-black text-zinc-900">{client?.nombre || "---"}</p>
              <p className="mt-1 text-xs text-zinc-600">{client?.tel || client?.telefono || "---"}</p>
            </div>
            <div className="border border-zinc-300 bg-zinc-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">Motocicleta</p>
              <p className="mt-2 text-sm font-black text-zinc-900">
                {bike?.marca} {bike?.modelo}
              </p>
              <p className="mt-1 text-xs font-bold text-zinc-700">
                {bike?.patente || "---"} {kilometraje ? `• ${kilometraje} km` : ""}
              </p>
            </div>
          </div>

          <div style={bloqueCompletoStyle}>
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide text-zinc-700">
              {esRechazo ? "Detalle del cierre" : "Trabajos realizados"}
            </h3>
            <div className="border border-zinc-300">
              <div className="bg-zinc-900 px-4 py-2">
                <p className="text-[9px] font-black uppercase tracking-wide text-white">Descripción</p>
              </div>
              {esRechazo ? (
                <>
                  <div className="border-b border-zinc-200 px-4 py-3 text-sm">
                    <p className="font-black uppercase text-zinc-900">Diagnostico / revision facturable</p>
                    <p className="text-[10px] font-bold text-zinc-500">
                      Tiempo: {cierreRechazo.horasDiagnostico || 0} h - Base: {formatMoney(cierreRechazo.baseManoObra || totalOrden)}
                    </p>
                  </div>
                  {cierreRechazo.extraMonto > 0 && (
                    <div className="border-b border-zinc-200 px-4 py-3 text-sm">
                      <p className="font-black uppercase text-zinc-900">Cargo adicional acordado</p>
                      <p className="text-[10px] font-bold text-zinc-500">{formatMoney(cierreRechazo.extraMonto)}</p>
                    </div>
                  )}
                  <div className="px-4 py-3 text-sm">
                    <p className="font-black uppercase text-zinc-900">Presupuesto rechazado o pospuesto</p>
                    <p className="text-[10px] font-bold text-zinc-500">
                      Presupuesto original no cobrado: {formatMoney(cierreRechazo.presupuestoOriginalTotal || order.presupuestoOriginalTotal || 0)}
                    </p>
                  </div>
                </>
              ) : tareas.length > 0 ? (
                tareas.map((t, i) => (
                  <div key={i} className={`px-4 py-3 text-sm ${i < tareas.length - 1 ? "border-b border-zinc-200" : ""}`}>
                    <p className="font-black uppercase text-zinc-900">{t.nombre}</p>
                    <p className="text-[10px] font-bold text-zinc-500">Mano de obra realizada</p>
                  </div>
                ))
              ) : (
                <p className="px-4 py-3 text-xs font-bold text-zinc-400">Sin trabajos cargados</p>
              )}
            </div>
          </div>

          {repuestos.length > 0 && (
            <div style={bloqueCompletoStyle}>
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide text-zinc-700">Repuestos utilizados</h3>
              <div className="border border-zinc-300">
                <div className="border-b border-zinc-300 bg-zinc-100 px-4 py-2">
                  <p className="text-[9px] font-black uppercase tracking-wide text-zinc-700">Descripción</p>
                </div>
                {repuestos.map((r, i) => (
                  <div key={`rep-${i}`} className={`px-4 py-3 text-sm ${i < repuestos.length - 1 ? "border-b border-zinc-200" : ""}`}>
                    <p className="font-black uppercase text-zinc-900">{r.cantidad > 1 ? `${r.cantidad}x ` : ""}{r.nombre}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pagos.length > 0 && (
            <div style={bloqueCompletoStyle}>
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide text-zinc-700">Pagos registrados</h3>
              <table className="w-full border border-zinc-300">
                <thead>
                  <tr className="border-b border-zinc-300 bg-zinc-100">
                    <th className="px-4 py-2 text-left text-[9px] font-black text-zinc-700">Fecha</th>
                    <th className="px-4 py-2 text-left text-[9px] font-black text-zinc-700">Medio</th>
                    <th className="px-4 py-2 text-left text-[9px] font-black text-zinc-700">N° pago</th>
                    <th className="px-4 py-2 text-right text-[9px] font-black text-zinc-700">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p, i) => (
                    <tr key={i} className={i < pagos.length - 1 ? "border-b border-zinc-200" : ""}>
                      <td className="px-4 py-2 text-[10px] text-zinc-700">{p.fecha}</td>
                      <td className="px-4 py-2 text-[10px] font-bold uppercase text-zinc-700">{labelMetodo(p.metodo)}</td>
                      <td className="px-4 py-2 text-[10px] text-zinc-700">{p.comprobante || "---"}</td>
                      <td className="px-4 py-2 text-right text-[10px] font-black text-zinc-900">{formatMoney(p.monto || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4" style={bloqueCompletoStyle}>
            <div className="border border-zinc-300 p-4">
              <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">
                {esRechazo ? "Condicion del cierre" : "Garantía"}
              </p>
              {!esRechazo && vencimientoLabel && (
                <div className="mt-2 inline-block rounded bg-zinc-900 px-2 py-1">
                  <p className="text-[9px] font-black uppercase tracking-wide text-white">
                    Válido hasta: {vencimientoLabel}
                  </p>
                </div>
              )}
              <p className="mt-2 text-[10px] leading-relaxed text-zinc-700">
                {extraData?.garantia || order.garantiaFinal || (esRechazo ? TEXTO_CIERRE_RECHAZO : "Sin texto de garantía cargado.")}
              </p>
              {!esRechazo && proximoControl?.activo && (
                <div className="mt-3 border-t border-zinc-300 pt-3">
                  <p className="text-[9px] font-black uppercase text-orange-700">Próximo control</p>
                  <p className="mt-1 text-[10px] font-bold text-zinc-700">
                    {proximoControl.unidad === "km"
                      ? `A los ${Number(proximoControl.kmObjetivo || 0).toLocaleString("es-AR")} km`
                      : `En ${proximoControl.valorObjetivo} días`}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 border border-zinc-300 p-4">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-zinc-600">{esRechazo ? "Total cobrado:" : "Total trabajo:"}</span>
                <span className="font-black text-zinc-900">{formatMoney(totalOrden)}</span>
              </div>
              {totalPagado > 0 && (
                <div className="flex justify-between border-t border-zinc-300 pt-2 text-sm">
                  <span className="font-bold text-green-700">Total pagado:</span>
                  <span className="font-black text-green-700">{formatMoney(totalPagado)}</span>
                </div>
              )}
              <div className={`mt-3 flex justify-between rounded px-3 py-3 font-black text-white ${saldo <= 0 ? "bg-green-600" : "bg-zinc-900"}`}>
                <span>{saldo <= 0 ? "PAGADO" : "SALDO PENDIENTE"}</span>
                <span>{formatMoney(Math.max(saldo, 0))}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-2 border-yellow-300 bg-yellow-50 p-4" style={bloqueCompletoStyle}>
            <p className="text-[10px] font-black uppercase tracking-wide text-yellow-800">
              {esRechazo ? "Terminos del cierre sin garantia" : "Términos de garantía y validez"}
            </p>
            {esRechazo ? (
              <ul className="space-y-1">
                <li className="text-[9px] text-zinc-700">El cliente rechaza o pospone el presupuesto.</li>
                <li className="text-[9px] text-zinc-700">No se realizaron los trabajos presupuestados ni se cambiaron repuestos.</li>
                <li className="text-[9px] text-zinc-700">El monto cobrado corresponde al diagnostico, revision y cargos acordados.</li>
                <li className="text-[9px] text-zinc-700">Si retoma la reparacion en el futuro, el presupuesto puede ajustarse.</li>
                <li className="text-[9px] text-zinc-700">Número único verificable. Escaneá el QR para validar.</li>
              </ul>
            ) : (
              <ul className="space-y-1">
                <li className="text-[9px] text-zinc-700">Sin comprobante no se pueden realizar reclamos de garantía.</li>
                <li className="text-[9px] text-zinc-700">La garantía de mano de obra se informa en este comprobante.</li>
                <li className="text-[9px] text-zinc-700">Los repuestos quedan sujetos a la garantía del fabricante.</li>
                <li className="text-[9px] text-zinc-700">Documento no modificable, generado automáticamente.</li>
                <li className="text-[9px] text-zinc-700">Número único verificable. Escaneá el QR para validar.</li>
              </ul>
            )}
          </div>

          <div className="space-y-2 border-t-2 border-zinc-300 pt-4" style={bloqueCompletoStyle}>
            <p className="text-[10px] font-black uppercase tracking-wide text-zinc-700">Conformidad</p>
            <p className="text-[10px] leading-relaxed text-zinc-600">
              {esRechazo
                ? "La recepcion de este documento deja constancia del presupuesto rechazado o pospuesto y del monto real cobrado por diagnostico/revision."
                : "La recepción de este documento implica conformidad con el trabajo detallado, los pagos registrados y la garantía informada."}
            </p>
          </div>

          <div className="space-y-1 border-t border-zinc-300 pt-3 text-center" style={bloqueCompletoStyle}>
            <p className="text-[8px] text-zinc-600 overflow-hidden">
              <span className="font-black">Hash:</span>{" "}
              <span className="font-mono break-all">{snapshot.hash}</span>
            </p>
            <p className="text-[8px] text-zinc-500">
              {order.fechaComprobante?.slice(0, 10) || order.fechaIngreso} • Moto Gestión
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 flex -translate-x-1/2 gap-3 print:hidden">
        <button
          onClick={() => setView("detalleOrden")}
          className="rounded-2xl border border-zinc-200 bg-zinc-100 p-4 text-[10px] font-black uppercase shadow-lg active:scale-95"
        >
          Cerrar
        </button>
        <button
          onClick={() => {
            const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
            if (isStandalone) {
              alert("Para imprimir o guardar PDF:\n1. Tocá el botón de compartir (⬆) del navegador\n2. Elegí \"Imprimir\" o \"Guardar como PDF\"");
            } else {
              window.print();
            }
          }}
          className="flex items-center gap-2 rounded-3xl bg-red-600 px-8 py-4 text-xs font-black uppercase text-white shadow-2xl transition-all active:scale-95"
        >
          <Printer size={16} /> Imprimir / Guardar PDF
        </button>
      </div>
    </div>
  );
}
