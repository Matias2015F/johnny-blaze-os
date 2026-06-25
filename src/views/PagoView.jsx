import React from "react";
import { ArrowLeft } from "lucide-react";
import { formatMoney, formatMoneyParts } from "../utils/format.js";
import { usePagoView } from "../hooks/usePagoView.js";

const METODOS = [
  { value: "efectivo",      label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta",       label: "Tarjeta" },
  { value: "cheque",        label: "Cheque" },
];

export default function PagoView({ ordenId, setView }) {
  const {
    isLoading,
    contexto,
    costoFinal,
    gananciaNeta,
    diferencia,
    puedeConfirmar,
    montoRecibido,  setMontoRecibido,
    metodoPago,     setMetodoPago,
    comprobante,    setComprobante,
    registrarPago,
  } = usePagoView({ ordenId });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-zinc-500 text-xs font-black uppercase">
        Cargando...
      </div>
    );
  }

  const { pesos: pesosCosto, centavos: centavosCosto } = formatMoneyParts(costoFinal);
  const { pesos: pesosGanancia, centavos: centavosGanancia } = formatMoneyParts(gananciaNeta);

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("finalizacion")}
            className="p-3 rounded-2xl bg-zinc-900 border border-white/5 active:scale-95"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
              {contexto.patente} · {contexto.clienteNombre}
            </p>
            <h1 className="text-xl font-black text-white">Registrar cobro</h1>
          </div>
        </div>

        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Lo que tiene que pagar el cliente</p>
          <p className="leading-none">
            <span className="text-[11px] font-bold text-zinc-500">ARS </span>
            <span className="text-4xl font-black text-white">{pesosCosto}</span>
            <span className="text-2xl font-black text-zinc-400">,{centavosCosto}</span>
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Plata recibida ahora</p>
          <div className="flex items-baseline gap-2 rounded-[1.75rem] border border-zinc-700 bg-zinc-900 px-4 py-4">
            <span className="text-xl font-black text-zinc-500">$</span>
            <input
              type="text"
              inputMode="numeric"
              className="w-full bg-transparent text-3xl font-black text-emerald-400 outline-none"
              placeholder={String(costoFinal)}
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value.replace(/\D/g, ""))}
            />
          </div>
          {diferencia > 0 && (
            <p className="text-xs text-emerald-400 font-black px-2">
              Sobra {formatMoney(diferencia)}. Devolvé cambio o registralo aparte.
            </p>
          )}
          {diferencia < 0 && (
            <p className="text-xs text-red-400 font-black px-2">
              Falta {formatMoney(Math.abs(diferencia))}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Como pago</p>
          <div className="grid grid-cols-2 gap-2">
            {METODOS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMetodoPago(m.value)}
                className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                  metodoPago === m.value
                    ? "bg-orange-600 text-white"
                    : "bg-zinc-900 border border-zinc-700 text-zinc-400"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Numero o dato del pago</p>
          <input
            type="text"
            className="w-full bg-zinc-900 border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-orange-600"
            placeholder="Ej: transferencia, alias, recibo o nota"
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value)}
          />
        </div>

        <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Mano de obra para el taller</p>
          <p className="leading-none">
            <span className="text-[11px] font-bold text-emerald-500/60">ARS </span>
            <span className="text-4xl font-black text-emerald-400">{pesosGanancia}</span>
            <span className="text-2xl font-black text-emerald-400/60">,{centavosGanancia}</span>
          </p>
          <p className="text-[10px] text-zinc-500 mt-1">(mano de obra)</p>
        </div>

        <button
          onClick={() => { registrarPago(); setView("retiro"); }}
          disabled={!puedeConfirmar}
          className="w-full rounded-[2rem] bg-orange-600 py-5 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Confirmar cobro y pasar a retiro
        </button>
        <p className="text-center text-[10px] font-bold leading-relaxed text-zinc-500">
          Despues de confirmar, la orden queda cobrada pero falta entregar la moto.
        </p>
      </div>
    </div>
  );
}
