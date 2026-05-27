import React, { useEffect, useRef, useState } from "react";
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

function titleCase(texto = "") {
  return String(texto || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\p{L}/gu, (letra) => letra.toUpperCase());
}

function normalizarNombrePersona(nombre = "") {
  return titleCase(nombre)
    .replace(/\bJose\b/g, "José")
    .replace(/\bLuiz\b/g, "Luis");
}

function normalizarMoto(marca = "", modelo = "") {
  const marcaNorm = titleCase(marca)
    .replace(/\bYhamaha\b/gi, "Yamaha")
    .replace(/\bYamaha\b/gi, "Yamaha")
    .replace(/\bHonda\b/gi, "Honda");
  const modeloNorm = titleCase(modelo).replace(/\b(Fz|Ybr|Cg|Xr|Xtz|Ns|Rs|Glh|Cb|Crf)\b/g, (m) => m.toUpperCase());
  return [marcaNorm, modeloNorm].filter(Boolean).join(" ").trim() || "---";
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
  const tareasPresupuestadas = snapshot.tareas || order.tareas || [];
  const repuestosPresupuestados = snapshot.repuestos || order.repuestos || [];
  const tareas = esRechazo ? [] : tareasPresupuestadas;
  const repuestos = esRechazo ? [] : repuestosPresupuestados;
  const pagos = snapshot.pagos || order.pagos || [];
  const totalOrden = typeof snapshot.total === "number" ? snapshot.total : calcularResultadosOrden(order).total;
  const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
  const saldo = totalOrden - totalPagado;
  const numeroComprobante = extraData?.numeroComprobante || order.numeroComprobante || `COMP-${order.id.slice(-6).toUpperCase()}`;
  const receiptToken = extraData?.receiptToken || order.receiptToken || null;
  const verifyUrl = receiptToken ? `https://app.motogestion.ar/verificar/${receiptToken}` : null;
  const kilometraje = order.kmIngreso || order.km || bike?.kilometrajeActual || bike?.km;
  const proximoControl = order.proximoControl || null;
  const clienteNombre = normalizarNombrePersona(client?.nombre || snapshot.clienteNombre || "");
  const clienteTelefono = client?.celular || client?.whatsapp || client?.tel || client?.telefono || "---";
  const motoNombre = normalizarMoto(bike?.marca || snapshot.bikeMarca, bike?.modelo || snapshot.bikeModelo);
  const motoPatente = bike?.patente || snapshot.bikePatente || "---";
  const vencimientoRaw = extraData?.vencimientoGarantia || order.vencimientoGarantia || null;
  const vencimientoLabel = vencimientoRaw
    ? new Date(vencimientoRaw + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  const printRootRef = useRef(null);
  const [generating, setGenerating] = useState(false);

  const isIosStandalone =
    window.navigator.standalone === true ||
    (window.matchMedia("(display-mode: standalone)").matches &&
      /iPhone|iPad|iPod/i.test(navigator.userAgent));
  const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  const shouldGeneratePdfFile = isMobileDevice || isStandalone;

  async function handleGuardarPdf() {
    setGenerating(true);
    const el = printRootRef.current;
    const previousRootStyle = el
      ? {
          width: el.style.width,
          maxWidth: el.style.maxWidth,
          overflow: el.style.overflow,
        }
      : null;
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const SCALE = 2;
      const MARGIN_MM = 15;
      const EXPORT_WIDTH_PX = 680;

      if (!el) throw new Error("No se encontró la hoja para exportar.");

      const targetWidth = EXPORT_WIDTH_PX;
      el.style.width = `${targetWidth}px`;
      el.style.maxWidth = `${targetWidth}px`;
      el.style.overflow = "visible";
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // Collect block positions before capture so page cuts avoid breaking cards/tables.
      const elRect = el.getBoundingClientRect();
      const blockRectsPxScreen = [];
      el.querySelectorAll("[style*='avoid']").forEach((b) => {
        const r = b.getBoundingClientRect();
        if (r.top > elRect.top + 5) {
          blockRectsPxScreen.push({
            top: r.top - elRect.top,
            bottom: r.bottom - elRect.top,
          });
        }
      });

      const canvas = await html2canvas(el, {
        scale: SCALE,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: targetWidth,
        windowWidth: targetWidth,
        height: el.scrollHeight,
      });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const contentW = pdfW - MARGIN_MM * 2;
      const contentH = pdfH - MARGIN_MM * 2;

      const pageHeightPx = Math.floor((contentH * canvas.width) / contentW);
      const minProgressPx = Math.floor(pageHeightPx * 0.35);
      const avoidRectsPx = blockRectsPxScreen.map((r) => ({
        top: Math.max(0, Math.floor(r.top * SCALE)),
        bottom: Math.min(canvas.height, Math.ceil(r.bottom * SCALE)),
      }));

      function getSafeCutPx(startPx, idealCutPx) {
        let cutPx = Math.min(idealCutPx, canvas.height);
        const minCutPx = Math.min(canvas.height, startPx + minProgressPx);
        const paddingPx = Math.max(16, Math.floor(SCALE * 8));

        for (const rect of avoidRectsPx) {
          const insideBlock = cutPx > rect.top + paddingPx && cutPx < rect.bottom - paddingPx;
          if (insideBlock && rect.top - paddingPx > minCutPx) {
            cutPx = rect.top - paddingPx;
            break;
          }
        }

        return Math.max(minCutPx, Math.min(cutPx, canvas.height));
      }

      let pageStartPx = 0;
      let isFirst = true;

      while (pageStartPx < canvas.height - 1) {
        if (!isFirst) pdf.addPage();

        const idealEndPx = Math.min(pageStartPx + pageHeightPx, canvas.height);
        const pageEndPx = idealEndPx >= canvas.height ? canvas.height : getSafeCutPx(pageStartPx, idealEndPx);
        const sliceHeightPx = Math.max(1, pageEndPx - pageStartPx);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        const pageCtx = pageCanvas.getContext("2d");
        pageCtx.fillStyle = "#ffffff";
        pageCtx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        pageCtx.drawImage(
          canvas,
          0,
          pageStartPx,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx,
        );

        const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.92);
        const pageImgHeightMm = (sliceHeightPx * contentW) / canvas.width;
        pdf.addImage(pageImgData, "JPEG", MARGIN_MM, MARGIN_MM, contentW, pageImgHeightMm);

        pageStartPx = pageEndPx;
        isFirst = false;
      }

      const blob = pdf.output("blob");
      const file = new File([blob], `${numeroComprobante}.pdf`, { type: "application/pdf" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: numeroComprobante });
      } else if (navigator.share) {
        await navigator.share({ title: document.title, url: window.location.href });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${numeroComprobante}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      window.print();
    } finally {
      if (el && previousRootStyle) {
        el.style.width = previousRootStyle.width;
        el.style.maxWidth = previousRootStyle.maxWidth;
        el.style.overflow = previousRootStyle.overflow;
      }
      setGenerating(false);
    }
  }

  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = numeroComprobante;
    return () => {
      document.title = tituloAnterior;
    };
  }, [numeroComprobante]);

  return (
    <div className="min-h-screen bg-white p-4 text-left font-sans text-zinc-900 animate-in fade-in print:p-0 print:min-h-0">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm;
            @top-right {
              content: "${numeroComprobante}";
              font-size: 7pt;
              font-family: system-ui, sans-serif;
              color: #71717a;
            }
            @bottom-center {
              content: "Pág. " counter(page) " de " counter(pages);
              font-size: 7pt;
              font-family: system-ui, sans-serif;
              color: #71717a;
            }
          }
          html, body, #root {
            background: #ffffff !important;
            background-color: #ffffff !important;
            background-image: none !important;
            color: #09090b !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-root { max-width: 100% !important; width: 100% !important; overflow: visible !important; background: #ffffff !important; }
          #root > .max-w-md,
          #root > .max-w-md > div,
          .print-root {
            max-width: none !important;
            width: 100% !important;
            margin: 0 auto !important;
          }
          .print-root {
            width: 186mm !important;
            max-width: 186mm !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
            overflow-y: visible !important;
          }
          .print-root * {
            box-sizing: border-box !important;
            max-width: 100% !important;
          }
          .print-header {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 42mm !important;
            gap: 8mm !important;
            align-items: start !important;
          }
          .print-toolbar { display: none !important; }
        }
      `}</style>

      <div ref={printRootRef} className="print-root mx-auto max-w-[680px] bg-white print:max-w-none print:w-full overflow-hidden print:overflow-visible">
        <div className="border-b-2 border-zinc-900 px-8 py-6 print:px-0 print:py-4" style={bloqueCompletoStyle}>
          <div className="print-header flex items-start justify-between gap-8">
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
                {config.direccionTaller && <p><span className="font-black">Ubicado en:</span> {config.direccionTaller}</p>}
                <p><span className="font-black">WhatsApp:</span> {config.telefonoTaller}</p>
                <p><span className="font-black">Mail:</span> {config.emailNotificacion || "---"}</p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-4" style={bloqueCompletoStyle}>
              <div className="text-left">
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
                    value={verifyUrl || JSON.stringify({
                      numeroComprobante,
                      orderId: order.id,
                      fecha: order.fechaComprobante,
                      hash: snapshot.hash,
                    })}
                    size={168}
                    level="H"
                    marginSize={2}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                  />
                  <p className="mt-2 max-w-[168px] text-left text-[7px] font-bold leading-tight text-zinc-700">
                    Escaneá para verificar el trabajo realizado y calificar el servicio.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 px-8 py-4 print:px-0 print:py-2">
          <div className="grid grid-cols-2 gap-4" style={bloqueCompletoStyle}>
            <div className="border border-zinc-300 bg-zinc-50 p-4" style={{ minWidth: 0 }}>
              <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">Cliente</p>
              <p className="mt-2 text-sm font-black text-zinc-900">
                <span className="text-zinc-500">Cliente:</span> {clienteNombre || "---"}
              </p>
              <p className="mt-1 text-xs font-bold text-zinc-700">
                <span className="text-zinc-500">Celular:</span> {clienteTelefono}
              </p>
            </div>
            <div className="border border-zinc-300 bg-zinc-50 p-4" style={{ minWidth: 0 }}>
              <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">Motocicleta</p>
              <p className="mt-2 text-sm font-black text-zinc-900">
                <span className="text-zinc-500">Motocicleta:</span> {motoNombre}
              </p>
              <p className="mt-1 text-xs font-bold text-zinc-700">
                <span className="text-zinc-500">Patente:</span> {motoPatente}{kilometraje ? ` • ${kilometraje} km` : ""}
              </p>
            </div>
          </div>

          <div style={bloqueCompletoStyle}>
            <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide text-zinc-700">
              {esRechazo ? "Detalle del cierre" : "Trabajos realizados"}
            </h3>
            <div className="border border-zinc-300">
              <div className="bg-zinc-900 print:bg-zinc-200 px-4 py-2">
                <p className="text-[9px] font-black uppercase tracking-wide text-white print:text-zinc-700">Descripción</p>
              </div>
              {esRechazo ? (
                <>
                  <div className="border-b border-zinc-200 px-4 py-2 text-sm">
                    <p className="font-black uppercase text-zinc-900">Diagnóstico / revisión facturable</p>
                    <p className="text-[10px] font-bold text-zinc-500">
                      Tiempo: {cierreRechazo.horasDiagnostico || 0} h - Base: {formatMoney(cierreRechazo.baseManoObra || totalOrden)}
                    </p>
                  </div>
                  {cierreRechazo.extraMonto > 0 && (
                    <div className="border-b border-zinc-200 px-4 py-2 text-sm">
                      <p className="font-black uppercase text-zinc-900">Cargo adicional acordado</p>
                      <p className="text-[10px] font-bold text-zinc-500">{formatMoney(cierreRechazo.extraMonto)}</p>
                    </div>
                  )}
                  <div className="px-4 py-2 text-sm">
                    <p className="font-black uppercase text-zinc-900">Presupuesto rechazado o pospuesto</p>
                    <p className="text-[10px] font-bold text-zinc-500">
                      Presupuesto original no cobrado: {formatMoney(cierreRechazo.presupuestoOriginalTotal || order.presupuestoOriginalTotal || 0)}
                    </p>
                  </div>
                  {tareasPresupuestadas.length > 0 && (
                    <div className="border-t border-zinc-200 px-4 py-2 text-sm">
                      <p className="font-black uppercase text-zinc-900">Mano de obra rechazada / pospuesta</p>
                      <ul className="mt-1 space-y-0.5">
                        {tareasPresupuestadas.map((t, i) => (
                          <li key={`tarea-rechazada-${i}`} className="text-[10px] font-bold uppercase text-zinc-700">
                            {t.nombre || "Trabajo presupuestado"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {repuestosPresupuestados.length > 0 && (
                    <div className="border-t border-zinc-200 px-4 py-2 text-sm">
                      <p className="font-black uppercase text-zinc-900">Repuestos rechazados / no cambiados</p>
                      <ul className="mt-1 space-y-0.5">
                        {repuestosPresupuestados.map((r, i) => (
                          <li key={`repuesto-rechazado-${i}`} className="text-[10px] font-bold uppercase text-zinc-700">
                            {r.cantidad > 1 ? `${r.cantidad}x ` : ""}{r.nombre || "Repuesto presupuestado"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : tareas.length > 0 ? (
                tareas.map((t, i) => (
                  <div key={i} className={`px-4 py-2 text-sm ${i < tareas.length - 1 ? "border-b border-zinc-200" : ""}`}>
                    <p className="font-black uppercase text-zinc-900">{t.nombre}</p>
                    <p className="text-[10px] font-bold text-zinc-500">Mano de obra realizada</p>
                  </div>
                ))
              ) : (
                <p className="px-4 py-2 text-xs font-bold text-zinc-400">Sin trabajos cargados</p>
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
                  <div key={`rep-${i}`} className={`px-4 py-2 text-sm ${i < repuestos.length - 1 ? "border-b border-zinc-200" : ""}`}>
                    <p className="font-black uppercase text-zinc-900">{r.cantidad > 1 ? `${r.cantidad}x ` : ""}{r.nombre}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pagos.length > 0 && (
            <div style={bloqueCompletoStyle}>
              <h3 className="mb-2 text-[10px] font-black uppercase tracking-wide text-zinc-700">Pagos registrados</h3>
              <table className="w-full border border-zinc-300" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "31%" }} />
                  <col style={{ width: "32%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-300 bg-zinc-100">
                    <th className="px-4 py-2 text-left text-[9px] font-black text-zinc-700">Fecha</th>
                    <th className="px-4 py-2 text-left text-[9px] font-black text-zinc-700">Medio</th>
                    <th className="px-4 py-2 text-left text-[9px] font-black text-zinc-700">N° pago</th>
                    <th className="px-4 py-2 text-right text-[9px] font-black text-zinc-700 w-[132px]">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p, i) => (
                    <tr key={i} className={i < pagos.length - 1 ? "border-b border-zinc-200" : ""}>
                      <td className="px-4 py-2 text-[10px] text-zinc-700 whitespace-nowrap overflow-hidden text-ellipsis">{p.fecha}</td>
                      <td className="px-4 py-2 text-[10px] font-bold uppercase text-zinc-700 whitespace-nowrap overflow-hidden text-ellipsis">{labelMetodo(p.metodo)}</td>
                      <td className="px-4 py-2 text-[10px] text-zinc-700 whitespace-nowrap overflow-hidden text-ellipsis">{p.comprobante || "---"}</td>
                      <td className="px-4 py-2 text-right text-[10px] font-black leading-tight text-zinc-900 whitespace-nowrap">{formatMoney(p.monto || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-[1.1fr_0.9fr] gap-4" style={bloqueCompletoStyle}>
            <div className="border border-zinc-300 p-3" style={{ minWidth: 0 }}>
              <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">
                {esRechazo ? "Condicion del cierre" : "Garantía"}
              </p>
              {!esRechazo && vencimientoLabel && (
                <div className="mt-2 inline-block rounded bg-zinc-900 print:bg-transparent print:border print:border-zinc-700 px-2 py-1">
                  <p className="text-[9px] font-black uppercase tracking-wide text-white print:text-zinc-800">
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

            <div className="space-y-2 border border-zinc-300 p-3 overflow-hidden" style={{ minWidth: 0 }}>
              <div className="text-xs">
                <p className="font-bold text-zinc-600">{esRechazo ? "Total cobrado:" : "Total trabajo:"}</p>
                <p className="mt-1 text-sm font-black leading-tight text-zinc-900">{formatMoney(totalOrden)}</p>
              </div>
              {totalPagado > 0 && (
                <div className="border-t border-zinc-300 pt-2 text-xs">
                  <p className="font-bold text-green-700">Total pagado:</p>
                  <p className="mt-1 text-sm font-black leading-tight text-green-700">{formatMoney(totalPagado)}</p>
                </div>
              )}
              <div className={`mt-2 rounded px-3 py-2 text-xs font-black text-white ${saldo <= 0 ? "bg-green-600" : "bg-zinc-900"} text-center whitespace-nowrap`}>
                <p>{saldo <= 0 ? "PAGADO" : "SALDO"}</p>
                <p className="mt-1 leading-tight">{formatMoney(Math.max(saldo, 0))}</p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 border-2 border-yellow-300 bg-yellow-50 p-3" style={bloqueCompletoStyle}>
            <p className="text-[9px] font-black uppercase tracking-wide text-yellow-800">
              {esRechazo ? "Términos del cierre sin garantía" : "Términos de garantía y validez"}
            </p>
            {esRechazo ? (
              <ul className="space-y-0.5">
                <li className="text-[9px] text-zinc-700">El cliente rechaza o pospone el presupuesto.</li>
                <li className="text-[9px] text-zinc-700">No se realizaron los trabajos presupuestados ni se cambiaron repuestos.</li>
                <li className="text-[9px] text-zinc-700">El monto cobrado corresponde al diagnóstico, revisión y cargos acordados.</li>
                <li className="text-[9px] text-zinc-700">Si retoma la reparación en el futuro, el presupuesto puede ajustarse.</li>
                <li className="text-[9px] text-zinc-700">Número único verificable. Escaneá el QR para validar.</li>
              </ul>
            ) : (
              <ul className="space-y-0.5">
                <li className="text-[9px] text-zinc-700">Sin comprobante no se pueden realizar reclamos de garantía.</li>
                <li className="text-[9px] text-zinc-700">La garantía de mano de obra se informa en este comprobante.</li>
                <li className="text-[9px] text-zinc-700">Los repuestos quedan sujetos a la garantía del fabricante.</li>
                <li className="text-[9px] text-zinc-700">Documento no modificable, generado automáticamente.</li>
                <li className="text-[9px] text-zinc-700">Número único verificable. Escaneá el QR para validar.</li>
              </ul>
            )}
          </div>

          <div className="space-y-1 border border-zinc-200 bg-zinc-50 rounded-lg px-4 py-3" style={bloqueCompletoStyle}>
            <p className="text-[9px] font-black uppercase tracking-wide text-zinc-600">Respaldo para historial de la moto</p>
            <p className="text-[9px] leading-relaxed text-zinc-600">
              {esRechazo
                ? "Este documento deja constancia del diagnóstico/revisión realizado, el presupuesto informado y la decisión del cliente al momento del cierre."
                : "Este documento deja constancia del servicio realizado, los repuestos utilizados y las condiciones de garantía acordadas."}
            </p>
            <p className="text-[9px] text-zinc-500">Guardá este comprobante como parte del historial de la moto.</p>
          </div>

          {verifyUrl && (
            <div className="border border-zinc-200 rounded-lg px-4 py-2" style={bloqueCompletoStyle}>
              <p className="text-[8px] font-black uppercase tracking-wide text-zinc-500 mb-1">Verificar comprobante y validar servicio</p>
              <a
                href={verifyUrl}
                className="text-[8px] font-mono text-orange-700 break-all underline"
                style={{ wordBreak: "break-all" }}
              >
                {verifyUrl}
              </a>
            </div>
          )}

          <div className="flex items-start justify-between gap-4 border-t-2 border-zinc-300 pt-3" style={bloqueCompletoStyle}>
            <div>
              <p className="text-[9px] font-black uppercase tracking-wide text-zinc-700">Conformidad</p>
              <p className="mt-1 text-[9px] leading-relaxed text-zinc-600">
                {esRechazo
                  ? "La recepción de este documento deja constancia del diagnóstico/revisión realizado, el presupuesto informado y la decisión del cliente de no proceder. El taller no se responsabiliza por daños derivados de no realizar los trabajos recomendados."
                  : "La recepción de este documento implica conformidad con el trabajo detallado, los pagos registrados y la garantía informada."}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[8px] text-zinc-500">
                {order.fechaComprobante?.slice(0, 10) || order.fechaIngreso}
              </p>
              {snapshot.hash && (
                <p className="mt-0.5 text-[7px] font-mono text-zinc-400">Hash: {snapshot.hash.slice(0, 16)}</p>
              )}
              <p className="mt-1 text-[7px] font-black uppercase tracking-wide text-orange-600">Documento emitido mediante MotoGestión</p>
            </div>
          </div>
        </div>
      </div>

      <div className="print-toolbar fixed bottom-8 left-1/2 flex -translate-x-1/2 gap-3 print:hidden">
        <button
          onClick={() => setView("detalleOrden")}
          className="rounded-2xl border border-zinc-200 bg-zinc-100 p-4 text-[10px] font-black uppercase shadow-lg active:scale-95"
        >
          Cerrar
        </button>
        <button
          disabled={generating}
          onClick={shouldGeneratePdfFile ? handleGuardarPdf : () => window.print()}
          className="flex items-center gap-2 rounded-3xl bg-red-600 px-8 py-4 text-xs font-black uppercase text-white shadow-2xl transition-all active:scale-95 disabled:opacity-60 disabled:scale-100"
        >
          {generating ? (
            "Generando PDF..."
          ) : shouldGeneratePdfFile ? (
            <><Printer size={16} /> Guardar / Compartir PDF</>
          ) : (
            <><Printer size={16} /> Imprimir / PDF</>
          )}
        </button>
      </div>
    </div>
  );
}
