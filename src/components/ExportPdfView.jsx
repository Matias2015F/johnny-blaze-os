import React from "react";
import { Printer } from "lucide-react";
import { LS } from "../lib/storage.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { formatMoney } from "../utils/format.js";
import { calcularResultadosOrden } from "../lib/calc.js";

export default function ExportPdfView({ order, bike, client, setView, extraData }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const totalPagado = (order.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
  const totalOrden = calcularResultadosOrden(order).total;
  const saldo = totalOrden - totalPagado;

  return (
    <div className="bg-white min-h-screen p-0 font-sans text-slate-900 text-left animate-in fade-in">
      <div className="p-10 border-b-8 border-slate-900 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase mb-1">{config.nombreTaller}</h1>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Constancia de Servicio Técnico</p>
          <div className="mt-4 text-[11px] leading-tight text-slate-600">
            <p className="font-black">Técnico: {config.mecanicoResponsable}</p>
            <p>Sara Romero e/ Eva Perón y Belgrano | Diamante, ER</p>
            <p>WA: {config.telefonoTaller}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-blue-500 uppercase">Orden Única</p>
          <p className="text-5xl font-black tracking-tighter">#{order.id.slice(-4).toUpperCase()}</p>
          <p className="text-xs font-bold mt-2 uppercase">{order.fechaIngreso}</p>
        </div>
      </div>

      <div className="p-10 space-y-8">
        <div className="grid grid-cols-2 gap-8 bg-slate-50 p-4 rounded-xl">
          <div>
            <p className="text-[9px] font-black uppercase text-slate-400">Datos Cliente</p>
            <p className="text-sm font-black uppercase">{client?.nombre}</p>
            <p className="text-xs">{client?.tel}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase text-slate-400">Unidad Intervenida</p>
            <p className="text-sm font-black uppercase">{bike?.marca} {bike?.modelo}</p>
            <p className="text-xs font-black">{bike?.patente} | {order.km || bike?.km} KM</p>
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-slate-900 text-[10px] uppercase font-black text-slate-400">
              <th className="py-2 text-left">Descripción de la Intervención</th>
              <th className="py-2 text-right">Monto</th>
            </tr>
          </thead>
          <tbody className="text-sm font-bold">
            {order.tareas?.map((t, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-4 uppercase">{t.nombre}</td>
                <td className="py-4 text-right">{formatMoney(t.monto)}</td>
              </tr>
            ))}
            {order.repuestos?.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-4 uppercase text-blue-700">{r.cantidad > 1 ? `${r.cantidad}x ` : ""}{r.nombre}</td>
                <td className="py-4 text-right text-blue-700">{formatMoney(r.monto * (r.cantidad || 1))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-1/2 space-y-2 border-t-2 border-slate-900 pt-4">
            <div className="flex justify-between text-xs font-bold uppercase">
              <span>Total Servicio:</span><span>{formatMoney(totalOrden)}</span>
            </div>
            {totalPagado > 0 && (
              <div className="flex justify-between text-xs font-bold text-green-600 uppercase">
                <span>Adelantos Recibidos:</span><span>{formatMoney(totalPagado)}</span>
              </div>
            )}
            <div className={`flex justify-between text-xl font-black p-3 rounded-xl mt-2 ${saldo <= 0 ? "bg-green-600 text-white" : "bg-slate-900 text-white"}`}>
              <span>{saldo <= 0 ? "PAGADO" : "SALDO:"}</span><span>{formatMoney(saldo)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 pt-10 border-t border-slate-200">
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-slate-900">Garantía y Conformidad</h4>
            <div className="text-[10px] text-slate-500 leading-relaxed italic">
              <p>{extraData?.garantia}</p>
              <p className="font-black mt-2">La recepción de este documento implica la aceptación total del trabajo y conformidad con el estado de la unidad.</p>
            </div>
          </div>
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase text-slate-900">Acreditación Profesional</h4>
            <p className="text-[9px] text-slate-400 leading-tight">
              DNI: {config.dniMecanico || "---"} | Formación: Mecánica de Motos (Univ. Popular Elio C. Leyes) — 114 hs Cátedra. Curso de Servicio y Mantenimiento 110cc (Mecánica de la Moto, Bs.As).
            </p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex gap-3 print:hidden">
        <button onClick={() => setView("detalleOrden")} className="bg-slate-100 p-4 rounded-2xl font-black text-[10px] uppercase shadow-lg border border-slate-200 active:scale-95">Cerrar</button>
        <button onClick={() => window.print()} className="bg-red-600 text-white px-8 py-4 rounded-3xl font-black uppercase text-xs shadow-2xl active:scale-95 transition-all flex items-center gap-2">
          <Printer size={16} /> Imprimir / Guardar PDF
        </button>
      </div>
    </div>
  );
}
