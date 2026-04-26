import React, { useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
import { LS, generateId } from "../lib/storage.js";
import { hoyEstable } from "../lib/constants.js";
import { formatMoney, parseMonto } from "../utils/format.js";

export default function PaymentView({ order, setView, showToast }) {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("efectivo");
  const [comprobante, setComprobante] = useState("");

  const totalPagado = (order.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
  const saldoActual = order.total - totalPagado;

  const registrar = () => {
    const montoNum = parseMonto(monto);
    if (montoNum <= 0) { showToast("Monto inválido"); return; }

    const nuevoPago = {
      id: generateId(),
      fecha: hoyEstable(),
      monto: montoNum,
      metodo,
      comprobante,
      hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
    };
    const nuevosPagos = [...(order.pagos || []), nuevoPago];
    const pagadoAcum = nuevosPagos.reduce((s, p) => s + p.monto, 0);

    LS.updateDoc("ordenes", order.id, {
      pagos: nuevosPagos,
      estado: pagadoAcum >= order.total ? "entregada" : order.estado,
    });
    LS.addDoc("caja", {
      fecha: hoyEstable(),
      tipo: "ingreso",
      concepto: `Entrega Moto: ${order.id.slice(-4).toUpperCase()}`,
      monto: montoNum,
      metodo,
    });

    showToast(`✅ Recibido ${formatMoney(montoNum)}`);
    setMonto("");
    setComprobante("");
  };

  return (
    <div className="p-6 text-left animate-in slide-in-from-bottom duration-300 pb-32">
      <button onClick={() => setView("detalleOrden")} className="mb-6 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
        <ArrowLeft size={16} /> Volver al Trabajo
      </button>
      <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl space-y-6">
        <div className="text-center pb-4 border-b border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Saldo por Cobrar</p>
          <p className="text-5xl font-black text-slate-900 tracking-tighter">{formatMoney(saldoActual)}</p>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {["efectivo", "transferencia", "mercadopago"].map((m) => (
              <button key={m} onClick={() => setMetodo(m)} className={`py-3 rounded-2xl text-[10px] font-black uppercase border-2 transition-all ${metodo === m ? "border-blue-500 bg-blue-50 text-blue-600" : "border-slate-100 text-slate-400"}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xl">$</span>
            <input type="text" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Ej: 15.000" className="w-full pl-10 pr-4 py-5 bg-slate-50 border-2 border-slate-100 rounded-3xl text-2xl font-black outline-none focus:border-blue-500" />
          </div>
          <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="N° Comprobante / Ref (Opcional)" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-xs font-bold outline-none focus:border-blue-500" />
          <button onClick={registrar} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black uppercase shadow-xl flex items-center justify-center gap-3 active:scale-95 transition-all">
            <Check size={20} /> Confirmar Entrega
          </button>
        </div>
        <div className="pt-4">
          <p className="text-[10px] font-black text-slate-400 uppercase mb-3">Entregas realizadas</p>
          <div className="space-y-2">
            {order.pagos?.length > 0 ? (
              order.pagos.map((p, i) => (
                <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-xs font-black text-slate-700 uppercase">{p.metodo}</p>
                    <p className="text-[8px] font-bold text-slate-400">{p.fecha} — {p.hora}</p>
                  </div>
                  <p className="font-black text-green-600">{formatMoney(p.monto)}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-[10px] font-bold text-slate-300 py-4 uppercase">Sin pagos registrados</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
