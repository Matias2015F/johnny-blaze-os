import React, { useState } from "react";
import { ArrowLeft, Check, CreditCard, ReceiptText } from "lucide-react";
import { LS, generateId } from "../lib/storage.js";
import { hoyEstable } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
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

    showToast(saldoRestante <= 0 ? "Pago completo registrado ✓" : `Recibido ${formatMoney(montoNum)}`);
    setMonto("");
    setComprobante("");
  };

  return (
    <div className="animate-in slide-in-from-bottom duration-300 pb-32 text-left">
      <div className="sticky top-0 z-40 rounded-b-[2rem] bg-slate-950 px-4 pb-5 pt-4 shadow-lg">
        <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-black/30 p-5 backdrop-blur-xl">
          <button onClick={() => setView("detalleOrden")} className="rounded-2xl border border-white/5 bg-white/5 p-3 text-white active:scale-90">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-white">Cobro del trabajo</h2>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-4">
        <div className="rounded-[2rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Saldo por cobrar</p>
          <p className={`mt-2 text-5xl font-black tracking-tighter ${pagoCompleto ? "text-green-600" : "text-slate-950"}`}>
            {formatMoney(Math.max(saldoActual, 0))}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total del trabajo</p>
              <p className="mt-2 text-lg font-black text-slate-950">{formatMoney(totalTrabajo)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Ya pagado</p>
              <p className="mt-2 text-lg font-black text-green-600">{formatMoney(totalPagado)}</p>
            </div>
          </div>

          {!pagoCompleto ? (
            <button
              onClick={completarTotal}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50 py-4 text-[11px] font-black uppercase tracking-widest text-green-700 transition-all active:scale-95"
            >
              <CreditCard size={16} />
              Cliente paga el total
            </button>
          ) : (
            <div className="mt-4 rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-green-700">Pago completo registrado</p>
              <p className="mt-1 text-[11px] font-black text-green-600">Ya podés revisar la garantía y emitir el comprobante.</p>
            </div>
          )}
        </div>

        <div className="rounded-[2rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Registrar pago</p>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {["efectivo", "transferencia", "mercadopago"].map((item) => (
              <button
                key={item}
                onClick={() => setMetodo(item)}
                className={`rounded-2xl border-2 py-3 text-[10px] font-black uppercase transition-all ${
                  metodo === item
                    ? "border-blue-500 bg-blue-50 text-blue-600"
                    : "border-slate-100 bg-white text-slate-400"
                }`}
              >
                {METODO_LABEL[item]}
              </button>
            ))}
          </div>

          <div className="relative mt-4">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-black text-slate-400">$</span>
            <input
              type="text"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Ej: 15000"
              className="w-full rounded-3xl border-2 border-slate-100 bg-slate-50 py-5 pl-10 pr-4 text-2xl font-black outline-none focus:border-blue-500"
            />
          </div>

          <input
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value)}
            placeholder="Número de comprobante o referencia"
            className="mt-4 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 p-4 text-xs font-bold outline-none focus:border-blue-500"
          />

          <button
            onClick={registrar}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-3xl bg-slate-950 py-5 font-black uppercase text-white shadow-xl transition-all active:scale-95"
          >
            <Check size={20} />
            Registrar pago
          </button>

          {pagoCompleto && (
            <button
              onClick={() => setView("prePdf")}
              className="mt-3 flex w-full items-center justify-center gap-3 rounded-3xl bg-blue-600 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95"
            >
              <ReceiptText size={18} />
              Revisar garantía y emitir comprobante
            </button>
          )}
        </div>

        <div className="rounded-[2rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pagos registrados</p>
          <div className="mt-4 space-y-2">
            {order.pagos?.length > 0 ? (
              order.pagos.map((pago, index) => (
                <div key={index} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <div>
                    <p className="text-xs font-black uppercase text-slate-700">{METODO_LABEL[pago.metodo] || pago.metodo}</p>
                    <p className="text-[9px] font-bold text-slate-400">
                      {pago.fecha} · {pago.hora}{pago.comprobante ? ` · ${pago.comprobante}` : ""}
                    </p>
                  </div>
                  <p className="text-sm font-black text-green-600">{formatMoney(pago.monto)}</p>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-[10px] font-bold uppercase text-slate-300">Todavía no hay pagos cargados</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
