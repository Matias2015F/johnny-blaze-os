import React, { useEffect } from "react";
import { Printer } from "lucide-react";
import { LS } from "../lib/storage.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { formatMoney } from "../utils/format.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { QRCodeCanvas } from "qrcode.react";

function labelMetodo(metodo = "") {
  const limpio = String(metodo).trim().toLowerCase();
  if (limpio === "mercadopago") return "Mercado Pago";
  if (limpio === "transferencia") return "Transferencia";
  if (limpio === "efectivo") return "Efectivo";
  if (limpio === "debito") return "Debito";
  if (limpio === "credito") return "Credito";
  return metodo || "---";
}

const bloqueCompletoStyle = {
  breakInside: "avoid",
  pageBreakInside: "avoid",
};

export default function ExportPdfView({ order, bike, client, setView, extraData }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const snapshot = order.snapshotFinal || {};
  const tareas = snapshot.tareas || order.tareas || [];
  const repuestos = snapshot.repuestos || order.repuestos || [];
  const pagos = snapshot.pagos || order.pagos || [];
  const totalOrden = snapshot.total || calcularResultadosOrden(order).total;
  const totalPagado = pagos.reduce((s, p) => s + (p.monto || 0), 0);
  const saldo = totalOrden - totalPagado;
  const numeroComprobante = extraData?.numeroComprobante || order.numeroComprobante || `COMP-${order.id.slice(-6).toUpperCase()}`;
  const kilometraje = order.kmIngreso || order.km || bike?.kilometrajeActual || bike?.km;
  const proximoControl = order.proximoControl || null;

  useEffect(() => {
    const tituloAnterior = document.title;
    document.title = numeroComprobante;
    return () => {
      document.title = tituloAnterior;
    };
  }, [numeroComprobante]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-left text-slate-900 animate-in fade-in">
      <div className="mx-auto max-w-[960px] bg-white print:max-w-none">
        <div className="border-b-2 border-slate-900 px-12 py-8 print:py-10" style={bloqueCompletoStyle}>
          <div className="flex items-start justify-between gap-8">
            <div className="flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600">
                Constancia de servicio técnico
              </p>
              <h1 className="mt-3 max-w-xs text-2xl font-black uppercase leading-tight tracking-tight">
                {config.nombreTaller}
              </h1>
              <p className="mt-2 text-xs font-bold text-slate-600">
                Documento de entrega y detalle del trabajo realizado
              </p>
              <div className="mt-4 space-y-1 text-[10px] leading-relaxed text-slate-700">
                <p><span className="font-black">Técnico:</span> {config.mecanicoResponsable}</p>
                <p>Sara Romero e/ Eva Perón y Belgrano • Diamante, ER</p>
                <p><span className="font-black">WhatsApp:</span> {config.telefonoTaller}</p>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4" style={bloqueCompletoStyle}>
              <div className="text-center">
                <p className="text-[9px] font-black uppercase text-blue-600 tracking-wide">Comprobante N°</p>
                <p className="mt-1 text-lg font-black tracking-tight">{numeroComprobante}</p>
                <p className="mt-2 text-[9px] font-bold text-slate-600">
                  Trabajo {order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`}
                </p>
                <p className="mt-1 text-[10px] font-bold text-slate-700">
                  {order.fechaComprobante?.slice(0, 10) || order.fechaIngreso}
                </p>
              </div>

              {snapshot.hash && (
                <div className="rounded-lg border-3 border-slate-900 bg-white p-2 print:p-3" style={bloqueCompletoStyle}>
                  <QRCodeCanvas
                    value={JSON.stringify({
                      numeroComprobante,
                      orderId: order.id,
                      fecha: order.fechaComprobante,
                      hash: snapshot.hash
                    })}
                    size={140}
                    level="H"
                    marginSize={2}
                    fgColor="#000000"
                    bgColor="#FFFFFF"
                  />
                  <p className="mt-2 text-center text-[8px] font-bold text-slate-700">ESCANEA PARA VALIDAR</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6 px-12 py-6 print:py-8">
          <div className="grid grid-cols-2 gap-6" style={bloqueCompletoStyle}>
            <div className="border border-slate-300 bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase text-slate-600 tracking-wide">Cliente</p>
              <p className="mt-2 text-sm font-black text-slate-900">{client?.nombre || "---"}</p>
              <p className="mt-1 text-xs text-slate-600">{client?.tel || client?.telefono || "---"}</p>
            </div>
            <div className="border border-slate-300 bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase text-slate-600 tracking-wide">Motocicleta</p>
              <p className="mt-2 text-sm font-black text-slate-900">
                {bike?.marca} {bike?.modelo}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-700">
                {bike?.patente || "---"} {kilometraje ? `• ${kilometraje} km` : ""}
              </p>
            </div>
          </div>

          <div style={bloqueCompletoStyle}>
            <h3 className="mb-2 text-[10px] font-black uppercase text-slate-700 tracking-wide">Trabajos realizados</h3>
            <div className="border border-slate-300">
              <div className="bg-slate-900 px-4 py-2">
                <p className="text-[9px] font-black uppercase tracking-wide text-white">Descripción • Monto</p>
              </div>
              {tareas.length > 0 ? (
                tareas.map((t, i) => (
                  <div key={i} className={`flex justify-between px-4 py-3 text-sm ${i < tareas.length - 1 ? "border-b border-slate-200" : ""}`}>
                    <div>
                      <p className="font-black text-slate-900">{t.nombre}</p>
                      <p className="text-[10px] font-bold text-slate-500">Mano de obra</p>
                    </div>
                    <p className="font-black text-slate-900">{formatMoney(t.monto || 0)}</p>
                  </div>
                ))
              ) : (
                <p className="px-4 py-3 text-xs font-bold text-slate-400">Sin trabajos cargados</p>
              )}
            </div>
          </div>

          {repuestos.length > 0 && (
            <div style={bloqueCompletoStyle}>
              <h3 className="mb-2 text-[10px] font-black uppercase text-slate-700 tracking-wide">Repuestos utilizados</h3>
              <div className="border border-slate-300">
                <div className="border-b border-slate-300 bg-slate-100 px-4 py-2">
                  <p className="text-[9px] font-black uppercase tracking-wide text-slate-700">Descripción • Monto</p>
                </div>
                {repuestos.map((r, i) => (
                  <div key={`rep-${i}`} className={`flex justify-between px-4 py-3 text-sm ${i < repuestos.length - 1 ? "border-b border-slate-200" : ""}`}>
                    <div>
                      <p className="font-black text-slate-900">{r.cantidad > 1 ? `${r.cantidad}x ` : ""}{r.nombre}</p>
                      <p className="text-[10px] font-bold text-slate-500">{r.cantidad || 1} × {formatMoney(r.monto || 0)}</p>
                    </div>
                    <p className="font-black text-slate-900">{formatMoney((r.monto || 0) * (r.cantidad || 1))}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pagos.length > 0 && (
            <div style={bloqueCompletoStyle}>
              <h3 className="mb-2 text-[10px] font-black uppercase text-slate-700 tracking-wide">Pagos registrados</h3>
              <table className="w-full border border-slate-300">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100">
                    <th className="px-4 py-2 text-left text-[9px] font-black text-slate-700">Fecha</th>
                    <th className="px-4 py-2 text-left text-[9px] font-black text-slate-700">Medio</th>
                    <th className="px-4 py-2 text-left text-[9px] font-black text-slate-700">N° pago</th>
                    <th className="px-4 py-2 text-right text-[9px] font-black text-slate-700">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.map((p, i) => (
                    <tr key={i} className={i < pagos.length - 1 ? "border-b border-slate-200" : ""}>
                      <td className="px-4 py-2 text-[10px] text-slate-700">{p.fecha}</td>
                      <td className="px-4 py-2 text-[10px] font-bold uppercase text-slate-700">{labelMetodo(p.metodo)}</td>
                      <td className="px-4 py-2 text-[10px] text-slate-700">{p.comprobante || "---"}</td>
                      <td className="px-4 py-2 text-right text-[10px] font-black text-slate-900">{formatMoney(p.monto || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6" style={bloqueCompletoStyle}>
            <div className="border border-slate-300 p-4">
              <p className="text-[9px] font-black uppercase text-slate-600 tracking-wide">Garantía</p>
              <p className="mt-3 text-[10px] leading-relaxed text-slate-700">
                {extraData?.garantia || order.garantiaFinal || "Sin texto de garantía cargado."}
              </p>
              {proximoControl?.activo && (
                <div className="mt-3 border-t border-slate-300 pt-3">
                  <p className="text-[9px] font-black uppercase text-blue-700">Próximo control</p>
                  <p className="mt-1 text-[10px] font-bold text-slate-700">
                    {proximoControl.unidad === "km"
                      ? `A los ${Number(proximoControl.kmObjetivo || 0).toLocaleString("es-AR")} km`
                      : `En ${proximoControl.valorObjetivo} días`}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 border border-slate-300 p-4">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-slate-600">Total trabajo:</span>
                <span className="font-black text-slate-900">{formatMoney(totalOrden)}</span>
              </div>
              {totalPagado > 0 && (
                <div className="flex justify-between border-t border-slate-300 pt-2 text-sm">
                  <span className="font-bold text-green-700">Total pagado:</span>
                  <span className="font-black text-green-700">{formatMoney(totalPagado)}</span>
                </div>
              )}
              <div className={`mt-3 flex justify-between rounded px-3 py-3 font-black text-white ${saldo <= 0 ? "bg-green-600" : "bg-slate-900"}`}>
                <span>{saldo <= 0 ? "PAGADO" : "SALDO PENDIENTE"}</span>
                <span>{formatMoney(Math.max(saldo, 0))}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-2 border-yellow-300 bg-yellow-50 p-4" style={bloqueCompletoStyle}>
            <p className="text-[10px] font-black uppercase tracking-wide text-yellow-800">⚠️ Términos de garantía y validez</p>
            <ul className="space-y-1">
              <li className="text-[9px] text-slate-700">✓ Sin comprobante NO se pueden realizar reclamos de garantía</li>
              <li className="text-[9px] text-slate-700">✓ Garantía mano de obra: 30 días • Repuestos: según fabricante</li>
              <li className="text-[9px] text-slate-700">✓ Documento NO modificable, generado automáticamente</li>
              <li className="text-[9px] text-slate-700">✓ Número único verificable • Escanea QR para validar</li>
            </ul>
          </div>

          <div className="space-y-2 border-t-2 border-slate-300 pt-4" style={bloqueCompletoStyle}>
            <p className="text-[10px] font-black uppercase text-slate-700 tracking-wide">Conformidad</p>
            <p className="text-[10px] leading-relaxed text-slate-600">
              La recepción de este documento implica conformidad con el trabajo detallado, los pagos registrados y la garantía informada.
            </p>
          </div>

          <div className="space-y-1 border-t border-slate-300 pt-3 text-center" style={bloqueCompletoStyle}>
            <p className="text-[8px] text-slate-600">
              <span className="font-black">Hash:</span> <span className="font-mono">{snapshot.hash}</span>
            </p>
            <p className="text-[8px] text-slate-500">
              {order.fechaComprobante?.slice(0, 10) || order.fechaIngreso} • Johnny Blaze OS
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 flex -translate-x-1/2 gap-3 print:hidden">
        <button
          onClick={() => setView("detalleOrden")}
          className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-[10px] font-black uppercase shadow-lg active:scale-95"
        >
          Cerrar
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-3xl bg-red-600 px-8 py-4 text-xs font-black uppercase text-white shadow-2xl transition-all active:scale-95"
        >
          <Printer size={16} /> Imprimir / Guardar PDF
        </button>
      </div>
    </div>
  );
}
