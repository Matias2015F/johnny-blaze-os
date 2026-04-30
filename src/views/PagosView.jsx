import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle, CreditCard, ReceiptText } from "lucide-react";
import { calcularResultadosOrden } from "../lib/calc.js";
import { formatMoney } from "../utils/format.js";

const FILTROS = [
  { id: "hoy", label: "Hoy" },
  { id: "periodo", label: "Período" },
  { id: "todo", label: "Historial completo" },
];

function normalizarFecha(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function sinCobrarTotal(orders) {
  return orders.filter((order) => order.saldo > 0).reduce((sum, order) => sum + order.saldo, 0);
}

export default function PagosView({ orders, bikes, clients, setSelectedOrderId, setView }) {
  const hoy = new Date().toLocaleDateString("sv-SE");
  const [filtro, setFiltro] = useState("hoy");
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);

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

  const historialPagos = useMemo(() => {
    const pagos = (orders || [])
      .flatMap((order) => {
        const bike = bikes?.find((item) => item.id === order.bikeId) || {};
        const client = clients?.find((item) => item.id === order.clientId) || {};
        return (order.pagos || []).map((pago) => ({
          ...pago,
          orderId: order.id,
          numeroTrabajo: order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`,
          clientName: client?.nombre || "Sin cliente",
          bikePlate: bike?.patente || "---",
          fechaNormalizada: normalizarFecha(pago.fecha),
        }));
      })
      .sort((a, b) => {
        const fechaA = `${a.fechaNormalizada || ""} ${a.hora || ""}`;
        const fechaB = `${b.fechaNormalizada || ""} ${b.hora || ""}`;
        return fechaB.localeCompare(fechaA);
      });

    return pagos.filter((pago) => {
      if (filtro === "todo") return true;
      if (filtro === "hoy") return pago.fechaNormalizada === hoy;
      if (filtro === "periodo") {
        const fecha = pago.fechaNormalizada;
        return !!fecha && fecha >= desde && fecha <= hasta;
      }
      return true;
    });
  }, [orders, bikes, clients, filtro, hoy, desde, hasta]);

  const cobradoHoy = useMemo(() => {
    return historialPagos
      .filter((pago) => pago.fechaNormalizada === hoy)
      .reduce((sum, pago) => sum + (pago.monto || 0), 0);
  }, [historialPagos, hoy]);

  const totalHistorialFiltrado = useMemo(() => {
    return historialPagos.reduce((sum, pago) => sum + (pago.monto || 0), 0);
  }, [historialPagos]);

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
            <p className="mt-2 text-2xl font-black text-emerald-400">{formatMoney(cobradoHoy)}</p>
            <p className="mt-1 text-[10px] font-bold text-slate-500">Ingresos del día</p>
          </div>
        </div>
      </div>

      {sinCobrar.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">Falta cobrar</p>
          {sinCobrar.map((order) => (
            <button
              key={order.id}
              onClick={() => {
                setSelectedOrderId(order.id);
                setView("pagos");
              }}
              className="w-full rounded-[2.5rem] border border-slate-800 bg-slate-900 p-5 text-left shadow-xl transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                    {order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`}
                  </p>
                  <p className="mt-1 text-xl font-black leading-tight text-white">{order.bike?.patente || "---"}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {order.client?.nombre || "—"}
                  </p>
                </div>
                <ArrowRight size={18} className="shrink-0 text-slate-600" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-[1.5rem] border border-white/5 bg-black/20 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Saldo</p>
                  <p className="mt-1 text-lg font-black text-red-400">{formatMoney(order.saldo)}</p>
                </div>
                <div className="rounded-[1.5rem] border border-white/5 bg-black/20 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Ya cobrado</p>
                  <p className="mt-1 text-lg font-black text-emerald-400">{formatMoney(order.pagado)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {pagosCompletos.length > 0 && (
        <div className="space-y-3">
          <p className="px-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Pagado, listo para comprobante
          </p>
          {pagosCompletos.map((order) => (
            <button
              key={order.id}
              onClick={() => {
                setSelectedOrderId(order.id);
                setView("prePdf");
              }}
              className="w-full rounded-[2.5rem] border border-emerald-500/20 bg-emerald-500/10 p-5 text-left transition-all active:scale-[0.98]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-300">
                    {order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`}
                  </p>
                  <p className="mt-1 text-lg font-black text-white">{order.bike?.patente || "---"}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-100/70">
                    {order.client?.nombre || "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="flex items-center justify-end gap-1 text-[9px] font-black uppercase text-emerald-300">
                      <CheckCircle size={10} /> Pagado
                    </p>
                    <p className="mt-1 text-base font-black text-white">{formatMoney(order.total)}</p>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-emerald-200/50" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Historial de pagos</p>
            <p className="mt-1 text-[11px] font-bold text-slate-400">Todos los pagos recibidos y registrados</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total filtrado</p>
            <p className="mt-1 text-lg font-black text-white">{formatMoney(totalHistorialFiltrado)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {FILTROS.map((item) => (
            <button
              key={item.id}
              onClick={() => setFiltro(item.id)}
              className={`rounded-2xl border px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                filtro === item.id
                  ? "border-blue-500 bg-blue-600 text-white"
                  : "border-white/10 bg-black/20 text-slate-400"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {filtro === "periodo" && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Desde</p>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="mt-2 w-full bg-transparent text-sm font-black text-white outline-none"
              />
            </div>
            <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Hasta</p>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="mt-2 w-full bg-transparent text-sm font-black text-white outline-none"
              />
            </div>
          </div>
        )}

        <div className="mt-4 space-y-3">
          {historialPagos.length > 0 ? (
            historialPagos.map((pago) => (
              <div key={pago.id} className="rounded-[1.75rem] border border-white/10 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black uppercase text-white">{pago.clientName}</p>
                    <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-blue-400">{pago.numeroTrabajo}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{pago.bikePlate}</p>
                  </div>
                  <p className="text-lg font-black text-emerald-400">{formatMoney(pago.monto)}</p>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Fecha</p>
                    <p className="mt-1 text-[10px] font-black text-white">{pago.fecha || "—"}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Comprobante</p>
                    <p className="mt-1 text-[10px] font-black text-white">{pago.comprobante || "Sin número"}</p>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-slate-950/70 px-3 py-2">
                    <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">Método</p>
                    <p className="mt-1 text-[10px] font-black capitalize text-white">{pago.metodo || "—"}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-slate-700 bg-black/10 px-4 py-10 text-center">
              <ReceiptText size={36} className="mx-auto mb-3 text-slate-500" />
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No hay pagos para este filtro</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
