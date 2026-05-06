import React, { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { LS, obtenerOrden, actualizarOrden } from "../lib/storage.js";
import { formatMoney } from "../utils/format.js";

const METODOS = [
  { value: "efectivo", label: "Efectivo" },
  { value: "transferencia", label: "Transferencia" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "cheque", label: "Cheque" },
];

export default function PagoView({ ordenId, setView }) {
  const [orden, setOrden] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [moto, setMoto] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [comprobante, setComprobante] = useState("");

  useEffect(() => {
    const o = obtenerOrden(ordenId);
    if (!o) return;
    setOrden(o);
    setCliente(LS.getDoc("clientes", o.clientId) || {});
    setMoto(LS.getDoc("motos", o.bikeId) || {});
    const costoFinal = o.costoFinal || o.total || 0;
    setMontoRecibido(String(costoFinal));
  }, [ordenId]);

  if (!orden) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center text-slate-500 text-xs font-black uppercase">
        Cargando...
      </div>
    );
  }

  const costoFinal = orden.costoFinal || orden.total || 0;
  const recibido = Number(montoRecibido) || 0;
  const diferencia = recibido - costoFinal;
  const totalManoObra = (orden.tareas || []).reduce((s, t) => s + (t.monto || 0), 0);
  const totalMateriales = [
    ...(orden.repuestos || []),
    ...(orden.insumos || []),
    ...(orden.fletes || []),
  ].reduce((s, i) => s + (i.monto || 0), 0);
  const gananciaNeta = totalManoObra;

  const handleRegistrarPago = () => {
    const pagosActuales = orden.pagos || [];
    actualizarOrden(ordenId, {
      estado: "cerrado_emitido",
      pagado_fecha: Date.now(),
      ganancia: gananciaNeta,
      pagos: [
        ...pagosActuales,
        {
          monto: recibido,
          metodoPago,
          comprobante,
          fecha: Date.now(),
          tipo: "pago_final",
        },
      ],
    });
    setView("retiro");
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("finalizacion")}
            className="p-3 rounded-2xl bg-slate-900 border border-white/5 active:scale-95"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              {moto?.patente} · {cliente?.nombre}
            </p>
            <h1 className="text-xl font-black text-white">Registrar Pago</h1>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Monto a cobrar</p>
          <p className="text-4xl font-black text-white">{formatMoney(costoFinal)}</p>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Monto recibido</p>
          <div className="flex items-baseline gap-2 rounded-[1.75rem] border border-slate-700 bg-slate-900 px-4 py-4">
            <span className="text-xl font-black text-slate-500">$</span>
            <input
              type="number"
              inputMode="numeric"
              className="w-full bg-transparent text-3xl font-black text-emerald-400 outline-none"
              placeholder={String(costoFinal)}
              value={montoRecibido}
              onChange={(e) => setMontoRecibido(e.target.value)}
            />
          </div>
          {diferencia > 0 && (
            <p className="text-xs text-emerald-400 font-black px-2">
              +{formatMoney(diferencia)} cambio
            </p>
          )}
          {diferencia < 0 && (
            <p className="text-xs text-red-400 font-black px-2">
              Falta {formatMoney(Math.abs(diferencia))}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Método de pago</p>
          <div className="grid grid-cols-2 gap-2">
            {METODOS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMetodoPago(m.value)}
                className={`py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 ${
                  metodoPago === m.value
                    ? "bg-blue-600 text-white"
                    : "bg-slate-900 border border-slate-700 text-slate-400"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Comprobante / Referencia</p>
          <input
            type="text"
            className="w-full bg-slate-900 border border-white/5 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-600"
            placeholder="Nro. de recibo o transacción"
            value={comprobante}
            onChange={(e) => setComprobante(e.target.value)}
          />
        </div>

        <div className="rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-5 text-center">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">Tu ganancia neta</p>
          <p className="text-4xl font-black text-emerald-400">{formatMoney(gananciaNeta)}</p>
          <p className="text-[10px] text-slate-500 mt-1">(mano de obra)</p>
        </div>

        <button
          onClick={handleRegistrarPago}
          disabled={recibido < costoFinal}
          className="w-full rounded-[2rem] bg-blue-600 py-5 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ✓ Confirmar Pago y Finalizar
        </button>
      </div>
    </div>
  );
}
