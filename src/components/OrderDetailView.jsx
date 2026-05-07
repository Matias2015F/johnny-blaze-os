import React, { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ClipboardList, DollarSign, Edit2, FileText, Play, Send, ShieldCheck, ThumbsUp, Trash2, Truck, Wrench, X } from "lucide-react";
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
import { abrirWhatsApp, generarMensajePresupuestoConDatos, mensajeBloqueo, mensajePresupuesto } from "../lib/messages.js";
import { trackEvent } from "../lib/telemetry.js";
import { MOTIVOS_BLOQUEO } from "../lib/theme.js";
import { formatMoney } from "../utils/format.js";

const UMBRAL_ALERTA = { bajo: 0.9, medio: 0.8, alto: 0.7 };
const RANGO_FACTOR = { bajo: 1.0, medio: 1.3, alto: 1.5 };

const CRON_MSG = {
  NORMAL: { texto: "Vas dentro del presupuesto", color: "text-green-400", bg: "bg-green-500/10 border-green-500/30" },
  ALERTA: { texto: "Estás cerca del límite", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  BLOQUEADO: { texto: "Te pasaste del presupuesto", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30" },
};

const STEP_UI = [
  { id: "diagnostico", label: "Diag.", icon: ClipboardList },
  { id: "presupuesto", label: "Presup.", icon: Wrench },
  { id: "aprobacion", label: "Aprobado", icon: ThumbsUp },
  { id: "reparacion", label: "En curso", icon: Play },
  { id: "finalizada", label: "Cobro", icon: DollarSign },
  { id: "listo_para_emitir", label: "PDF", icon: Send },
  { id: "cerrado_emitido", label: "Cerrado", icon: FileText },
];

export default function OrderDetailView({ order, clients, bikes, setView, showToast, setServiceToEdit }) {
  const [tiempoActual, setTiempoActual] = useState(0);
  const [motivoBloqueo, setMotivoBloqueo] = useState(MOTIVOS_BLOQUEO[0]);
  const [motivoManual, setMotivoManual] = useState("");
  const [maxInput, setMaxInput] = useState("");
  const [ultimoAviso, setUltimoAviso] = useState(0);
  const [editingClient, setEditingClient] = useState(false);
  const [clientNombre, setClientNombre] = useState("");
  const [clientTel, setClientTel] = useState("");
  const [showPresupuestoSheet, setShowPresupuestoSheet] = useState(false);
  const [presupuestoSent, setPresupuestoSent] = useState(false);
  const [sheetAdelantoPct, setSheetAdelantoPct] = useState(30);
  const [sheetIncluirDatos, setSheetIncluirDatos] = useState(true);
  const [sheetMensaje, setSheetMensaje] = useState("");
  const [sheetEditando, setSheetEditando] = useState(false);
  const [sheetPreview, setSheetPreview] = useState(false);
  const [sheetTipoFijo, setSheetTipoFijo] = useState(false);

  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;

  useEffect(() => {
    const id = setInterval(() => setTiempoActual(obtenerTiempoActual(order)), 1000);
    return () => clearInterval(id);
  }, [order]);

  useEffect(() => {
    if (!order?.id) return;
    trackEvent("open_detalle_trabajo", {
      screen: "detalleOrden",
      entityType: "trabajo",
      entityId: order.id,
      metadata: { estado: order.estado || "" },
    }).catch(console.error);
  }, [order?.id]);

  const guardarCliente = () => {
    if (!client?.id) return;
    LS.updateDoc("clientes", client.id, {
      nombre: clientNombre || client.nombre,
      tel: clientTel || client.tel,
      telefono: clientTel || client.telefono || client.tel,
      whatsapp: clientTel || client.whatsapp || client.tel,
    });
    setEditingClient(false);
    showToast("Cliente actualizado");
  };

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

  // Sincronizar datos del cliente cuando cambia
  useEffect(() => {
    if (client?.nombre) setClientNombre(client.nombre);
    if (client?.tel) setClientTel(client.tel);
  }, [client?.id]);
  const currentStepIndex = Math.max(STEP_UI.findIndex((step) => step.id === order.estado), 0);

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
  const presupuestoEditable = Number(maxInput) > 0 ? Number(maxInput) : presBase;
  const estadoPaso = {
    diagnostico: "Siguiente paso: armar presupuesto",
    presupuesto: "Siguiente paso: esperar aprobación",
    aprobacion: "Siguiente paso: iniciar reparación",
    reparacion: "Siguiente paso: dejar listo para cobrar",
    finalizada: "Siguiente paso: registrar pago",
    listo_para_emitir: "Siguiente paso: emitir comprobante",
    cerrado_emitido: "Trabajo cerrado con comprobante emitido",
  }[order.estado] || "Revisá este trabajo";

  const presupuestoMinSheet = nivelRiesgo === "bajo"
    ? presupuestoEditable
    : Math.min(presupuestoEditable, Math.max(presBase, Math.round(nuevoMin)));
  const presupuestoMaxSheet = nivelRiesgo === "bajo"
    ? presupuestoEditable
    : Math.max(presupuestoEditable, Math.round(nuevoMax));

  const nivelEfectivo = sheetTipoFijo ? "bajo" : nivelRiesgo;

  const mensajeAutoSheet = generarMensajePresupuestoConDatos({
    client,
    bike,
    total: res.total || presupuestoEditable,
    min: presupuestoMinSheet,
    max: presupuestoMaxSheet,
    nivel: nivelEfectivo,
    adelantoPct: sheetAdelantoPct,
    incluirDatos: sheetIncluirDatos,
    datosCobro: config.datosCobro || {},
    nombreTaller: config.nombreTaller,
  });

  const abrirSheet = () => {
    const autoFijo = presupuestoMinSheet === presupuestoMaxSheet;
    setSheetTipoFijo(autoFijo);
    setSheetAdelantoPct(config.presupuestoConfig?.adelantoPct ?? 30);
    setSheetIncluirDatos(config.presupuestoConfig?.incluirAlias !== false);
    setSheetMensaje("");
    setSheetEditando(false);
    setSheetPreview(false);
    setShowPresupuestoSheet(true);
  };

  const handleEnviarDesdeSheet = () => {
    const msg = sheetEditando && sheetMensaje ? sheetMensaje : mensajeAutoSheet;
    abrirWhatsApp(client.tel, msg);
    trackEvent("enviar_presupuesto_whatsapp", {
      screen: "detalleOrden",
      entityType: "trabajo",
      entityId: order.id,
      metadata: { adelantoPct: sheetAdelantoPct, tipoPresupuesto: sheetTipoFijo ? "fijo" : "estimado" },
    }).catch(console.error);
    LS.updateDoc("trabajos", order.id, { tipoPresupuesto: sheetTipoFijo ? "fijo" : "estimado" });
    cambiarEstado("aprobacion");
    setPresupuestoSent(true);
    setShowPresupuestoSheet(false);
  };

  const cambiarEstado = (nuevo) => {
    if (isLocked) {
      showToast("No se puede modificar: ya se generó el comprobante");
      return;
    }
    LS.updateDoc("trabajos", order.id, { estado: nuevo });
    showToast(`Estado: ${ESTADO_LABEL[nuevo]} OK`);
  };

  const accionPrincipal = isLocked
    ? { label: "Ver / reimprimir comprobante", action: () => setView("imprimirOrden"), className: "bg-slate-700 text-white" }
    : order.estado === "diagnostico"
      ? { label: "Pasar a presupuesto", action: () => cambiarEstado("presupuesto"), className: "bg-violet-600 text-white" }
      : order.estado === "presupuesto"
        ? presupuestoSent
          ? { label: "✓ Presupuesto enviado", action: abrirSheet, className: "bg-emerald-600 text-white" }
          : { label: "Enviar presupuesto", action: abrirSheet, className: "bg-amber-400 text-slate-950" }
        : order.estado === "aprobacion"
          ? { label: "Iniciar reparación", action: () => setView("ejecucion"), className: "bg-blue-600 text-white" }
          : order.estado === "reparacion"
            ? { label: "Continuar ejecución", action: () => setView("ejecucion"), className: "bg-blue-600 text-white" }
            : order.estado === "finalizada"
              ? { label: "Finalizar trabajo", action: () => setView("finalizacion"), className: "bg-orange-600 text-white" }
              : order.estado === "listo_para_emitir"
                ? { label: "Registrar cobro", action: () => setView("pago"), className: "bg-green-600 text-white" }
                : order.estado === "cerrado_emitido"
                  ? { label: "Emitir comprobante", action: () => setView("prePdf"), className: "bg-blue-600 text-white" }
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
    showToast("Eliminado OK");
  };

  const enviarPresupuesto = () => {
    const presupuestoMinimo = nivelRiesgo === "bajo"
      ? presupuestoEditable
      : Math.min(presupuestoEditable, Math.max(presBase, Math.round(nuevoMin)));
    const presupuestoMaximo = nivelRiesgo === "bajo"
      ? presupuestoEditable
      : Math.max(presupuestoEditable, Math.round(nuevoMax));
    trackEvent("enviar_presupuesto_whatsapp", {
      screen: "detalleOrden",
      entityType: "trabajo",
      entityId: order.id,
      metadata: { min: presupuestoMinimo, max: presupuestoMaximo, nivel: nivelRiesgo },
    }).catch(console.error);
    abrirWhatsApp(client.tel, mensajePresupuesto({
      bike,
      client,
      tareas: order.tareas,
      min: presupuestoMinimo,
      max: presupuestoMaximo,
      nivel: nivelRiesgo,
    }));
  };

  const confirmarAprobacion = () => {
    const max = presupuestoEditable;
    trackEvent("confirmar_aprobacion", {
      screen: "detalleOrden",
      entityType: "trabajo",
      entityId: order.id,
      metadata: { monto: max },
    }).catch(console.error);
    LS.updateDoc("trabajos", order.id, { maxAutorizado: max, estado: "aprobacion" });
    showToast(`Aprobado: ${formatMoney(max)} OK`);
  };

  const handleStart = () => LS.updateDoc("trabajos", order.id, iniciarCronometro(order));
  const handlePause = () => LS.updateDoc("trabajos", order.id, pausarCronometro(order));
  const handleStop = () => LS.updateDoc("trabajos", order.id, detenerCronometro(order));
  const handleSinCronometro = () => LS.updateDoc("trabajos", order.id, trabajarSinCronometro(order));

  const ejecutarPaso = (idx) => {
    if (isLocked) return;
    const pasoId = STEP_UI[idx]?.id;

    if (idx < currentStepIndex) {
      cambiarEstado(pasoId);
      showToast(`Volviendo a ${ESTADO_LABEL[pasoId]}`);
      return;
    }
    if (idx === currentStepIndex || idx === currentStepIndex + 1) {
      if (!accionPrincipal) return;
      accionPrincipal.action();
      return;
    }
    showToast("Ese paso todavía no corresponde");
  };

  const tiempoMax = order.maxAutorizado > 0 ? order.maxAutorizado / valorHora : 0;
  const pct = tiempoMax > 0 ? Math.min((costoActual / order.maxAutorizado) * 100, 100) : 0;
  const restante = Math.max(tiempoMax - tiempoActual, 0);

  return (
    <div className="min-h-screen bg-slate-950 pb-32 text-left text-slate-100 animate-in slide-in-from-right duration-300">
      <div className="bg-gradient-to-b from-slate-800 to-slate-900 px-5 pb-8 pt-5 text-white shadow-2xl">
        <div className="mx-auto max-w-[440px]">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setView("ordenes")} className="rounded-2xl border-2 border-blue-500/50 bg-blue-600/20 p-3 text-blue-300 hover:text-blue-100 hover:bg-blue-600/40 shadow-lg backdrop-blur transition-all active:scale-90">
              <ArrowLeft size={22} />
            </button>
            <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-lg ${ESTADO_CSS[order.estado]}`}>
              {ESTADO_LABEL[order.estado]}
            </div>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-4xl font-black leading-none tracking-tighter uppercase">{bike?.patente || "---"}</h2>
                {isLocked && <ShieldCheck className="text-blue-400" size={22} />}
              </div>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.25em] text-blue-400">{trabajoLabel}</p>

              {editingClient ? (
                <div className="mt-3 space-y-2 rounded-2xl bg-slate-800/50 p-3 border border-slate-700">
                  <input
                    type="text"
                    value={clientNombre}
                    onChange={e => setClientNombre(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="w-full bg-black/60 text-white text-sm px-3 py-2 rounded-lg border border-white/10 focus:border-blue-500 outline-none"
                  />
                  <input
                    type="tel"
                    value={clientTel}
                    onChange={e => setClientTel(e.target.value)}
                    placeholder="Teléfono"
                    className="w-full bg-black/60 text-white text-sm px-3 py-2 rounded-lg border border-white/10 focus:border-blue-500 outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={guardarCliente}
                      className="flex-1 bg-blue-600 text-white text-xs font-black py-2 rounded-lg hover:bg-blue-500 active:scale-95"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingClient(false)}
                      className="flex-1 bg-slate-700 text-slate-200 text-xs font-black py-2 rounded-lg hover:bg-slate-600 active:scale-95"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditingClient(true)}
                  className="mt-2 text-left w-full group"
                >
                  <p className="text-sm font-black uppercase tracking-tight text-slate-300 group-hover:text-blue-400 transition-colors">{clientNombre || "Cliente desconocido"}</p>
                  <p className="text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors">{clientTel || "Sin teléfono"}</p>
                </button>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ganancia</p>
              <div className="rounded-[1.5rem] border border-emerald-400/20 bg-slate-950/50 px-4 py-3 shadow-xl backdrop-blur">
                <p className="text-3xl font-black leading-none tracking-tighter text-emerald-400">{formatMoney(res.desglose.moCliente)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-700/50 pt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{estadoPaso}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{bike?.marca || ""} {bike?.modelo || ""}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[440px] px-4 py-6 space-y-6">
        {/* Progreso visual */}
        <div className="relative z-10 -mt-4 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {STEP_UI.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = idx === currentStepIndex;
            const isDone = idx < currentStepIndex || (isLocked && step.id === "cerrado_emitido");
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => ejecutarPaso(idx)}
                disabled={isLocked || !accionPrincipal}
                title={idx === currentStepIndex || idx === currentStepIndex + 1 ? accionPrincipal?.label : step.label}
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[1.25rem] border transition-all shadow-lg ${
                  isCurrent
                    ? "scale-105 border-blue-400 bg-blue-600 text-white shadow-blue-500/40"
                    : isDone
                      ? "border-emerald-400 bg-emerald-500 text-white"
                      : "border-slate-800 bg-slate-900 text-slate-500"
                }`}
              >
                {isDone ? <CheckCircle2 size={18} /> : <Icon size={16} />}
              </button>
            );
          })}
        </div>
        {/* Espaciador */}
        <div className="h-6" />

        {isLocked && (
          <div className="flex items-center gap-3 rounded-[2rem] border border-blue-500/20 bg-blue-500/10 p-4 shadow-lg backdrop-blur">
            <div className="rounded-xl bg-blue-500 p-2 text-white"><ShieldCheck size={20} /></div>
            <p className="text-[10px] font-black uppercase leading-tight text-blue-200">Trabajo cerrado: ya se emitió comprobante.</p>
          </div>
        )}

        {accionPrincipal && (
          <button
            onClick={accionPrincipal.action}
            className={`w-full rounded-[1.75rem] py-4 text-[11px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${accionPrincipal.className}`}
          >
            {accionPrincipal.label}
          </button>
        )}
      </div>

      {showPresupuestoSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPresupuestoSheet(false)} />
          <div className="relative w-full max-h-[92vh] overflow-y-auto rounded-t-[2rem] bg-slate-900 border-t border-slate-700 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto max-w-[440px] p-6 space-y-5">

              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Enviar Presupuesto</h3>
                <button onClick={() => setShowPresupuestoSheet(false)} className="rounded-xl bg-slate-800 p-2 text-slate-400 hover:text-white active:scale-90 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="rounded-2xl bg-slate-800/50 border border-slate-700 p-4">
                <p className="text-sm font-black text-white">{client.nombre || "Cliente"}</p>
                <p className="text-xs text-slate-400">{bike.marca || ""} {bike.modelo || ""} {bike.patente ? `— ${bike.patente}` : ""}</p>
              </div>

              <div className="text-center py-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  {sheetTipoFijo ? "Total fijo" : "Presupuesto estimado"}
                </p>
                <p className="text-5xl font-black text-white mt-1">{formatMoney(res.total || presupuestoEditable)}</p>
                {!sheetTipoFijo && presupuestoMinSheet !== presupuestoMaxSheet && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Rango: {formatMoney(presupuestoMinSheet)} – {formatMoney(presupuestoMaxSheet)}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {[{ label: "Fijo", val: true }, { label: "Estimado", val: false }].map(({ label, val }) => (
                  <button
                    key={label}
                    onClick={() => setSheetTipoFijo(val)}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                      sheetTipoFijo === val
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                        : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Adelanto</p>
                <div className="flex gap-2">
                  {[0, 25, 30, 50, 70].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setSheetAdelantoPct(pct)}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                        sheetAdelantoPct === pct
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                          : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                {sheetAdelantoPct > 0 && (
                  <p className="mt-2 text-center text-sm font-black text-blue-400">
                    Monto: {formatMoney(Math.round((res.total || presupuestoEditable) * (sheetAdelantoPct / 100)))}
                  </p>
                )}
              </div>

              <button
                onClick={() => setSheetIncluirDatos((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl bg-slate-800/50 border border-slate-700 p-4 active:scale-95 transition-all"
              >
                <span className="text-sm font-black text-slate-300">Incluir datos de transferencia</span>
                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${sheetIncluirDatos ? "border-blue-500 bg-blue-600" : "border-slate-600 bg-transparent"}`}>
                  {sheetIncluirDatos && <CheckCircle2 size={12} className="text-white" />}
                </div>
              </button>

              <div className="rounded-2xl bg-slate-800/50 border border-slate-700 overflow-hidden">
                <button
                  onClick={() => setSheetPreview((v) => !v)}
                  className="flex w-full items-center justify-between p-4"
                >
                  <span className="text-xs font-black uppercase tracking-widest text-slate-400">Vista previa</span>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform duration-200 ${sheetPreview ? "rotate-180" : ""}`} />
                </button>
                {sheetPreview && (
                  sheetEditando ? (
                    <div className="px-4 pb-4">
                      <textarea
                        value={sheetMensaje}
                        onChange={(e) => setSheetMensaje(e.target.value)}
                        rows={10}
                        className="w-full bg-slate-900 text-slate-200 text-xs rounded-xl p-3 border border-slate-600 focus:border-blue-500 outline-none resize-none font-mono leading-relaxed"
                      />
                    </div>
                  ) : (
                    <div className="px-4 pb-4">
                      <pre className="whitespace-pre-wrap text-xs text-slate-300 leading-relaxed font-mono">{mensajeAutoSheet}</pre>
                    </div>
                  )
                )}
              </div>

              <div className="flex gap-3 pb-2">
                <button
                  onClick={() => {
                    if (!sheetEditando) {
                      setSheetMensaje(mensajeAutoSheet);
                      setSheetPreview(true);
                    }
                    setSheetEditando((v) => !v);
                  }}
                  className="flex-1 rounded-[1.5rem] border border-slate-600 bg-slate-800 py-4 text-[10px] font-black uppercase tracking-widest text-slate-300 hover:bg-slate-700 active:scale-95 transition-all"
                >
                  {sheetEditando ? "Auto" : "Editar"}
                </button>
                <button
                  onClick={handleEnviarDesdeSheet}
                  className="flex-[2] rounded-[1.5rem] bg-emerald-600 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-xl hover:bg-emerald-500 active:scale-95 transition-all"
                >
                  Enviar por WhatsApp
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

