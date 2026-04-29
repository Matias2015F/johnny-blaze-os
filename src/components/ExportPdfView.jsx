import React, { useEffect } from "react";
import { Printer } from "lucide-react";
import { LS } from "../lib/storage.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { formatMoney } from "../utils/format.js";
import { calcularResultadosOrden } from "../lib/calc.js";

function labelMetodo(metodo = "") {
  const limpio = String(metodo).trim().toLowerCase();
  if (limpio === "mercadopago") return "Mercado Pago";
  if (limpio === "transferencia") return "Transferencia";
  if (limpio === "efectivo") return "Efectivo";
  if (limpio === "debito") return "Debito";
  if (limpio === "credito") return "Credito";
  return metodo || "---";
}

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
    <div className="min-h-screen bg-slate-100 p-0 font-sans text-left text-slate-900 animate-in fade-in">
      <div className="mx-auto max-w-[960px] bg-white shadow-sm print:max-w-none print:shadow-none">
        <div className="flex items-start justify-between gap-6 border-b-4 border-slate-900 p-8">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">
              Constancia de servicio tecnico
            </p>
            <h1 className="mt-2 text-3xl font-black uppercase tracking-tighter">
              {config.nombreTaller}
            </h1>
            <p className="mt-1 text-sm font-bold text-slate-500">
              Documento de entrega y detalle del trabajo realizado
            </p>
            <div className="mt-4 space-y-1 text-[11px] leading-tight text-slate-600">
              <p className="font-black">Tecnico: {config.mecanicoResponsable}</p>
              <p>Sara Romero e/ Eva Peron y Belgrano | Diamante, ER</p>
              <p>WhatsApp: {config.telefonoTaller}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-black uppercase text-blue-500">Comprobante</p>
            <p className="text-2xl font-black tracking-tighter">{numeroComprobante}</p>
            <p className="mt-3 text-[10px] font-black uppercase text-slate-500">
              Trabajo {order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`}
            </p>
            <p className="mt-1 text-xs font-bold uppercase">
              {order.fechaComprobante?.slice(0, 10) || order.fechaIngreso}
            </p>
          </div>
        </div>

        <div className="space-y-8 p-8">
          <div className="grid grid-cols-2 gap-4 print:gap-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cliente</p>
              <p className="mt-2 text-sm font-black uppercase">{client?.nombre || "---"}</p>
              <p className="mt-1 text-xs text-slate-600">{client?.tel || client?.telefono || "---"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Moto</p>
              <p className="mt-2 text-sm font-black uppercase">
                {bike?.marca || ""} {bike?.modelo || ""}
              </p>
              <p className="mt-1 text-xs font-black">
                {bike?.patente || "---"} {kilometraje ? `| ${kilometraje} km` : ""}
              </p>
            </div>
          </div>

          <div className="space-y-4 break-inside-avoid">
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="bg-slate-900 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-white">
                  Trabajos realizados
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {tareas.length > 0 ? tareas.map((t, i) => (
                  <div key={i} className="flex items-start justify-between gap-4 px-4 py-4 text-sm">
                    <div className="min-w-0">
                      <p className="font-black uppercase text-slate-900">{t.nombre}</p>
                      <p className="text-[10px] font-bold uppercase text-slate-400">Mano de obra</p>
                    </div>
                    <p className="shrink-0 font-black text-slate-900">{formatMoney(t.monto || 0)}</p>
                  </div>
                )) : (
                  <p className="px-4 py-4 text-sm font-bold uppercase text-slate-400">
                    Sin trabajos cargados
                  </p>
                )}
              </div>
            </div>

            {repuestos.length > 0 && (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                    Repuestos
                  </p>
                </div>
                <div className="divide-y divide-slate-100">
                  {repuestos.map((r, i) => (
                    <div key={`rep-${i}`} className="flex items-start justify-between gap-4 px-4 py-4 text-sm">
                      <div className="min-w-0">
                        <p className="font-black uppercase text-blue-900">{r.nombre}</p>
                        <p className="text-[10px] font-bold uppercase text-slate-400">
                          Repuesto · {r.cantidad || 1} x {formatMoney(r.monto || 0)}
                        </p>
                      </div>
                      <p className="shrink-0 font-black text-blue-700">
                        {formatMoney((r.monto || 0) * (r.cantidad || 1))}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {pagos.length > 0 && (
            <div className="space-y-3 break-inside-avoid">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Pagos registrados
              </h3>
              <table className="w-full overflow-hidden rounded-2xl border border-slate-200">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase text-slate-400">
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-left">Medio</th>
                    <th className="px-4 py-3 text-left">N° de pago</th>
                    <th className="px-4 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-bold">
                  {pagos.map((p, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="px-4 py-3">{p.fecha}</td>
                      <td className="px-4 py-3 uppercase">{labelMetodo(p.metodo)}</td>
                      <td className="px-4 py-3">{p.comprobante || "---"}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(p.monto || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6 break-inside-avoid">
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Garantia</h4>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] leading-relaxed text-slate-700">
                  {extraData?.garantia || order.garantiaFinal || "Sin texto de garantia cargado."}
                </p>
              </div>
              {proximoControl?.activo && (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                    Proximo control sugerido
                  </p>
                  <p className="mt-2 text-sm font-black uppercase text-slate-900">
                    {proximoControl.descripcion}
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-slate-600">
                    {proximoControl.unidad === "km"
                      ? `Control recomendado a los ${Number(proximoControl.kmObjetivo || 0).toLocaleString("es-AR")} km`
                      : `Control recomendado en ${proximoControl.valorObjetivo} dias`}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Resumen final</h4>
              <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
                <div className="flex justify-between text-xs font-bold uppercase">
                  <span>Total del trabajo</span>
                  <span>{formatMoney(totalOrden)}</span>
                </div>
                {totalPagado > 0 && (
                  <div className="flex justify-between text-xs font-bold uppercase text-green-600">
                    <span>Total pagado</span>
                    <span>{formatMoney(totalPagado)}</span>
                  </div>
                )}
                <div className={`flex justify-between rounded-xl p-3 text-xl font-black ${saldo <= 0 ? "bg-green-600 text-white" : "bg-slate-900 text-white"}`}>
                  <span>{saldo <= 0 ? "Pagado" : "Saldo pendiente"}</span>
                  <span>{formatMoney(Math.max(saldo, 0))}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-200 pt-6 text-[10px] text-slate-500 break-inside-avoid">
            <p className="font-black uppercase">Conformidad</p>
            <p>
              La recepcion de este documento implica conformidad con el trabajo detallado,
              los pagos registrados y la garantia informada.
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
