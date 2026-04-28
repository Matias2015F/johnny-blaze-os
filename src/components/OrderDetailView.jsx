import React, { useState, useEffect } from "react";
import { ArrowLeft, Wrench, DollarSign, FileText, Truck, Trash2, Edit2, ShieldCheck } from "lucide-react";
import { LS } from "../lib/storage.js";
import { ESTADO_LABEL, ESTADO_CSS, CONFIG_DEFAULT } from "../lib/constants.js";
import { calcularResultadosOrden, calcularNuevoRango, calcularNuevoTotal } from "../lib/calc.js";
import { obtenerAprendizaje } from "../lib/priceLearning.js";
import { iniciarCronometro, pausarCronometro, obtenerTiempoActual, formatTiempo, formatTiempoCorto } from "../lib/timer.js";
import { mensajeBloqueo, mensajePresupuesto, abrirWhatsApp } from "../lib/messages.js";
import { MOTIVOS_BLOQUEO } from "../lib/theme.js";
import { formatMoney } from "../utils/format.js";

// Umbral de alerta cronómetro según complejidad del trabajo
const UMBRAL_ALERTA = { bajo: 0.9, medio: 0.8, alto: 0.7 };
// Cuánto ampliar el rango de presupuesto según complejidad
const RANGO_FACTOR  = { bajo: 1.0, medio: 1.3, alto: 1.5 };

