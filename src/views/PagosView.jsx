import React, { useMemo } from "react";
import { CreditCard, ArrowRight, CheckCircle } from "lucide-react";
import { calcularResultadosOrden } from "../lib/calc.js";
import { formatMoney } from "../utils/format.js";

export default function PagosView({ orders, bikes, clients, setSelectedOrderId, setView }) {
  const pendientes = useMemo(() => {
    return (orders || [])
      .filter(o => o.estado !== "cerrado_emitido")
      .map(o => {
        const total    = calcularResultadosOrden(o).total;
        const pagado   = (o.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
        const saldo    = total - pagado;
        const bike     = bikes?.find(b => b.id === o.bikeId) || {};
        const cliente  = clients?.find(c => c.id === o.clientId) || {};
        return { ...o, total, pagado, saldo, bike, cliente };
      })
      .filter(o => o.total > 0)
      .sort((a, b) => b.saldo - a.saldo);
  }, [orders, bikes, clients]);

  const cobradoHoy = useMemo(() => {
    const hoy = new Date().toLocaleDateString("sv-SE");
    return (orders || []).flatMap(o => o.pagos || [])
      .filter(p => p.fecha === hoy)
      .reduce((s, p) => s + (p.monto || 0), 0);
  }, [orders]);

  const sinCobrar   = pendientes.filter(o => o.saldo > 0);
  const pagosCompletos = pendientes.filter(o => o.saldo <= 0 && o.estado !== "cerrado_emitido");

  return (
    <div className="p-4 space-y-5 pb-28 text-left animate-in fade-in duration-300">

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-[2.5rem] shadow-xl">
        <p className="text-blue-500 font-black text-xs uppercase tracking-[0.4em] mb-1">Cobros</p>
        <h1 className="text-3xl font-black text-white tracking-tighter leading-none mb-4">Pagos</h1>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl text-center">
            <div className="text-2xl font-black text-yellow-400">{sinCobrar.length}</div>
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">Con saldo</div>
          </div>
          <div className="bg-black/40 border border-white/5 p-4 rounded-2xl text-center">
            <div className="text-xl font-black text-green-400">{formatMoney(cobradoHoy)}</div>
            <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">Cobrado hoy</div>
          </div>
        </div>
      </div>

      {/* Con saldo pendiente */}
      {sinCobrar.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Saldo pendiente</p>
          {sinCobrar.map(o => (
            <button
              key={o.id}
              onClick={() => { setSelectedOrderId(o.id); setView("pagos"); }}
              className="w-full bg-white rounded-[2rem] p-5 flex items-center justify-between shadow-sm border border-slate-100 active:scale-[0.98] transition-all text-left"
            >
              <div>
                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  {o.numeroTrabajo || `#${o.id.slice(-4).toUpperCase()}`}
                </p>
                <p className="text-lg font-black text-slate-900 leading-tight mt-0.5">
                  {o.bike?.patente || "---"}
                </p>
                <p className="text-[10px] font-bold text-slate-500 mt-0.5">{o.cliente?.nombre || "—"}</p>
              </div>
              <div className="text-right flex items-center gap-3">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase">Saldo</p>
                  <p className="text-xl font-black text-red-500">{formatMoney(o.saldo)}</p>
                  {o.pagado > 0 && (
                    <p className="text-[9px] font-bold text-green-600">ya pagó {formatMoney(o.pagado)}</p>
                  )}
                </div>
                <ArrowRight size={18} className="text-slate-300" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagados — listos para emitir comprobante */}
      {pagosCompletos.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Pagado — pendiente comprobante</p>
          {pagosCompletos.map(o => (
            <button
              key={o.id}
              onClick={() => { setSelectedOrderId(o.id); setView("prePdf"); }}
              className="w-full bg-green-50 border border-green-200 rounded-[2rem] p-5 flex items-center justify-between active:scale-[0.98] transition-all text-left"
            >
              <div>
                <p className="text-xs font-black text-green-500 uppercase tracking-widest">
                  {o.numeroTrabajo || `#${o.id.slice(-4).toUpperCase()}`}
                </p>
                <p className="text-base font-black text-slate-800">{o.bike?.patente || "---"}</p>
                <p className="text-[10px] font-bold text-slate-500">{o.cliente?.nombre || "—"}</p>
              </div>
              <div className="text-right flex items-center gap-3">
                <div>
                  <p className="text-[9px] font-black text-green-500 uppercase flex items-center gap-1 justify-end">
                    <CheckCircle size={10} /> Pagado
                  </p>
                  <p className="text-base font-black text-slate-700">{formatMoney(o.total)}</p>
                </div>
                <ArrowRight size={18} className="text-slate-300" />
              </div>
            </button>
          ))}
        </div>
      )}

      {sinCobrar.length === 0 && pagosCompletos.length === 0 && (
        <div className="py-20 text-center">
          <CreditCard size={40} className="text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 font-black uppercase text-[10px] tracking-widest">Sin pagos pendientes</p>
        </div>
      )}
    </div>
  );
}
