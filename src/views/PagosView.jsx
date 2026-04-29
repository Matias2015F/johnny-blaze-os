import React, { useMemo } from "react";
import { ArrowRight, CheckCircle, CreditCard } from "lucide-react";
import { calcularResultadosOrden } from "../lib/calc.js";
import { formatMoney } from "../utils/format.js";

export default function PagosView({ orders, bikes, clients, setSelectedOrderId, setView }) {
  const pendientes = useMemo(() => {
    return (orders || [])
      .filter((order) => order.estado !== "cerrado_emitido")
      .map((order) => {
        const total = calcularResultadosOrden(order).total;
        const pagado = (order.pagos || []).reduce((sum, pago) => sum + (pago.monto || 0), 0);
        const saldo = total - pagado;
        const bike = bikes?.find((item) => item.id === order.bikeId) || {};
        const client = clients?.find((item) => item.id === order.clientId) || {};
        return { ...order, total, pagado, saldo, bike, client };
      })
      .filter((order) => order.total > 0)
      .sort((a, b) => b.saldo - a.saldo);
  }, [orders, bikes, clients]);

  const cobradoHoy = useMemo(() => {
    const hoy = new Date().toLocaleDateString("sv-SE");
    return (orders || [])
      .flatMap((order) => order.pagos || [])
      .filter((pago) => pago.fecha === hoy)
      .reduce((sum, pago) => sum + (pago.monto || 0), 0);
  }, [orders]);

  const saldoPendienteTotal = sinCobrarTotal(pendientes);
  const sinCobrar = pendientes.filter((order) => order.saldo > 0);
  const pagosCompletos = pendientes.filter((order) => order.saldo <= 0 && order.estado !== "cerrado_emitido");

  return (
    <div className="space-y-5 p-4 pb-28 text-left animate-in fade-in duration-300">
      <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900 p-6 shadow-xl">
        <p className="mb-1 text-xs font-black uppercase tracking-[0.4em] text-blue-500">Cobros</p>
        <h1 className="mb-4 text-3xl font-black leading-none tracking-tighter text-white">Pagos</h1>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/5 bg-black/40 p-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Trabajos con saldo</p>
            <p className="mt-2 text-2xl font-black text-yellow-400">{sinCobrar.length}</p>
            <p className="mt-1 text-[10px] font-bold text-slate-500">{formatMoney(saldoPendienteTotal)} pendientes</p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-black/40 p-4">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cobrado hoy</p>
            <p className="mt-2 text-2xl font-black text-green-400">{formatMoney(cobradoHoy)}</p>
            <p className="mt-1 text-[10px] font-bold text-slate-500">Ingresos del día</p>
          </div>
        </div>
      </div>

      {sinCobrar.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Falta cobrar</p>
          {sinCobrar.map((order) => (
            <button
              key={order.id}
              onClick={() => {
                setSelectedOrderId(order.id);
                setView("pagos");
              }}
              className="w-full rounded-[2rem] border border-slate-100 bg-white p-5 text-left shadow-sm transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                    {order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`}
                  </p>
                  <p className="mt-1 text-xl font-black leading-tight text-slate-900">{order.bike?.patente || "---"}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{order.client?.nombre || "—"}</p>
                </div>
                <ArrowRight size={18} className="shrink-0 text-slate-300" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Saldo</p>
                  <p className="mt-1 text-lg font-black text-red-500">{formatMoney(order.saldo)}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ya pagado</p>
                  <p className="mt-1 text-lg font-black text-green-600">{formatMoney(order.pagado)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {pagosCompletos.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Pagado, listo para comprobante</p>
          {pagosCompletos.map((order) => (
            <button
              key={order.id}
              onClick={() => {
                setSelectedOrderId(order.id);
                setView("prePdf");
              }}
              className="w-full rounded-[2rem] border border-green-200 bg-green-50 p-5 text-left transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-green-500">
                    {order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`}
                  </p>
                  <p className="mt-1 text-lg font-black text-slate-900">{order.bike?.patente || "---"}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{order.client?.nombre || "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="flex items-center justify-end gap-1 text-[9px] font-black uppercase text-green-500">
                      <CheckCircle size={10} /> Pagado
                    </p>
                    <p className="mt-1 text-base font-black text-slate-700">{formatMoney(order.total)}</p>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-slate-300" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {sinCobrar.length === 0 && pagosCompletos.length === 0 && (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white px-6 py-20 text-center shadow-sm">
          <CreditCard size={40} className="mx-auto mb-4 text-slate-600" />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sin pagos pendientes</p>
        </div>
      )}
    </div>
  );
}

function sinCobrarTotal(orders) {
  return orders.filter((order) => order.saldo > 0).reduce((sum, order) => sum + order.saldo, 0);
}