const CRON_MSG = {
  NORMAL:    { texto: "Vas dentro del presupuesto",   color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30" },
  ALERTA:    { texto: "Estás cerca del límite",        color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  BLOQUEADO: { texto: "Te pasaste del presupuesto",    color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
};

export default function OrderDetailView({ order, clients, bikes, setView, showToast, setServiceToEdit }) {
  const [tiempoActual, setTiempoActual] = useState(0);
  const [motivoBloqueo, setMotivoBloqueo] = useState(MOTIVOS_BLOQUEO[0]);
  const [motivoManual, setMotivoManual] = useState("");
  const [maxInput, setMaxInput] = useState("");

  useEffect(() => {
    const id = setInterval(() => setTiempoActual(obtenerTiempoActual(order)), 1000);
    return () => clearInterval(id);
  }, [order]);

  if (!order) return null;

  const b      = bikes.find(x => x.id === order.bikeId)   || {};
  const c      = clients.find(x => x.id === order.clientId) || {};
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const res    = calcularResultadosOrden(order);
  const valorHora = config.valorHoraCliente || 15000;

  // Nivel de riesgo basado en la dificultad de las tareas cargadas
  const dificultades = (order.tareas || []).map(t => t.dificultad || "normal");
  const nivelRiesgo  = dificultades.some(d => d === "complicado" || d === "dificil") ? "alto"
                     : dificultades.every(d => d === "facil")                        ? "bajo"
                     : "medio";

  // Cronómetro — umbral de alerta varía por nivel de riesgo
  const costoActual  = tiempoActual * valorHora;
  const umbralAlerta = UMBRAL_ALERTA[nivelRiesgo];
  const estadoCron   = !order.maxAutorizado ? "NORMAL"
    : costoActual >= order.maxAutorizado                    ? "BLOQUEADO"
    : costoActual >= order.maxAutorizado * umbralAlerta     ? "ALERTA"
    : "NORMAL";
  const cronMsg = CRON_MSG[estadoCron];

  const promedioHoras = (order.tareas || []).reduce((s, t) => {
    const apr = obtenerAprendizaje(t.nombre, b.cilindrada);
    return s + (apr ? apr.promedio : (t.horasBase || 1));
  }, 0) || 1;

  const { nuevoMin, nuevoMax } = calcularNuevoRango({
    tiempoActual,
    costoHora: valorHora,
    promedioHoras,
    desvioHoras: promedioHoras * (nivelRiesgo === "alto" ? 0.5 : 0.3),
  });

  const totalPagado    = (order.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
  const saldoPendiente = res.total - totalPagado;
  const isLocked       = !!order.pdfEntregado;

  // Presupuesto — min/max adaptados al nivel de riesgo
  const presBase       = res.total > 0 ? res.total : Math.round(promedioHoras * valorHora);
  const presMaxDefault = Math.round(presBase * RANGO_FACTOR[nivelRiesgo]);
  const presMax        = Number(maxInput) > 0 ? Number(maxInput) : presMaxDefault;

  // Rentabilidad — color semáforo
  const rentColor = res.rentabilidad >= 30 ? "text-green-700 bg-green-100"
                  : res.rentabilidad >= 15 ? "text-yellow-700 bg-yellow-100"
                  : "text-red-700 bg-red-100";

  const cambiarEstado = (nuevo) => {
    if (isLocked) { showToast("Orden bloqueada (PDF enviado)"); return; }
    LS.updateDoc("ordenes", order.id, { estado: nuevo });
    showToast(`Estado: ${ESTADO_LABEL[nuevo]} ✓`);
  };

  const eliminarItem = (lista, index) => {
    if (isLocked) { showToast("Orden bloqueada"); return; }
    const nuevaLista = [...(order[lista] || [])];
    nuevaLista.splice(index, 1);
    const t = lista === "tareas"    ? nuevaLista : order.tareas;
    const r = lista === "repuestos" ? nuevaLista : order.repuestos;
    const f = lista === "fletes"    ? nuevaLista : order.fletes;
    const i = lista === "insumos" ? nuevaLista : order.insumos;
    const nTotal = calcularNuevoTotal(t, r, f, i);
    LS.updateDoc("ordenes", order.id, { [lista]: nuevaLista, total: nTotal });
    showToast("Eliminado ✓");
  };

  // Un único punto de envío — el mensaje se adapta automáticamente al nivel de riesgo
  const enviarPresupuesto = () => {
    abrirWhatsApp(c.tel, mensajePresupuesto({
      bike: b, client: c,
      tareas: order.tareas,
      min: presBase,
      max: presMax,
      nivel: nivelRiesgo,
    }));
  };

  // Registra la aprobación del cliente y avanza el estado
  const confirmarAprobacion = () => {
    const max = nivelRiesgo === "bajo" ? presBase : presMax;
    LS.updateDoc("ordenes", order.id, { maxAutorizado: max, estado: "aprobacion" });
    showToast(`Aprobado: ${formatMoney(max)} ✓`);
  };

  const handleStart = () => LS.updateDoc("ordenes", order.id, iniciarCronometro(order));
  const handlePause = () => LS.updateDoc("ordenes", order.id, pausarCronometro(order));

  // ── UI ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-100 text-left animate-in slide-in-from-right duration-300 pb-32">

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="bg-slate-900 p-8 text-white">
        <button onClick={() => setView("ordenes")} className="mb-6 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="flex justify-between items-start">
          <div className="text-left">
            <div className="flex items-center gap-3">
              <h2 className="text-4xl font-black tracking-tighter leading-none">{b?.patente || "---"}</h2>
              {isLocked && <ShieldCheck className="text-blue-500" size={24} />}
            </div>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{c?.nombre || "Cliente Desconocido"}</p>
            <div className="mt-3">
              <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${ESTADO_CSS[order.estado]}`}>
                {ESTADO_LABEL[order.estado]}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">
              {res.margen >= 0 ? "Tu ganancia" : "Tu pérdida"}
            </p>
            <p className={`text-2xl font-black tracking-tighter ${res.margen >= 0 ? "text-green-400" : "text-red-400"}`}>
              {res.margen >= 0 ? "+" : "−"}{formatMoney(Math.abs(res.margen))}
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5">{formatMoney(res.total)} cobrado</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">

        {isLocked && (
          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-3xl flex items-center gap-3">
            <div className="bg-blue-500 p-2 rounded-xl text-white"><ShieldCheck size={20} /></div>
            <p className="text-[10px] font-black text-blue-700 uppercase leading-tight">Orden bloqueada — PDF entregado. No se pueden editar tareas ni montos.</p>
          </div>
        )}

        {/* ── RESULTADO FINANCIERO ───────────────────────────────────────────── */}
        <div className="bg-white rounded-[2rem] border-2 border-slate-200 shadow-sm overflow-hidden">

          <div className={`p-5 ${res.margen >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Resultado de esta orden</p>
            <div className="flex items-baseline justify-between">
              <p className={`text-3xl font-black tracking-tighter ${res.margen >= 0 ? "text-green-600" : "text-red-600"}`}>
                {res.margen >= 0 ? "Ganás " : "Perdés "}{formatMoney(Math.abs(res.margen))}
              </p>
              {/* Indicador semáforo de rentabilidad */}
              <span className={`text-sm font-black px-3 py-1 rounded-full ${rentColor}`}>
                {Math.round(res.rentabilidad)}%
              </span>
            </div>
          </div>

          <div className="p-5 space-y-3">

            {/* Totales */}
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <span className="text-sm font-black text-slate-500">Total cobrado</span>
              <span className="text-sm font-black text-slate-900">{formatMoney(res.total)}</span>
            </div>

            {/* Fórmula de ganancia — solo si hay MO */}
            {res.desglose.moCliente > 0 && (
              <div className="bg-slate-50 rounded-2xl p-4 space-y-1.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cómo se calcula tu ganancia</p>
                <p className="text-[11px] font-black text-slate-700">
                  {formatMoney(res.desglose.moCliente)}
                  <span className="text-slate-400 font-bold mx-1">MO cobrada ×</span>
                  {Math.round(res.rentabilidad)}%
                  <span className="text-slate-400 font-bold mx-1">=</span>
                  <span className={res.margen >= 0 ? "text-green-600" : "text-red-600"}>
                    {formatMoney(Math.abs(res.margen))} ganancia
                  </span>
                </p>
              </div>
            )}

            {/* Costos trasladados al cliente */}
            {(res.desglose.repuestosCliente > 0 || res.desglose.fletesCliente > 0 || res.desglose.insumosCliente > 0) && (
              <div className="space-y-1.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Costos trasladados al cliente</p>
                {res.desglose.repuestosCliente > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500">Repuestos</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-700">{formatMoney(res.desglose.repuestosCliente)}</span>
                      <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">al costo</span>
                    </div>
                  </div>
                )}
                {res.desglose.fletesCliente > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500">Fletes</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-700">{formatMoney(res.desglose.fletesCliente)}</span>
                      <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">al costo</span>
                    </div>
                  </div>
                )}
                {res.desglose.insumosCliente > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-bold text-slate-500">Insumos / Terceros</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black text-slate-700">{formatMoney(res.desglose.insumosCliente)}</span>
                      <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">al costo</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Saldo */}
            {saldoPendiente > 0 && (
              <div className="bg-red-50 rounded-2xl p-3 flex justify-between items-center border border-red-100">
                <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Saldo pendiente</span>
                <span className="text-sm font-black text-red-600">{formatMoney(saldoPendiente)}</span>
              </div>
            )}
            {totalPagado > 0 && saldoPendiente <= 0 && (
              <div className="bg-green-50 rounded-2xl p-3 flex justify-between items-center border border-green-100">
                <span className="text-[9px] font-black text-green-600 uppercase tracking-widest">Pagado completo</span>
                <span className="text-sm font-black text-green-600">{formatMoney(totalPagado)} ✓</span>
              </div>
            )}
            {res.sinCostoCargado && res.desglose.repuestosCliente > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3">
                <p className="text-[8px] font-black text-yellow-700 uppercase tracking-wide">⚠️ Repuestos sin precio de costo — la ganancia real puede ser mayor</p>
              </div>
            )}
          </div>
        </div>

        {/* ── BOTONES DE ESTADO ───────────────────────────────────────────────── */}
        {order.estado !== "entregada" && !isLocked && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {order.estado === "diagnostico" && <button onClick={() => cambiarEstado("presupuesto")} className="bg-purple-600 text-white px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Pasar a Presupuesto</button>}
            {order.estado === "presupuesto"  && <button onClick={() => cambiarEstado("aprobacion")} className="bg-yellow-500 text-black px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Esperando Aprobación</button>}
            {order.estado === "aprobacion"   && <button onClick={() => cambiarEstado("reparacion")} className="bg-blue-600 text-white px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Iniciar Reparación</button>}
            {order.estado === "reparacion"   && <button onClick={() => cambiarEstado("finalizada")} className="bg-green-600 text-white px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Finalizar Trabajo</button>}
            {order.estado === "finalizada"   && <button onClick={() => cambiarEstado("entregada")}  className="bg-black text-white px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Marcar Entregado</button>}
          </div>
        )}

        {/* ── PRESUPUESTO ─────────────────────────────────────────────────────── */}
        {order.estado === "presupuesto" && (
          <div className="bg-slate-900 rounded-3xl p-5 space-y-4 border border-slate-700">

            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Presupuesto</p>
              {nivelRiesgo === "bajo" && (
                <span className="bg-green-500/20 border border-green-500/30 text-green-400 text-[9px] font-black px-3 py-1 rounded-full">✓ Precio cerrado</span>
              )}
              {nivelRiesgo === "medio" && (
                <span className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-[9px] font-black px-3 py-1 rounded-full">Rango estimado</span>
              )}
              {nivelRiesgo === "alto" && (
                <span className="bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-black px-3 py-1 rounded-full">⚠ Trabajo complejo</span>
              )}
            </div>

            {/* Precio cerrado — solo para trabajos fáciles */}
            {nivelRiesgo === "bajo" ? (
              <div className="bg-slate-800 rounded-[1.5rem] p-5 text-center space-y-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Precio fijo al cliente</p>
                <p className="text-4xl font-black text-white tracking-tighter">{formatMoney(presBase)}</p>
                <p className="text-[10px] text-green-400 font-bold mt-1">Trabajo predecible — sin incertidumbre</p>
              </div>
            ) : (
              /* Rango — para trabajos normales o complejos */
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Mínimo estimado</p>
                    <p className="text-lg font-black text-green-400">{formatMoney(presBase)}</p>
                  </div>
                  <div className="bg-slate-800 rounded-2xl p-4">
                    <p className="text-[9px] font-black text-slate-500 uppercase mb-1">Máximo autorizado</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm text-slate-500 font-black">$</span>
                      <input
                        type="number"
                        placeholder={String(presMaxDefault)}
                        value={maxInput}
                        onChange={e => setMaxInput(e.target.value)}
                        className="w-full bg-transparent text-lg font-black text-yellow-400 outline-none"
                      />
                    </div>
                  </div>
                </div>
                {nivelRiesgo === "alto" && (
                  <p className="text-[9px] text-red-400 font-bold px-1">
                    ⚠️ Trabajo complejo — el rango es amplio porque pueden aparecer imprevistos. Si superás el máximo, consultás antes de continuar.
                  </p>
                )}
              </div>
            )}

            {/* Un solo botón de envío — el mensaje se genera automáticamente */}
            <button
              onClick={enviarPresupuesto}
              className="w-full bg-green-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              {nivelRiesgo === "bajo" ? "Enviar confirmación por WhatsApp" : "Enviar presupuesto por WhatsApp"}
            </button>

            {/* Un solo botón de aprobación */}
            <button
              onClick={confirmarAprobacion}
              className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              {nivelRiesgo === "bajo"
                ? "Cliente confirmó — iniciar trabajo"
                : `Cliente aprobó hasta ${formatMoney(presMax)} — registrar`}
            </button>
          </div>
        )}

        {/* ── CRONÓMETRO ──────────────────────────────────────────────────────── */}
        {order.estado === "reparacion" && (() => {
          const tiempoMax = order.maxAutorizado > 0 ? order.maxAutorizado / valorHora : 0;
          const pct       = tiempoMax > 0 ? Math.min((costoActual / order.maxAutorizado) * 100, 100) : 0;
          const restante  = Math.max(tiempoMax - tiempoActual, 0);

          return (
            <div className="bg-slate-900 rounded-3xl p-5 space-y-4">

              {order.maxAutorizado > 0 ? (
                <div className={`rounded-2xl p-4 border text-center ${cronMsg.bg}`}>
                  <p className={`text-base font-black ${cronMsg.color}`}>{cronMsg.texto}</p>
                  <p className="text-[10px] text-slate-500 mt-1 font-bold">
                    {formatMoney(costoActual)} acumulado · {tiempoMax > 0 ? `quedan ${formatTiempoCorto(restante)}` : "sin límite"}
                  </p>
                </div>
              ) : (
                <div className="bg-slate-800 rounded-2xl p-4 text-center">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sin límite definido</p>
                  <p className="text-[9px] text-slate-600 mt-1">Definí un máximo para activar el control</p>
                </div>
              )}

              {tiempoMax > 0 && (
                <div className="space-y-2">
                  <div className="bg-slate-700 rounded-full h-5 overflow-hidden">
                    <div
                      className={`h-5 rounded-full transition-all duration-500 ${pct >= 100 ? "bg-red-500" : pct >= umbralAlerta * 100 ? "bg-yellow-400" : "bg-green-500"}`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] font-black text-slate-500">
                    <span>{Math.round(pct)}% usado</span>
                    <span>Máx: {formatMoney(order.maxAutorizado)}</span>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center px-1">
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{formatMoney(valorHora)}/hora</p>
                <p className="text-xl font-black text-white font-mono tracking-widest">{formatTiempo(tiempoActual)}</p>
              </div>

              {estadoCron === "ALERTA" && (
                <button
                  onClick={() => abrirWhatsApp(c.tel, mensajeBloqueo({
                    bike: b, client: c,
                    tareas: order.tareas, repuestos: order.repuestos,
                    motivo: "Trabajo más complejo de lo estimado",
                    costoActual, nuevoMin, nuevoMax,
                  }))}
                  className="w-full bg-yellow-500 text-black py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  ⚠️ Pedir autorización por WhatsApp
                </button>
              )}

              {estadoCron === "BLOQUEADO" && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 space-y-3">
                  <p className="text-red-400 font-black text-[10px] uppercase tracking-wider text-center">⛔ Superaste el máximo — necesitás autorización</p>
                  <select
                    value={motivoBloqueo}
                    onChange={e => setMotivoBloqueo(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white text-xs font-bold rounded-xl p-3 outline-none"
                  >
                    {MOTIVOS_BLOQUEO.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {motivoBloqueo === "Otro (manual)" && (
                    <textarea
                      value={motivoManual}
                      onChange={e => setMotivoManual(e.target.value)}
                      placeholder="Describí el motivo..."
                      className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-xl p-3 outline-none resize-none h-16"
                    />
                  )}
                  <button
                    onClick={() => abrirWhatsApp(c.tel, mensajeBloqueo({
                      bike: b, client: c,
                      tareas: order.tareas, repuestos: order.repuestos,
                      motivo: motivoBloqueo === "Otro (manual)" ? motivoManual : motivoBloqueo,
                      costoActual, nuevoMin, nuevoMax,
                    }))}
                    className="w-full bg-green-600 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Pedir autorización por WhatsApp
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleStart} disabled={order.cronometroActivo}
                  className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${order.cronometroActivo ? "bg-slate-700 text-slate-500" : "bg-green-600 text-white"}`}>
                  ▶ Iniciar
                </button>
                <button onClick={handlePause} disabled={!order.cronometroActivo}
                  className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${!order.cronometroActivo ? "bg-slate-700 text-slate-500" : "bg-blue-500 text-white"}`}>
                  ⏸ Pausar
                </button>
              </div>

              {order.maxAutorizado > 0 && res.costoInterno > order.maxAutorizado * 0.85 && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-3">
                  <p className="text-orange-400 text-[9px] font-black uppercase tracking-wide">
                    ⚠️ Tu costo interno ({formatMoney(res.costoInterno)}) se acerca al máximo autorizado ({formatMoney(order.maxAutorizado)})
                  </p>
                </div>
              )}
            </div>
          );
        })()}

        {/* ── ACCIONES ────────────────────────────────────────────────────────── */}
        <div className="flex justify-center">
          <button onClick={() => setView("prePdf")} className="bg-red-600 text-white px-8 py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center gap-2 active:scale-95 transition-all">
            <FileText size={16} /> Generar PDF
          </button>
        </div>

        {/* ── ÍTEMS DEL TRABAJO ───────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-tighter">Trabajos y Materiales</h3>
            {!isLocked && (
              <button onClick={() => setView("logistica")} className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1 active:scale-90">
                <Truck size={14} /> + Logística
              </button>
            )}
          </div>

          <div className="space-y-2">
            {res.tareasAnalizadas?.map((t, idx) => (
              <div key={idx} className={`flex items-center p-4 rounded-2xl border-2 shadow-sm transition-all ${t.perdida ? "border-red-300 bg-red-50" : "border-slate-100 bg-white"}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-[9px] font-black uppercase tracking-tighter ${t.perdida ? "text-red-600" : "text-blue-500"}`}>
                    {t.perdida ? "⚠️ Baja rentabilidad" : "Mano de Obra"}
                  </p>
                  <p className="text-sm font-black text-slate-800 truncate pr-2 leading-none mt-1 uppercase">{t.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-black mr-1 ${t.perdida ? "text-red-700" : "text-slate-900"}`}>{formatMoney(t.monto)}</p>
                  {!isLocked && (
                    <>
                      <button onClick={() => { setServiceToEdit(t); setView("gestionarTareas"); }} className="p-2.5 text-blue-500 bg-blue-50 rounded-xl active:scale-90"><Edit2 size={16} /></button>
                      <button onClick={() => eliminarItem("tareas", idx)} className="p-2.5 text-red-500 bg-red-50 rounded-xl active:scale-90"><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {order.repuestos?.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-blue-50/30 p-4 rounded-2xl border border-blue-100 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Repuesto</p>
                  <p className="text-sm font-bold text-blue-900 leading-tight uppercase truncate">{t.cantidad > 1 ? `${t.cantidad}x ` : ""}{t.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-blue-600 mr-2">{formatMoney(t.monto * (t.cantidad || 1))}</p>
                  {!isLocked && <button onClick={() => eliminarItem("repuestos", idx)} className="p-2 text-blue-200 active:text-red-500 transition-colors"><Trash2 size={18} /></button>}
                </div>
              </div>
            ))}

            {order.insumos?.filter(i => !i._tareaId).map((t, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-orange-50/30 p-4 rounded-2xl border border-orange-100 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-0.5">Insumo</p>
                  <p className="text-sm font-bold text-orange-900 leading-tight uppercase truncate">{t.nombre}</p>
                </div>
                <p className="text-sm font-black text-orange-600 mr-2">{formatMoney(t.monto)}</p>
              </div>
            ))}

            {order.fletes?.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                <Truck size={14} className="text-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 leading-tight uppercase truncate">{t.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-slate-900 mr-2">{formatMoney(t.monto)}</p>
                  {!isLocked && <button onClick={() => eliminarItem("fletes", idx)} className="p-2 text-slate-300 active:text-red-500 transition-colors"><Trash2 size={18} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ACCIONES INFERIORES ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            disabled={isLocked}
            onClick={() => setView("gestionarTareas")}
            className={`py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${isLocked ? "bg-slate-50 text-slate-300" : "bg-slate-200 text-slate-900"}`}>
            <Wrench size={14} /> Editar Tareas
          </button>
          <button
            onClick={() => setView("pagos")}
            className="bg-green-600 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            <DollarSign size={14} /> Cobrar
          </button>
        </div>

      </div>
    </div>
  );
}
