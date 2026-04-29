import React, { useEffect, useState } from "react";
import { ArrowLeft, DollarSign, Edit2, FileText, ShieldCheck, Trash2, Truck, Wrench } from "lucide-react";
import { LS } from "../lib/storage.js";
import { CONFIG_DEFAULT, ESTADO_CSS, ESTADO_LABEL } from "../lib/constants.js";
import { calcularNuevoRango, calcularNuevoTotal, calcularResultadosOrden } from "../lib/calc.js";
import { obtenerAprendizaje } from "../lib/priceLearning.js";
import {
  detenerCronometro,
  formatTiempo,
  formatTiempoCorto,
  iniciarCronometro,
  obtenerTiempoActual,
  pausarCronometro,
  trabajarSinCronometro,
} from "../lib/timer.js";
import { abrirWhatsApp, mensajeBloqueo, mensajePresupuesto } from "../lib/messages.js";
import { MOTIVOS_BLOQUEO } from "../lib/theme.js";
import { formatMoney } from "../utils/format.js";

const UMBRAL_ALERTA = { bajo: 0.9, medio: 0.8, alto: 0.7 };
const RANGO_FACTOR = { bajo: 1.0, medio: 1.3, alto: 1.5 };

const CRON_MSG = {
  NORMAL: { texto: "Vas dentro del presupuesto", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  ALERTA: { texto: "Estás cerca del límite", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  BLOQUEADO: { texto: "Te pasaste del presupuesto", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

export default function OrderDetailView({ order, clients, bikes, setView, showToast, setServiceToEdit }) {
  const [tiempoActual, setTiempoActual] = useState(0);
  const [motivoBloqueo, setMotivoBloqueo] = useState(MOTIVOS_BLOQUEO[0]);
  const [motivoManual, setMotivoManual] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [ultimoAviso, setUltimoAviso] = useState(0);

  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;

  useEffect(() => {
    const id = setInterval(() => setTiempoActual(obtenerTiempoActual(order)), 1000);
    return () => clearInterval(id);
  }, [order]);

  useEffect(() => {
    if (!order?.cronometroActivo || order?.trabajoSinCronometro) return;
    const cfgCron = config.cronometroAlertas || {};
    const activo = cfgCron.activo ?? true;
    const frecuenciaMin = cfgCron.frecuenciaMin ?? 30;
    if (!activo || frecuenciaMin <= 0) return;

    const minutosActuales = Math.floor(tiempoActual * 60);
    if (minutosActuales === 0 || minutosActuales === ultimoAviso) return;
    if (minutosActuales % frecuenciaMin !== 0) return;

    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.03;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch (e) {
      console.error(e);
    }

    setUltimoAviso(minutosActuales);
  }, [config, order, tiempoActual, ultimoAviso]);

  if (!order) return null;

  const bike = bikes.find((x) => x.id === order.bikeId) || {};
  const client = clients.find((x) => x.id === order.clientId) || {};
  const res = calcularResultadosOrden(order);
  const valorHora = config.valorHoraCliente || 15000;
  const totalPagado = (order.pagos || []).reduce((sum, pago) => sum + (pago.monto || 0), 0);
  const saldoPendiente = res.total - totalPagado;
  const isLocked = !!order.pdfEntregado;
  const trabajoLabel = order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`;

  const dificultades = (order.tareas || []).map((t) => t.dificultad || "normal");
  const nivelRiesgo = dificultades.some((d) => d === "complicado" || d === "dificil")
    ? "alto"
    : dificultades.length > 0 && dificultades.every((d) => d === "facil")
      ? "bajo"
      : "medio";

  const costoActual = tiempoActual * valorHora;
  const umbralAlerta = UMBRAL_ALERTA[nivelRiesgo];
  const estadoCron = !order.maxAutorizado
    ? "NORMAL"
    : costoActual >= order.maxAutorizado
      ? "BLOQUEADO"
      : costoActual >= order.maxAutorizado * umbralAlerta
        ? "ALERTA"
        : "NORMAL";
  const cronMsg = CRON_MSG[estadoCron];

  const promedioHoras = (order.tareas || []).reduce((sum, tarea) => {
    const aprendizaje = obtenerAprendizaje(tarea.nombre, bike.cilindrada);
    return sum + (aprendizaje ? aprendizaje.promedio : tarea.horasBase || 1);
  }, 0) || 1;

  const { nuevoMin, nuevoMax } = calcularNuevoRango({
    tiempoActual,
    costoHora: valorHora,
    promedioHoras,
    desvioHoras: promedioHoras * (nivelRiesgo === "alto" ? 0.5 : 0.3),
  });

  const presBase = res.total > 0 ? res.total : Math.round(promedioHoras * valorHora);
  const presMaxDefault = Math.round(presBase * RANGO_FACTOR[nivelRiesgo]);
  const presMax = Number(maxInput) > 0 ? Number(maxInput) : presMaxDefault;
  const rentColor = res.rentabilidad >= 30 ? "text-green-700 bg-green-100" : res.rentabilidad >= 15 ? "text-yellow-700 bg-yellow-100" : "text-red-700 bg-red-100";

  const estadoPaso = {
    diagnostico: "Siguiente paso: armar presupuesto",
    presupuesto: "Siguiente paso: esperar aprobación",
    aprobacion: "Siguiente paso: iniciar reparación",
    reparacion: "Siguiente paso: dejar listo para cobrar",
    finalizada: "Siguiente paso: registrar pago",
    listo_para_emitir: "Siguiente paso: emitir comprobante",
    cerrado_emitido: "Trabajo cerrado con comprobante emitido",
  }[order.estado] || "Revisá este trabajo";

  const cambiarEstado = (nuevo) => {
    if (isLocked) {
      showToast("No se puede modificar: ya se generó el comprobante");
      return;
    }
    LS.updateDoc("trabajos", order.id, { estado: nuevo });
    showToast(`Estado: ${ESTADO_LABEL[nuevo]} ✓`);
  };

  const accionPrincipal = isLocked
    ? null
    : order.estado === "diagnostico"
      ? { label: "Pasar a presupuesto", action: () => cambiarEstado("presupuesto"), className: "bg-violet-600 text-white" }
      : order.estado === "presupuesto"
        ? { label: "Esperando aprobación", action: () => cambiarEstado("aprobacion"), className: "bg-amber-400 text-slate-950" }
        : order.estado === "aprobacion"
          ? { label: "Iniciar reparación", action: () => cambiarEstado("reparacion"), className: "bg-blue-600 text-white" }
          : order.estado === "reparacion"
            ? { label: "Listo para cobrar", action: () => cambiarEstado("finalizada"), className: "bg-green-600 text-white" }
            : order.estado === "finalizada"
              ? { label: "Ir a cobro", action: () => setView("pagos"), className: "bg-slate-950 text-white" }
              : order.estado === "listo_para_emitir"
                ? { label: "Emitir comprobante", action: () => setView("prePdf"), className: "bg-emerald-600 text-white" }
                : null;

  const eliminarItem = (lista, index) => {
    if (isLocked) {
      showToast("No se puede modificar: ya se generó el comprobante");
      return;
    }
    const nuevaLista = [...(order[lista] || [])];
    nuevaLista.splice(index, 1);
    const tareas = lista === "tareas" ? nuevaLista : order.tareas;
    const repuestos = lista === "repuestos" ? nuevaLista : order.repuestos;
    const fletes = lista === "fletes" ? nuevaLista : order.fletes;
    const insumos = lista === "insumos" ? nuevaLista : order.insumos;
    const total = calcularNuevoTotal(tareas, repuestos, fletes, insumos);
    LS.updateDoc("trabajos", order.id, { [lista]: nuevaLista, total });
    showToast("Eliminado ✓");
  };

  const enviarPresupuesto = () => {
    abrirWhatsApp(client.tel, mensajePresupuesto({
      bike,
      client,
      tareas: order.tareas,
      min: presBase,
      max: presMax,
      nivel: nivelRiesgo,
    }));
  };

  const confirmarAprobacion = () => {
    const max = nivelRiesgo === "bajo" ? presBase : presMax;
    LS.updateDoc("trabajos", order.id, { maxAutorizado: max, estado: "aprobacion" });
    showToast(`Aprobado: ${formatMoney(max)} ✓`);
  };

  const handleStart = () => LS.updateDoc("trabajos", order.id, iniciarCronometro(order));
  const handlePause = () => LS.updateDoc("trabajos", order.id, pausarCronometro(order));
  const handleStop = () => LS.updateDoc("trabajos", order.id, detenerCronometro(order));
  const handleSinCronometro = () => LS.updateDoc("trabajos", order.id, trabajarSinCronometro(order));

  const tiempoMax = order.maxAutorizado > 0 ? order.maxAutorizado / valorHora : 0;
  const pct = tiempoMax > 0 ? Math.min((costoActual / order.maxAutorizado) * 100, 100) : 0;
  const restante = Math.max(tiempoMax - tiempoActual, 0);

  return (
    <div className="min-h-screen bg-slate-100 pb-32 text-left animate-in slide-in-from-right duration-300">
      <div className="bg-slate-900 p-8 text-white">
        <button onClick={() => setView("ordenes")} className="mb-6 flex items-center gap-2 text-xs font-black uppercase text-blue-500 transition-all active:scale-90">
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-4xl font-black leading-none tracking-tighter">{bike?.patente || "---"}</h2>
              {isLocked && <ShieldCheck className="text-blue-500" size={24} />}
            </div>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-blue-400">{trabajoLabel}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">{client?.nombre || "Cliente desconocido"}</p>
            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{estadoPaso}</p>
            <div className="mt-3">
              <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${ESTADO_CSS[order.estado]}`}>
                {ESTADO_LABEL[order.estado]}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">{res.margen >= 0 ? "Tu ganancia" : "Tu pérdida"}</p>
            <p className={`text-2xl font-black tracking-tighter ${res.margen >= 0 ? "text-green-400" : "text-red-400"}`}>
              {res.margen >= 0 ? "+" : "-"}{formatMoney(Math.abs(res.margen))}
            </p>
            <p className="mt-1 text-[9px] text-slate-500">{formatMoney(res.total)} cobrados</p>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-6">
        {isLocked && (
          <div className="flex items-center gap-3 rounded-3xl border-2 border-blue-200 bg-blue-50 p-4">
            <div className="rounded-xl bg-blue-500 p-2 text-white"><ShieldCheck size={20} /></div>
            <p className="text-[10px] font-black uppercase leading-tight text-blue-700">Trabajo cerrado: ya se generó el comprobante. No se pueden editar trabajos ni montos.</p>
          </div>
        )}

        <div className="overflow-hidden rounded-[2rem] border-2 border-slate-200 bg-white shadow-sm">
          <div className={`p-5 ${res.margen >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-[9px] font-black uppercase tracking-widest text-slate-500">Resultado del trabajo</p>
                <p className={`text-3xl font-black tracking-tighter ${res.margen >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {res.margen >= 0 ? "Ganás " : "Perdés "}{formatMoney(Math.abs(res.margen))}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black ${rentColor}`}>
                Margen {Math.round(res.rentabilidad)}%
              </span>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total del trabajo</p>
                <p className="mt-2 text-xl font-black text-slate-950">{formatMoney(res.total)}</p>
              </div>
              <div className={`rounded-2xl p-4 ${saldoPendiente > 0 ? "border border-red-100 bg-red-50" : "border border-green-100 bg-green-50"}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest ${saldoPendiente > 0 ? "text-red-500" : "text-green-600"}`}>
                  {saldoPendiente > 0 ? "Falta cobrar" : "Cobrado completo"}
                </p>
                <p className={`mt-2 text-xl font-black ${saldoPendiente > 0 ? "text-red-600" : "text-green-600"}`}>
                  {formatMoney(saldoPendiente > 0 ? saldoPendiente : totalPagado)}
                </p>
              </div>
            </div>

            {res.desglose.moCliente > 0 && (
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tu ganancia sale de la mano de obra</p>
                <div className="mt-2 space-y-1 text-[12px] font-black leading-relaxed">
                  <p className="text-slate-700">
                    Cobrás <span className="text-slate-950">{formatMoney(res.desglose.moCliente)}</span> de mano de obra.
                  </p>
                  <p className="text-slate-500">
                    Tu costo interno estimado es <span className="text-slate-700">{formatMoney(res.desglose.moCosto)}</span>.
                  </p>
                  <p className={res.desglose.margenMO >= 0 ? "text-green-600" : "text-red-600"}>
                    Te quedan {formatMoney(Math.abs(res.desglose.margenMO))} de ganancia en mano de obra.
                  </p>
                </div>
              </div>
            )}

            {(res.desglose.repuestosCliente > 0 || res.desglose.fletesCliente > 0 || res.desglose.insumosCliente > 0) && (
              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Costos que paga el cliente</p>
                {res.desglose.repuestosCliente > 0 && (
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-[11px] font-black text-slate-600">Repuestos</span>
                    <span className="text-[11px] font-black text-slate-900">{formatMoney(res.desglose.repuestosCliente)}</span>
                  </div>
                )}
                {res.desglose.fletesCliente > 0 && (
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-[11px] font-black text-slate-600">Flete / cadetería</span>
                    <span className="text-[11px] font-black text-slate-900">{formatMoney(res.desglose.fletesCliente)}</span>
                  </div>
                )}
                {res.desglose.insumosCliente > 0 && (
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <span className="text-[11px] font-black text-slate-600">Insumos / terceros</span>
                    <span className="text-[11px] font-black text-slate-900">{formatMoney(res.desglose.insumosCliente)}</span>
                  </div>
                )}
              </div>
            )}

            {res.sinCostoCargado && res.desglose.repuestosCliente > 0 && (
              <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-3">
                <p className="text-[9px] font-black uppercase tracking-wide text-yellow-700">Hay repuestos sin costo cargado. Tu ganancia real puede ser mayor.</p>
              </div>
            )}
          </div>
        </div>

        {order.estado === "presupuesto" && (
          <div className="space-y-4 rounded-3xl border border-slate-700 bg-slate-900 p-5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Presupuesto</p>
              {nivelRiesgo === "bajo" && <span className="rounded-full border border-green-500/30 bg-green-500/20 px-3 py-1 text-[9px] font-black text-green-400">Precio cerrado</span>}
              {nivelRiesgo === "medio" && <span className="rounded-full border border-yellow-500/30 bg-yellow-500/20 px-3 py-1 text-[9px] font-black text-yellow-400">Rango estimado</span>}
              {nivelRiesgo === "alto" && <span className="rounded-full border border-red-500/30 bg-red-500/20 px-3 py-1 text-[9px] font-black text-red-400">Trabajo complejo</span>}
            </div>

            {nivelRiesgo === "bajo" ? (
              <div className="space-y-1 rounded-[1.5rem] bg-slate-800 p-5 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Precio fijo al cliente</p>
                <p className="text-4xl font-black tracking-tighter text-white">{formatMoney(presBase)}</p>
                <p className="mt-1 text-[10px] font-bold text-green-400">Trabajo predecible</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-800 p-4">
                    <p className="mb-1 text-[9px] font-black uppercase text-slate-500">Mínimo estimado</p>
                    <p className="text-lg font-black text-green-400">{formatMoney(presBase)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-800 p-4">
                    <p className="mb-1 text-[9px] font-black uppercase text-slate-500">Máximo autorizado</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black text-slate-500">$</span>
                      <input
                        type="number"
                        placeholder={String(presMaxDefault)}
                        value={maxInput}
                        onChange={(e) => setMaxInput(e.target.value)}
                        className="w-full bg-transparent text-lg font-black text-yellow-400 outline-none"
                      />
                    </div>
                  </div>
                </div>
                {nivelRiesgo === "alto" && (
                  <p className="px-1 text-[9px] font-bold text-red-400">Trabajo complejo: si superás el máximo, consultás antes de seguir.</p>
                )}
              </div>
            )}

            <button onClick={enviarPresupuesto} className="w-full rounded-2xl bg-green-600 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95">
              {nivelRiesgo === "bajo" ? "Enviar confirmación por WhatsApp" : "Enviar presupuesto por WhatsApp"}
            </button>
            <button onClick={confirmarAprobacion} className="w-full rounded-2xl bg-blue-600 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95">
              {nivelRiesgo === "bajo" ? "Cliente confirmó: iniciar trabajo" : `Cliente aprobó hasta ${formatMoney(presMax)}`}
            </button>
          </div>
        )}

        {order.estado === "reparacion" && (
          <div className="space-y-4 rounded-3xl bg-slate-900 p-5">
            {order.maxAutorizado > 0 ? (
              <div className={`rounded-2xl border p-4 text-center ${cronMsg.bg}`}>
                <p className={`text-base font-black ${cronMsg.color}`}>{cronMsg.texto}</p>
                <p className="mt-1 text-[10px] font-bold text-slate-500">
                  {formatMoney(costoActual)} acumulado · {tiempoMax > 0 ? `quedan ${formatTiempoCorto(restante)}` : "sin límite"}
                </p>
              </div>
            ) : (
              <div className="rounded-2xl bg-slate-800 p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sin tope de tiempo aprobado</p>
                <p className="mt-1 text-[9px] text-slate-600">Cuando el cliente apruebe un máximo, el sistema te va a avisar.</p>
              </div>
            )}

            {tiempoMax > 0 && (
              <div className="space-y-2">
                <div className="h-5 overflow-hidden rounded-full bg-slate-700">
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

            <div className="flex items-center justify-between px-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{formatMoney(valorHora)}/hora</p>
              <div className="text-right">
                <p className="font-mono text-xl font-black tracking-widest text-white">{formatTiempo(tiempoActual)}</p>
                {order.trabajoSinCronometro && <p className="mt-1 text-[8px] font-black uppercase text-slate-500">Trabajando sin cronómetro</p>}
              </div>
            </div>

            {estadoCron === "ALERTA" && (
              <button
                onClick={() => abrirWhatsApp(client.tel, mensajeBloqueo({
                  bike,
                  client,
                  tareas: order.tareas,
                  repuestos: order.repuestos,
                  motivo: "Trabajo más complejo de lo estimado",
                  costoActual,
                  nuevoMin,
                  nuevoMax,
                }))}
                className="w-full rounded-2xl bg-yellow-500 py-4 text-[10px] font-black uppercase tracking-widest text-black transition-all active:scale-95"
              >
                Pedir autorización por WhatsApp
              </button>
            )}

            {estadoCron === "BLOQUEADO" && (
              <div className="space-y-3 rounded-2xl border border-red-500/50 bg-red-500/10 p-4">
                <p className="text-center text-[10px] font-black uppercase tracking-wider text-red-400">Superaste el máximo: necesitás autorización</p>
                <select
                  value={motivoBloqueo}
                  onChange={(e) => setMotivoBloqueo(e.target.value)}
                  className="w-full rounded-xl border border-slate-600 bg-slate-800 p-3 text-xs font-bold text-white outline-none"
                >
                  {MOTIVOS_BLOQUEO.map((motivo) => <option key={motivo} value={motivo}>{motivo}</option>)}
                </select>
                {motivoBloqueo === "Otro (manual)" && (
                  <textarea
                    value={motivoManual}
                    onChange={(e) => setMotivoManual(e.target.value)}
                    placeholder="Describí el motivo..."
                    className="h-16 w-full resize-none rounded-xl border border-slate-600 bg-slate-800 p-3 text-xs text-white outline-none"
                  />
                )}
                <button
                  onClick={() => abrirWhatsApp(client.tel, mensajeBloqueo({
                    bike,
                    client,
                    tareas: order.tareas,
                    repuestos: order.repuestos,
                    motivo: motivoBloqueo === "Otro (manual)" ? motivoManual : motivoBloqueo,
                    costoActual,
                    nuevoMin,
                    nuevoMax,
                  }))}
                  className="w-full rounded-2xl bg-green-600 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95"
                >
                  Pedir autorización por WhatsApp
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleStart}
                disabled={order.cronometroActivo}
                className={`rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${order.cronometroActivo ? "bg-slate-700 text-slate-500" : "bg-green-600 text-white"}`}
              >
                Iniciar
              </button>
              <button
                onClick={handlePause}
                disabled={!order.cronometroActivo}
                className={`rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${!order.cronometroActivo ? "bg-slate-700 text-slate-500" : "bg-blue-500 text-white"}`}
              >
                Pausar
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleStop} className="rounded-2xl bg-red-600 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all active:scale-95">
                Stop
              </button>
              <button
                onClick={handleSinCronometro}
                className={`rounded-2xl py-4 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${order.trabajoSinCronometro ? "border border-slate-600 bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-800"}`}
              >
                Sin cronómetro
              </button>
            </div>

            <div className="rounded-2xl bg-slate-800 p-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Alerta sonora</p>
              <p className="mt-1 text-[10px] font-bold text-slate-500">Aviso automático cada {(config.cronometroAlertas?.frecuenciaMin ?? 30)} min mientras el cronómetro está corriendo.</p>
            </div>

            {order.maxAutorizado > 0 && res.costoInterno > order.maxAutorizado * 0.85 && (
              <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-3">
                <p className="text-[9px] font-black uppercase tracking-wide text-orange-400">
                  Tu costo interno ({formatMoney(res.costoInterno)}) se acerca al máximo autorizado ({formatMoney(order.maxAutorizado)})
                </p>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={() => setView(totalPagado >= res.total && res.total > 0 ? "prePdf" : "pagos")}
            className="flex w-full items-center justify-center gap-2 rounded-3xl bg-slate-950 px-8 py-5 text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95"
          >
            <FileText size={16} />
            {totalPagado >= res.total && res.total > 0 ? "Revisar comprobante" : "Ver cobro y saldo"}
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-tighter text-slate-400">Trabajos y materiales</h3>
            {!isLocked && (
              <button onClick={() => setView("logistica")} className="flex items-center gap-1 text-[10px] font-black uppercase text-blue-600 active:scale-90">
                <Truck size={14} /> + Flete / cadetería
              </button>
            )}
          </div>

          <div className="space-y-2">
            {res.tareasAnalizadas?.map((tarea, idx) => (
              <div key={`${tarea.nombre}-${idx}`} className={`flex items-center rounded-2xl border-2 p-4 shadow-sm ${tarea.perdida ? "border-red-300 bg-red-50" : "border-slate-100 bg-white"}`}>
                <div className="min-w-0 flex-1">
                  <p className={`text-[9px] font-black uppercase tracking-tighter ${tarea.perdida ? "text-red-600" : "text-blue-500"}`}>
                    {tarea.perdida ? "Ganancia baja en este trabajo" : "Mano de obra"}
                  </p>
                  <p className="mt-1 truncate pr-2 text-sm font-black uppercase leading-none text-slate-800">{tarea.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`mr-1 text-sm font-black ${tarea.perdida ? "text-red-700" : "text-slate-900"}`}>{formatMoney(tarea.monto)}</p>
                  {!isLocked && (
                    <>
                      <button onClick={() => { setServiceToEdit(tarea); setView("gestionarTareas"); }} className="rounded-xl bg-blue-50 p-2.5 text-blue-500 active:scale-90">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => eliminarItem("tareas", idx)} className="rounded-xl bg-red-50 p-2.5 text-red-500 active:scale-90">
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {order.repuestos?.map((repuesto, idx) => (
              <div key={`${repuesto.nombre}-${idx}`} className="flex items-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/30 p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-blue-400">Repuesto</p>
                  <p className="truncate text-sm font-bold uppercase leading-tight text-blue-900">
                    {repuesto.cantidad > 1 ? `${repuesto.cantidad}x ` : ""}{repuesto.nombre}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="mr-2 text-sm font-black text-blue-600">{formatMoney((repuesto.monto || 0) * (repuesto.cantidad || 1))}</p>
                  {!isLocked && (
                    <button onClick={() => eliminarItem("repuestos", idx)} className="p-2 text-blue-200 transition-colors active:text-red-500">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {order.insumos?.filter((insumo) => !insumo._tareaId).map((insumo, idx) => (
              <div key={`${insumo.nombre}-${idx}`} className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50/30 p-4 shadow-sm">
                <div className="min-w-0 flex-1">
                  <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-orange-400">Insumo</p>
                  <p className="truncate text-sm font-bold uppercase leading-tight text-orange-900">{insumo.nombre}</p>
                </div>
                <p className="mr-2 text-sm font-black text-orange-600">{formatMoney(insumo.monto || 0)}</p>
              </div>
            ))}

            {order.fletes?.map((flete, idx) => (
              <div key={`${flete.nombre}-${idx}`} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <Truck size={14} className="text-slate-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold uppercase leading-tight text-slate-700">{flete.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="mr-2 text-sm font-black text-slate-900">{formatMoney(flete.monto || 0)}</p>
                  {!isLocked && (
                    <button onClick={() => eliminarItem("fletes", idx)} className="p-2 text-slate-300 transition-colors active:text-red-500">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            disabled={isLocked}
            onClick={() => setView("gestionarTareas")}
            className={`flex items-center justify-center gap-2 rounded-3xl py-5 text-[10px] font-black uppercase tracking-widest shadow-sm transition-all active:scale-95 ${isLocked ? "bg-slate-50 text-slate-300" : "bg-slate-200 text-slate-900"}`}
          >
            <Wrench size={14} /> Editar trabajos
          </button>
          <button
            onClick={() => setView("pagos")}
            className="flex items-center justify-center gap-2 rounded-3xl bg-green-600 py-5 text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95"
          >
            <DollarSign size={14} /> Cobrar
          </button>
        </div>

        {!isLocked && accionPrincipal && (
          <div className="rounded-[2rem] border-2 border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Paso actual</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-black leading-none text-slate-950">{ESTADO_LABEL[order.estado]}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-500">{estadoPaso}</p>
              </div>
              <span className={`inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${ESTADO_CSS[order.estado]}`}>
                {ESTADO_LABEL[order.estado]}
              </span>
            </div>
            <button onClick={accionPrincipal.action} className={`mt-4 w-full rounded-2xl py-4 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${accionPrincipal.className}`}>
              {accionPrincipal.label}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
