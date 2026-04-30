import React, { useState } from "react";
import { ArrowLeft, Check, CreditCard, ReceiptText } from "lucide-react";
import { LS, generateId } from "../lib/storage.js";
import { hoyEstable } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { trackEvent } from "../lib/telemetry.js";
import { formatMoney, parseMonto } from "../utils/format.js";

const METODO_LABEL = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago",
};

export default function PaymentView({ order, setView, showToast }) {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [comprobante, setComprobante] = useState("");

  const totalPagado = (order.pagos || []).reduce((sum, pago) => sum + (pago.monto || 0), 0);
  const totalTrabajo = calcularResultadosOrden(order).total;
  const saldoActual = totalTrabajo - totalPagado;
  const pagoCompleto = saldoActual <= 0;

  const completarTotal = () => setMonto(String(Math.max(saldoActual, 0)));

  const registrar = () => {
    const montoNum = parseMonto(monto);
    if (montoNum <= 0) {
      showToast("Ingresá un monto válido");
      return;
    }

    const nuevoPago = {
      id: generateId(),
      fecha: hoyEstable(),
      monto: montoNum,
      metodo,
      comprobante,
      hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };

    const nuevosPagos = [...(order.pagos || []), nuevoPago];
    const pagadoAcumulado = nuevosPagos.reduce((sum, pago) => sum + pago.monto, 0);
    const saldoRestante = totalTrabajo - pagadoAcumulado;

    LS.updateDoc("trabajos", order.id, {
      pagos: nuevosPagos,
      estado: saldoRestante <= 0 ? "listo_para_emitir" : "finalizada",
    });

    LS.addDoc("caja", {
      fecha: hoyEstable(),
      tipo: "ingreso",
      concepto: `Pago trabajo ${order.numeroTrabajo || order.id.slice(-4).toUpperCase()}`,
      monto: montoNum,
      metodo,
      comprobante,
    });

    trackEvent("registrar_pago", {
      screen: "pagos",
      entityType: "trabajo",
      entityId: order.id,
      metadata: {
        metodo,
        monto: montoNum,
        comprobante,
        saldoRestante: Math.max(saldoRestante, 0),
      },
    }).catch(console.error);

    showToast(saldoRestante <= 0 ? "Pago completo registrado" : `Recibido ${formatMoney(montoNum)}`);
    setMonto("");
    setComprobante("");
  };

  return (
    <div className="animate-in slide-in-from-bottom duration-300 pb-32 text-left">
      <div className="sticky top-0 z-40 rounded-b-[2.5rem] bg-slate-950 px-4 pb-5 pt-4 shadow-lg">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/90 p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView("detalleOrden")}
              className="rounded-2xl border border-white/10 bg-white/5 p-3 text-white transition-all active:scale-90"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Cobro</p>
              <h2 className="mt-1 text-xl font-black uppercase tracking-widest text-white">Pagos del trabajo</h2>
              <p className="mt-1 truncate text-[10px] font-black uppercase tracking-widest text-slate-500">
                {order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 px-4 pt-4">
        <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Saldo actual</p>
          <p className={`mt-3 text-5xl font-black tracking-tighter ${pagoCompleto ? "text-emerald-400" : "text-white"}`}>
            {formatMoney(Math.max(saldoActual, 0))}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[1.5rem] border border-white/5 bg-black/30 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total del trabajo</p>
              <p className="mt-2 text-lg font-black text-white">{formatMoney(totalTrabajo)}</p>
            </div>
            <div className="rounded-[1.5rem] border border-white/5 bg-black/30 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ya cobrado</p>
              <p className="mt-2 text-lg font-black text-emerald-400">{formatMoney(totalPagado)}</p>
            </div>
          </div>

          {!pagoCompleto ? (
            <button
              onClick={completarTotal}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-[1.5rem] bg-emerald-500 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-95"
            >
              <CreditCard size={16} />
              Cliente paga el total
            </button>
          ) : (
            <div className="mt-4 rounded-[1.5rem] border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-emerald-300">Pago completo</p>
              <p className="mt-1 text-[11px] font-bold text-emerald-100">
                Ya podés revisar la garantía y emitir el comprobante final.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Registrar pago</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {["efectivo", "transferencia", "mercadopago"].map((item) => (
              <button
                key={item}
                onClick={() => setMetodo(item)}
                className={`rounded-2xl border px-3 py-3 text-[10px] font-black uppercase tracking-widest transition-all ${
                  metodo === item
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-white/10 bg-black/20 text-slate-400"
                }`}
              >
                {METODO_LABEL[item]}
              </button>
            ))}
          </div>

          <div className="relative mt-4 rounded-[2rem] border border-white/10 bg-black/20 px-4 py-4">
            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black text-blue-400">$</span>
            <input
              type="text"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Ej: 15000"
              className="w-full bg-transparent py-2 pl-6 pr-2 text-3xl font-black text-white outline-none placeholder:text-slate-600"
            />
          </div>

          <input
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value)}
            placeholder="Número de comprobante o referencia"
            className="mt-4 w-full rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
          />

          <button
            onClick={registrar}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-[2rem] bg-white py-5 font-black uppercase tracking-widest text-slate-950 shadow-xl transition-all active:scale-95"
          >
            <Check size={20} />
            Registrar pago
          </button>

          {pagoCompleto && (
            <button
              onClick={() => {
                trackEvent("open_garantia_previa_pdf", {
                  screen: "pagos",
                  entityType: "trabajo",
                  entityId: order.id,
                }).catch(console.error);
                setView("prePdf");
              }}
              className="mt-3 flex w-full items-center justify-center gap-3 rounded-[2rem] bg-blue-600 py-4 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95"
            >
              <ReceiptText size={18} />
              Revisar garantía y emitir comprobante
            </button>
          )}
        </div>

        <div className="rounded-[2.5rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Pagos registrados</p>
          <div className="mt-4 space-y-3">
            {order.pagos?.length > 0 ? (
              order.pagos.map((pago, index) => (
                <div key={index} className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black uppercase tracking-widest text-white">
                        {METODO_LABEL[pago.metodo] || pago.metodo}
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">
                        {pago.fecha} · {pago.hora}
                        {pago.comprobante ? ` · ${pago.comprobante}` : ""}
                      </p>
                    </div>
                    <p className="text-sm font-black text-emerald-400">{formatMoney(pago.monto)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-black/10 px-4 py-8 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Todavía no hay pagos cargados
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
