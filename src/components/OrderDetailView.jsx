import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, Bell, CheckCircle2, ChevronDown, ClipboardList, Clock, DollarSign, FileText, Play, Search, Send, ShieldCheck, ThumbsUp, Wrench, X } from "lucide-react";
import { buscarRepuestosAutocomplete, guardarRepuestoHistorial } from "../lib/storage.js";
import { ESTADO_CSS, ESTADO_LABEL, TEXTO_CIERRE_RECHAZO } from "../lib/constants.js";
import { calcularNuevoRango } from "../lib/calc.js";
import {
  formatTiempo,
  formatTiempoCorto,
  obtenerTiempoActual,
  obtenerTiempoDiagActual,
} from "../lib/timer.js";
import { abrirWhatsApp, mensajesImprevisto } from "../lib/messages.js";
import { trackEvent } from "../lib/telemetry.js";
import { formatMoney, parseMonto } from "../utils/format.js";
import { useOrderDetailView } from "../hooks/useOrderDetailView.js";

const CRON_MSG = {
  NORMAL:    { texto: "Vas dentro del presupuesto",  color: "text-green-400",  bg: "bg-green-500/10 border-green-500/30" },
  ALERTA:    { texto: "Estás cerca del límite",      color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30" },
  BLOQUEADO: { texto: "Te pasaste del presupuesto",  color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
};

const STEP_UI = [
  { id: "diagnostico",           label: "Diag.",       icon: ClipboardList },
  { id: "presupuesto",           label: "Presup.",     icon: Wrench },
  { id: "aprobacion",            label: "Aprobado",    icon: ThumbsUp },
  { id: "reparacion",            label: "En curso",    icon: Play },
  { id: "finalizada",            label: "Cobro",       icon: DollarSign },
  { id: "listo_para_emitir",     label: "PDF",         icon: Send },
  { id: "cobrado_pendiente_retiro", label: "Por retirar", icon: Clock },
  { id: "cerrado_emitido",       label: "Cerrado",     icon: FileText },
];

const UMBRAL_ALERTA = { bajo: 0.9, medio: 0.8, alto: 0.7 };

// ── Editor parcial: repuesto / flete / insumo ───────────────────────────────
function EditarItemSheet({ tipo, datos, cilindrada, onSave, onCancel }) {
  const esFlete      = tipo === "fletes";
  const tipoHistorial = tipo === "repuestos" ? "repuesto" : tipo === "insumos" ? "insumo" : "flete";

  const [form,        setForm]        = useState({ ...datos });
  const [cantidadStr, setCantidadStr] = useState(String(datos.cantidad || 1));
  const [montoStr,    setMontoStr]    = useState(datos.monto > 0 ? String(datos.monto) : "");
  const [busqueda,    setBusqueda]    = useState(datos.nombre || "");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSug,  setMostrarSug]  = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120); }, []);

  const handleBusqueda = (valor) => {
    setBusqueda(valor);
    setForm((f) => ({ ...f, nombre: valor }));
    if (!valor.trim()) { setSugerencias([]); setMostrarSug(false); return; }
    const r = buscarRepuestosAutocomplete(valor, esFlete ? null : cilindrada, tipoHistorial);
    setSugerencias(r);
    setMostrarSug(r.length > 0);
  };

  const seleccionar = (s) => {
    setBusqueda(s.nombre);
    setMontoStr(String(s.precio));
    setForm((f) => ({ ...f, nombre: s.nombre, monto: s.precio }));
    setMostrarSug(false);
  };

  const handleGuardar = () => {
    const nombre = (form.nombre || "").trim();
    if (!nombre || !(form.monto > 0)) return;
    guardarRepuestoHistorial(nombre, form.monto, esFlete ? null : cilindrada, tipoHistorial);
    onSave({ ...form, nombre });
  };

  const totalPreview = (form.monto || 0) * (esFlete ? 1 : form.cantidad || 1);

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-h-[85vh] overflow-y-auto rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto max-w-[440px] p-6 space-y-5">

          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
              Editar {esFlete ? "flete" : tipo === "repuestos" ? "repuesto" : "insumo"}
            </h3>
            <button onClick={onCancel} className="rounded-xl bg-zinc-800 p-2 text-zinc-400 active:scale-95 transition-all">
              <X size={18} />
            </button>
          </div>

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Concepto</label>
            <div className="relative">
              <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
                <Search size={14} className="text-zinc-500 flex-shrink-0" />
                <input
                  ref={inputRef}
                  className="w-full bg-transparent font-black text-white outline-none placeholder:text-zinc-600"
                  placeholder="Nombre..."
                  value={busqueda}
                  onChange={(e) => handleBusqueda(e.target.value)}
                  onBlur={() => setTimeout(() => setMostrarSug(false), 150)}
                  autoComplete="off"
                />
              </div>
              {mostrarSug && sugerencias.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-2xl shadow-xl z-10 max-h-40 overflow-y-auto">
                  {sugerencias.map((s, i) => (
                    <button key={i} onMouseDown={() => seleccionar(s)}
                      className="w-full text-left px-4 py-3 hover:bg-zinc-700 border-b border-zinc-700/40 last:border-0 active:bg-zinc-600">
                      <p className="text-sm font-black text-white">{s.nombre}</p>
                      <p className="text-[10px] text-zinc-400">{formatMoney(s.precio)} · {s.usos || 0} usos</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!esFlete && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Cantidad</label>
              <input
                type="text" inputMode="numeric"
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-black text-white outline-none focus:border-orange-500 transition-colors"
                value={cantidadStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setCantidadStr(v);
                  setForm((f) => ({ ...f, cantidad: Math.max(1, Number(v) || 1) }));
                }}
                onBlur={() => setCantidadStr(String(Math.max(1, Number(cantidadStr) || 1)))}
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">
              {esFlete ? "Monto" : "Precio unitario"}
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
              <span className="font-black text-zinc-400">$</span>
              <input
                type="text" inputMode="numeric"
                className="w-full bg-transparent font-black text-orange-400 outline-none text-right"
                value={montoStr}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "");
                  setMontoStr(v);
                  setForm((f) => ({ ...f, monto: Number(v) || 0 }));
                }}
                placeholder="0"
              />
            </div>
          </div>

          {totalPreview > 0 && (
            <div className="flex justify-between items-center rounded-2xl bg-orange-500/10 border border-orange-500/20 px-4 py-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-300">Total</p>
              <p className="font-black text-orange-300">{formatMoney(totalPreview)}</p>
            </div>
          )}

          <button
            onClick={handleGuardar}
            disabled={!(form.nombre || "").trim() || !(form.monto > 0)}
            className="w-full rounded-2xl bg-orange-600 py-4 font-black uppercase text-white disabled:opacity-40 active:scale-95 transition-all"
          >
            Guardar cambio
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function OrderDetailView({ order, clients, bikes, setView, showToast, setServiceToEdit }) {
  const {
    bike, client, config, kmPresets, res, promedioHoras,
    esCierreRechazo, valorHora, totalPagado, saldoPendiente, isLocked,
    trabajoLabel, detallePresupuesto, totalDetallePresupuesto,
    puedeEditarPresupuesto, currentStepIndex, nivelRiesgo, canApprove,
    presBase, estadoPaso,
    // Actions
    cambiarEstado, guardarCliente, guardarItemEditado, eliminarItem,
    confirmarAprobacion, toggleAprobacion, aprobarTodo,
    startDiag, pauseDiag, cargarDiag,
    startTimer, pauseTimer, stopTimer, sinCronometro,
    guardarProximoControl, quitarProximoControl,
    cerrarPorRechazo, marcarPresupuestoEnviado, buildMensajePresupuesto,
  } = useOrderDetailView({ order, bikes, clients });

  // ── UI state — timer display (browser side effect) ─────────────────────────

  const [tiempoActual, setTiempoActual] = useState(0);
  const [tiempoDiag,   setTiempoDiag]   = useState(0);
  const [ultimoAviso,  setUltimoAviso]  = useState(0);

  // ── UI state — inline client editing ──────────────────────────────────────

  const [editingClient, setEditingClient] = useState(false);
  const [clientNombre,  setClientNombre]  = useState("");
  const [clientTel,     setClientTel]     = useState("");

  // ── UI state — presupuesto sheet ──────────────────────────────────────────

  const [showPresupuestoSheet, setShowPresupuestoSheet] = useState(false);
  const [presupuestoSent,      setPresupuestoSent]      = useState(false);
  const [sheetAdelantoPct,     setSheetAdelantoPct]     = useState(30);
  const [sheetIncluirDatos,    setSheetIncluirDatos]    = useState(true);
  const [sheetMensaje,         setSheetMensaje]         = useState("");
  const [sheetEditando,        setSheetEditando]        = useState(false);
  const [sheetPreview,         setSheetPreview]         = useState(false);
  const [sheetTipoFijo,        setSheetTipoFijo]        = useState(false);
  const [sheetMin,             setSheetMin]             = useState("");
  const [sheetMax,             setSheetMax]             = useState("");

  // ── UI state — sheets y modales ───────────────────────────────────────────

  const [editandoItem,        setEditandoItem]        = useState(null);
  const [localConfirm,        setLocalConfirm]        = useState(null);
  const [showImprevistoSheet, setShowImprevistoSheet] = useState(false);
  const [imprevistoTexto,     setImprevistoTexto]     = useState("");
  const [showRechazoSheet,    setShowRechazoSheet]    = useState(false);
  const [rechazoModo,         setRechazoModo]         = useState("porcentaje");
  const [rechazoExtraPct,     setRechazoExtraPct]     = useState("0");
  const [rechazoExtraMonto,   setRechazoExtraMonto]   = useState("");
  const [rechazoMetodo,       setRechazoMetodo]       = useState("efectivo");
  const [rechazoComprobante,  setRechazoComprobante]  = useState("");
  const [rechazoObs,          setRechazoObs]          = useState(TEXTO_CIERRE_RECHAZO);

  // ── UI state — próximo control ────────────────────────────────────────────

  const [unidadProximo,  setUnidadProximo]  = useState(() => order.proximoControl?.unidad || "km");
  const [kmProximoStr,   setKmProximoStr]   = useState(() =>
    order.proximoControl?.unidad === "km" && order.proximoControl?.kmObjetivo
      ? String(order.proximoControl.kmObjetivo) : "");
  const [diasProximoStr, setDiasProximoStr] = useState(() =>
    order.proximoControl?.unidad === "dias" && order.proximoControl?.valorObjetivo
      ? String(order.proximoControl.valorObjetivo) : "");

  // ── Timer display (setInterval — browser side effect) ─────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setTiempoActual(obtenerTiempoActual(order));
      setTiempoDiag(obtenerTiempoDiagActual(order));
    }, 1000);
    return () => clearInterval(id);
  }, [order]);

  // ── Tracking de apertura (telemetría) ─────────────────────────────────────

  useEffect(() => {
    if (!order?.id) return;
    trackEvent("open_detalle_trabajo", {
      screen: "detalleOrden", entityType: "trabajo", entityId: order.id,
      metadata: { estado: order.estado || "" },
    }).catch(console.error);
  }, [order?.id]);

  // ── Audio beep por cronómetro (Web Audio API) ─────────────────────────────

  useEffect(() => {
    if (!order?.cronometroActivo || order?.trabajoSinCronometro) return;
    const cfgCron      = config.cronometroAlertas || {};
    const activo       = cfgCron.activo ?? true;
    const frecuenciaMin = cfgCron.frecuenciaMin ?? 30;
    if (!activo || frecuenciaMin <= 0) return;

    const minutosActuales = Math.floor(tiempoActual * 60);
    if (minutosActuales === 0 || minutosActuales === ultimoAviso) return;
    if (minutosActuales % frecuenciaMin !== 0) return;

    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine"; osc.frequency.value = 880; gain.gain.value = 0.03;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.18);
    } catch (e) { console.error(e); }

    setUltimoAviso(minutosActuales);
  }, [config, order, tiempoActual, ultimoAviso]);

  // ── Sincronizar datos del cliente ─────────────────────────────────────────

  useEffect(() => {
    if (!order) return;
    const c = clients.find((x) => x.id === order.clientId) || {};
    if (c.nombre) setClientNombre(c.nombre);
    const telefono = c.tel || c.telefono || c.whatsapp || "";
    if (telefono) setClientTel(telefono);
  }, [order?.clientId]);

  if (!order) return null;

  // ── Derivaciones de display (dependen de view state: tiempoActual/tiempoDiag) ──

  const clientPhone = clientTel || client.whatsapp || client.telefono || client.tel || order.clienteTel || "";

  const costoActual  = tiempoActual * valorHora;
  const umbralAlerta = UMBRAL_ALERTA[nivelRiesgo];
  const estadoCron   = !order.maxAutorizado
    ? "NORMAL"
    : costoActual >= order.maxAutorizado
      ? "BLOQUEADO"
      : costoActual >= order.maxAutorizado * umbralAlerta
        ? "ALERTA"
        : "NORMAL";
  const cronMsg = CRON_MSG[estadoCron];

  const { nuevoMin, nuevoMax } = calcularNuevoRango({
    tiempoActual,
    costoHora: valorHora,
    promedioHoras,
    desvioHoras: promedioHoras * (nivelRiesgo === "alto" ? 0.5 : 0.3),
  });
  const presupuestoMinSheet = nivelRiesgo === "bajo"
    ? presBase
    : Math.min(presBase, Math.max(presBase, Math.round(nuevoMin)));
  const presupuestoMaxSheet = nivelRiesgo === "bajo"
    ? presBase
    : Math.max(presBase, Math.round(nuevoMax));

  const rechazoBaseManoObra  = Math.max(0, Math.round(tiempoDiag * valorHora));
  const rechazoPctNum        = Math.max(0, parseMonto(rechazoExtraPct));
  const rechazoMontoNum      = Math.max(0, parseMonto(rechazoExtraMonto));
  const rechazoExtraCalculado = rechazoModo === "porcentaje"
    ? Math.round(rechazoBaseManoObra * (rechazoPctNum / 100))
    : rechazoMontoNum;
  const rechazoTotal = Math.max(0, rechazoBaseManoObra + rechazoExtraCalculado);

  const sheetMinVal    = Number(sheetMin) > 0 ? Number(sheetMin) : presupuestoMinSheet;
  const sheetMaxVal    = Number(sheetMax) > 0 ? Number(sheetMax) : presupuestoMaxSheet;
  const sheetTotalBase = sheetTipoFijo ? sheetMinVal : sheetMaxVal;

  const mensajeAutoSheet = buildMensajePresupuesto({
    sheetMin, sheetMax, sheetTipoFijo, sheetAdelantoPct, sheetIncluirDatos,
  });

  const tiempoMax  = order.maxAutorizado > 0 ? order.maxAutorizado / valorHora : 0;
  const pct        = tiempoMax > 0 ? Math.min((costoActual / order.maxAutorizado) * 100, 100) : 0;
  const restante   = Math.max(tiempoMax - tiempoActual, 0);

  // ── Handlers — wrappers sobre acciones del hook ───────────────────────────

  const handleGuardarCliente = () => {
    guardarCliente(clientNombre, clientTel);
    setEditingClient(false);
    showToast("Cliente actualizado");
  };

  const handleGuardarItemEditado = (itemData) => {
    if (!editandoItem) return;
    guardarItemEditado(editandoItem.type, editandoItem.index, itemData);
    setEditandoItem(null);
    showToast("Guardado ✓");
  };

  const handleEliminarItem = (lista, index) => {
    const ok = eliminarItem(lista, index);
    if (!ok) showToast("No se puede modificar: ya se generó el comprobante");
    else showToast("Eliminado OK");
  };

  const handleCambiarEstado = (nuevo) => {
    const label = cambiarEstado(nuevo);
    if (label === false) {
      showToast("No se puede modificar: ya se generó el comprobante");
      return;
    }
    showToast(`Estado: ${label} OK`);
  };

  const handleConfirmarAprobacion = () => {
    confirmarAprobacion(presBase);
    showToast(`Aprobado: ${formatMoney(presBase)} OK`);
  };

  const handleAprobarTodo = () => {
    aprobarTodo();
    showToast("Todo aprobado OK");
    confirmarAprobacion(presBase);
    setView("ejecucion");
  };

  const handleDiagCargar = () => {
    const horasLabel = cargarDiag();
    if (!horasLabel) return;
    showToast(`Diagnóstico ${horasLabel} → cargado a mano de obra ✓`);
  };

  const handleGuardarProximoControl = () => {
    const kmBase = order.kmIngreso || bike.kilometrajeActual || bike.km || order.km || 0;
    const ok     = guardarProximoControl({
      unidad: unidadProximo,
      kmObj:  parseInt(kmProximoStr, 10),
      diasObj: parseInt(diasProximoStr, 10),
      kmBase,
    });
    if (ok) showToast("Proximo service guardado");
  };

  const handleQuitarProximoControl = () => {
    quitarProximoControl();
    setKmProximoStr("");
    setDiasProximoStr("");
    showToast("Recordatorio quitado");
  };

  const handleCerrarPorRechazo = () => {
    const ok = cerrarPorRechazo({
      modo:       rechazoModo,
      extraPct:   rechazoExtraPct,
      extraMonto: rechazoExtraMonto,
      metodo:     rechazoMetodo,
      comprobante: rechazoComprobante,
      obs:        rechazoObs,
      resTotal:   res.total,
      pagos:      order.pagos,
    });
    if (!ok) { showToast("Cargá un monto de diagnóstico o un cargo fijo"); return; }
    setShowRechazoSheet(false);
    showToast("Cierre por rechazo registrado");
    setView("prePdf");
  };

  const handleEnviarDesdeSheet = () => {
    const msg = sheetEditando && sheetMensaje ? sheetMensaje : mensajeAutoSheet;
    abrirWhatsApp(clientPhone, msg);
    marcarPresupuestoEnviado(sheetTipoFijo ? "fijo" : "estimado");
    setPresupuestoSent(true);
    setShowPresupuestoSheet(false);
  };

  // ── Helpers de sheet ──────────────────────────────────────────────────────

  const abrirSheet = () => {
    const autoFijo = presupuestoMinSheet === presupuestoMaxSheet;
    setSheetTipoFijo(autoFijo);
    setSheetMin(String(Math.round(presupuestoMinSheet) || ""));
    setSheetMax(String(Math.round(presupuestoMaxSheet) || ""));
    setSheetAdelantoPct(config.presupuestoConfig?.adelantoPct ?? 30);
    setSheetIncluirDatos(config.presupuestoConfig?.incluirAlias !== false);
    setSheetMensaje("");
    setSheetEditando(false);
    setSheetPreview(false);
    setShowPresupuestoSheet(true);
  };

  const abrirRechazoSheet = () => {
    const extraConfig = config.presupuestoConfig?.rechazoExtraMonto || 0;
    setRechazoModo(extraConfig > 0 ? "fijo" : "porcentaje");
    setRechazoExtraPct(String(config.presupuestoConfig?.rechazoExtraPct ?? 0));
    setRechazoExtraMonto(extraConfig > 0 ? String(extraConfig) : "");
    setRechazoMetodo("efectivo");
    setRechazoComprobante("");
    setRechazoObs(order.cierreRechazo?.observacion || TEXTO_CIERRE_RECHAZO);
    setShowRechazoSheet(true);
  };

  const irAEnviarPresupuesto = () => {
    if (!isLocked && order.estado === "diagnostico") handleCambiarEstado("presupuesto");
    abrirSheet();
  };

  const editarDetallePresupuesto = (item = null) => {
    if (!item) { setServiceToEdit?.(null); setView("gestionarTareas"); return; }
    if (item.type === "tareas") { setServiceToEdit?.({ ...item.raw, _editType: "tareas", _editIndex: item.index }); setView("gestionarTareas"); return; }
    setEditandoItem({ type: item.type, index: item.index, data: { ...item.raw } });
  };

  const eliminarDetallePresupuesto = (item) => {
    if (!item?.type || typeof item.index !== "number") return;
    setLocalConfirm({
      mensaje: `¿Eliminar "${item.nombre}" del presupuesto?`,
      onOk:    () => handleEliminarItem(item.type, item.index),
    });
  };

  // ── Acción principal según estado ─────────────────────────────────────────

  const accionPrincipal = isLocked
    ? { label: "Ver o reenviar comprobante", action: () => setView("imprimirOrden"), className: "bg-zinc-700 text-white" }
    : order.estado === "diagnostico"
      ? { label: "Enviar presupuesto por WhatsApp", action: irAEnviarPresupuesto, className: "bg-amber-400 text-zinc-950" }
      : order.estado === "presupuesto"
        ? presupuestoSent
          ? { label: "Presupuesto enviado - reenviar", action: abrirSheet, className: "bg-emerald-600 text-white" }
          : { label: "Enviar presupuesto por WhatsApp", action: abrirSheet, className: "bg-amber-400 text-zinc-950" }
        : order.estado === "aprobacion"
          ? { label: "Iniciar reparacion aprobada", action: () => setView("ejecucion"), className: "bg-orange-600 text-white" }
          : order.estado === "reparacion"
            ? { label: "Seguir cargando trabajo", action: () => setView("ejecucion"), className: "bg-orange-600 text-white" }
            : order.estado === "finalizada"
              ? { label: "Cerrar trabajo y cobrar", action: () => setView("finalizacion"), className: "bg-orange-600 text-white" }
              : order.estado === "listo_para_emitir"
                ? saldoPendiente <= 0
                  ? { label: "Generar garantia para el cliente", action: () => setView("prePdf"), className: "bg-orange-600 text-white" }
                  : { label: "Registrar cobro del cliente", action: () => setView("pago"), className: "bg-green-600 text-white" }
                : order.estado === "cobrado_pendiente_retiro"
                  ? { label: "Confirmar que la moto se retiro", action: () => setView("retiro"), className: "bg-emerald-600 text-white" }
                  : order.estado === "cerrado_emitido"
                    ? { label: "Ver garantia / comprobante", action: () => setView("prePdf"), className: "bg-orange-600 text-white" }
                    : null;

  const ejecutarPaso = (idx) => {
    if (isLocked) return;
    const pasoId = STEP_UI[idx]?.id;
    if (idx < currentStepIndex) {
      handleCambiarEstado(pasoId);
      showToast(`Volviendo a ${ESTADO_LABEL[pasoId]}`);
      return;
    }
    if (idx === currentStepIndex || idx === currentStepIndex + 1) {
      if (pasoId === "aprobacion" && idx === currentStepIndex) {
        handleConfirmarAprobacion();
        setView("ejecucion");
        return;
      }
      if (!accionPrincipal) return;
      accionPrincipal.action();
      return;
    }
    showToast("Ese paso todavía no corresponde");
  };

  const kmBase = order.kmIngreso || bike.kilometrajeActual || bike.km || order.km || 0;

  // ── JSX ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 pb-40 text-left text-zinc-100 animate-in slide-in-from-right duration-300">
      {/* Sticky total bar */}
      {res.total > 0 && (
        <div className="fixed bottom-[64px] left-0 right-0 z-40 px-4 pb-2 pointer-events-none">
          <div className="mx-auto max-w-[440px]">
            <div className="rounded-2xl border border-orange-500/25 bg-zinc-950/95 px-4 py-3 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{esCierreRechazo ? "Total cobrado" : "Total del presupuesto"}</p>
                  <p className="mt-1 text-xl font-black leading-tight text-white">{formatMoney(res.total)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Estado</p>
                  {saldoPendiente > 0 && <p className="mt-1 text-xs font-black leading-tight text-red-300">Saldo {formatMoney(saldoPendiente)}</p>}
                  {saldoPendiente <= 0 && totalPagado > 0 && <p className="mt-1 text-xs font-black leading-tight text-emerald-300">Pagado</p>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 px-5 pb-8 pt-5 text-white shadow-2xl">
        <div className="mx-auto max-w-[440px]">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setView("ordenes")} className="rounded-2xl border-2 border-orange-500/50 bg-orange-600/20 p-3 text-orange-300 hover:text-orange-100 hover:bg-orange-600/40 shadow-lg backdrop-blur transition-all active:scale-95">
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
                {isLocked && <ShieldCheck className="text-orange-400" size={22} />}
              </div>
              <p className="mt-1 text-[10px] font-black uppercase tracking-[0.25em] text-orange-400">{trabajoLabel}</p>

              {editingClient ? (
                <div className="mt-3 space-y-2 rounded-2xl bg-zinc-800/50 p-3 border border-zinc-700">
                  <input type="text" value={clientNombre} onChange={(e) => setClientNombre(e.target.value)} placeholder="Nombre del cliente" className="w-full bg-black/60 text-white text-sm px-3 py-2 rounded-lg border border-white/10 focus:border-orange-500 outline-none" />
                  <input type="tel"  value={clientTel}    onChange={(e) => setClientTel(e.target.value)}    placeholder="Teléfono"           className="w-full bg-black/60 text-white text-sm px-3 py-2 rounded-lg border border-white/10 focus:border-orange-500 outline-none" />
                  <div className="flex gap-2">
                    <button onClick={handleGuardarCliente}      className="flex-1 bg-orange-600 text-white text-xs font-black py-2 rounded-lg hover:bg-orange-500 active:scale-95">Guardar</button>
                    <button onClick={() => setEditingClient(false)} className="flex-1 bg-zinc-700 text-zinc-200 text-xs font-black py-2 rounded-lg hover:bg-zinc-600 active:scale-95">Cancelar</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setEditingClient(true)} className="mt-2 text-left w-full group">
                  <p className="text-sm font-black uppercase tracking-tight text-zinc-300 group-hover:text-orange-400 transition-colors">{clientNombre || "Cliente desconocido"}</p>
                  <p className="text-[9px] text-zinc-500 group-hover:text-zinc-400 transition-colors">{clientTel || "Sin teléfono"}</p>
                </button>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{esCierreRechazo ? "Total cobrado" : "Total presupuesto"}</p>
              <div className="rounded-[1.5rem] border border-orange-400/25 bg-zinc-950/50 px-4 py-3 shadow-xl backdrop-blur">
                <p className="text-3xl font-black leading-none tracking-tighter text-orange-300">{formatMoney(res.total)}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-zinc-700/50 pt-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{estadoPaso}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{bike?.marca || ""} {bike?.modelo || ""}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[440px] px-4 py-6 space-y-6">

        {/* Cronómetro de diagnóstico */}
        {["diagnostico", "presupuesto"].includes(order.estado) && !isLocked && (
          <div className="rounded-[2rem] border border-violet-500/30 bg-violet-950/40 p-5 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">Cronometro de trabajo / diagnostico</p>
                <p className="text-[9px] font-bold text-zinc-500 mt-0.5">Tiempo facturable si el cliente rechaza o pospone</p>
              </div>
              {tiempoDiag > 0 && <p className="text-xs font-black text-violet-400">≈ {formatMoney(Math.round(tiempoDiag * valorHora))}</p>}
            </div>
            <p className="text-center text-5xl font-black tracking-tighter text-white tabular-nums mb-4">{formatTiempo(tiempoDiag)}</p>
            <div className="flex gap-3">
              <button
                onClick={order.diagActivo ? pauseDiag : startDiag}
                className={`flex-1 rounded-2xl py-3.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${order.diagActivo ? "bg-amber-500/20 border border-amber-500/40 text-amber-300" : "bg-violet-600 text-white shadow-violet-500/30"}`}
              >
                {order.diagActivo ? "Pausar" : tiempoDiag > 0 ? "Continuar" : "Iniciar"}
              </button>
              {tiempoDiag > 0.01 && !order.diagActivo && (
                <button onClick={handleDiagCargar} className="flex-[2] rounded-2xl bg-orange-600 py-3.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-500/30 transition-all active:scale-95">
                  Cargar a mano de obra
                </button>
              )}
            </div>
          </div>
        )}

        {/* Progreso visual */}
        <div className="relative z-10 -mt-4 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {STEP_UI.map((step, idx) => {
            const Icon      = step.icon;
            const isCurrent = idx === currentStepIndex;
            const isDone    = idx < currentStepIndex || (isLocked && step.id === "cerrado_emitido");
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => ejecutarPaso(idx)}
                disabled={isLocked || !accionPrincipal}
                title={idx === currentStepIndex || idx === currentStepIndex + 1 ? accionPrincipal?.label : step.label}
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[1.25rem] border transition-all shadow-lg ${isCurrent ? "scale-105 border-orange-400 bg-orange-600 text-white shadow-orange-500/40" : isDone ? "border-emerald-400 bg-emerald-500 text-white" : "border-zinc-800 bg-zinc-900 text-zinc-500"}`}
              >
                {isDone ? <CheckCircle2 size={18} /> : <Icon size={16} />}
              </button>
            );
          })}
        </div>
        <div className="h-6" />

        {isLocked && (
          <div className="flex items-center gap-3 rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-4 shadow-lg backdrop-blur">
            <div className="rounded-xl bg-orange-500 p-2 text-white"><ShieldCheck size={20} /></div>
            <p className="text-[10px] font-black uppercase leading-tight text-orange-200">Trabajo cerrado: ya se emitió comprobante.</p>
          </div>
        )}

        {!isLocked && order.estado !== "cerrado_emitido" && (
          <button onClick={() => setView("gestionarTareas")} className="w-full rounded-[1.75rem] border border-orange-500/50 bg-zinc-900 py-4 text-[11px] font-black uppercase tracking-widest text-orange-100 shadow-lg transition-all active:scale-95">
            Gestionar tareas / repuestos
          </button>
        )}

        {!isLocked && order.estado === "reparacion" && client?.tel && (
          <button
            onClick={() => {
              const plantillas = mensajesImprevisto({ bike, client, totalOriginal: order.maxAutorizado || 0, totalNuevo: res.total });
              setImprevistoTexto(plantillas[0].texto);
              setShowImprevistoSheet(true);
            }}
            className="w-full rounded-[1.75rem] border border-amber-500/50 bg-amber-500/10 py-3.5 text-[11px] font-black uppercase tracking-widest text-amber-300 shadow-lg transition-all active:scale-95"
          >
            Avisar imprevisto al cliente
          </button>
        )}

        {!isLocked && ["diagnostico", "presupuesto", "aprobacion"].includes(order.estado) && (
          <button onClick={abrirRechazoSheet} className="w-full rounded-[1.75rem] border border-red-500/40 bg-red-500/10 py-3.5 text-[11px] font-black uppercase tracking-widest text-red-200 shadow-lg transition-all active:scale-95">
            Cliente rechaza / pospone
          </button>
        )}

        {/* Detalle del presupuesto */}
        {res.total > 0 && (
          <section className="rounded-[2rem] border border-orange-500/25 bg-zinc-900/95 p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-400">Detalle del presupuesto</p>
                <p className="mt-1 text-[10px] font-bold text-zinc-500">Todo lo cargado debe coincidir con el total.</p>
              </div>
              <div className="shrink-0 text-right space-y-1">
                <p className="text-lg font-black text-white">{formatMoney(res.total)}</p>
                {puedeEditarPresupuesto && (
                  <button type="button" onClick={() => editarDetallePresupuesto()} className="rounded-full border border-orange-500/30 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-orange-300 active:scale-95 block">
                    Editar
                  </button>
                )}
                {canApprove && (
                  <button type="button" onClick={handleAprobarTodo} className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-emerald-300 active:scale-95 block">
                    Aprobar todo
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {detallePresupuesto.filter((g) => g.total > 0 || g.items.length > 0).map((grupo) => (
                <div key={grupo.label} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-wider text-zinc-100">{grupo.label}</p>
                      <p className="mt-0.5 text-[9px] font-bold text-zinc-500">{grupo.note}</p>
                    </div>
                    <p className="shrink-0 text-sm font-black text-orange-300">{formatMoney(grupo.total)}</p>
                  </div>

                  {grupo.items.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      {grupo.items.map((item, idx) => {
                        const aprobacion = item.raw?.aprobacion || "pendiente";
                        const rechazado  = aprobacion === "rechazado";
                        const aprobado   = aprobacion === "aprobado";
                        return (
                          <div key={`${grupo.label}-${idx}`} className={`text-[10px] py-2 border-b border-white/5 last:border-0 transition-opacity ${rechazado ? "opacity-40" : ""}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className={`truncate font-black uppercase leading-tight ${rechazado ? "line-through text-red-400" : aprobado ? "text-emerald-300" : "text-zinc-300"}`}>
                                    {item.nombre}
                                  </p>
                                  {aprobado  && <span className="shrink-0 rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-emerald-400">OK</span>}
                                  {rechazado && <span className="shrink-0 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[8px] font-black uppercase text-red-400">NO</span>}
                                </div>
                                {item.detalle && <p className="font-bold text-zinc-600 mt-0.5">{item.detalle}</p>}
                              </div>
                              <p className={`shrink-0 font-black ${rechazado ? "line-through text-zinc-600" : "text-zinc-200"}`}>{formatMoney(item.total)}</p>
                            </div>
                            <div className="mt-2 flex gap-2 flex-wrap">
                              {canApprove && (
                                <>
                                  <button type="button" onClick={() => toggleAprobacion(item.type, item.index, "aprobado")} className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${aprobado ? "bg-emerald-600 text-white" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"}`}>✓ Aprobado</button>
                                  <button type="button" onClick={() => toggleAprobacion(item.type, item.index, "rechazado")} className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${rechazado ? "bg-red-600 text-white" : "bg-red-500/10 text-red-400 border border-red-500/30"}`}>✗ Rechazado</button>
                                </>
                              )}
                              {puedeEditarPresupuesto && (
                                <>
                                  <button type="button" onClick={() => editarDetallePresupuesto(item)} className="rounded-full bg-orange-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-orange-300 active:scale-95">Cambiar</button>
                                  <button type="button" onClick={() => eliminarDetallePresupuesto(item)} className="rounded-full bg-red-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-red-300 active:scale-95">Eliminar</button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-orange-500/25 bg-orange-500/10 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-200">Total calculado</p>
                <p className="text-lg font-black text-orange-200">{formatMoney(totalDetallePresupuesto)}</p>
              </div>
              {(res.gananciaEstimada + Math.round(tiempoDiag * valorHora)) > 0 && (
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-emerald-500/20 pt-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Ganancia estimada</p>
                  <p className="text-sm font-black text-emerald-300">{formatMoney(res.gananciaEstimada + Math.round(tiempoDiag * valorHora))}</p>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-orange-500/20 pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{saldoPendiente > 0 ? "Falta cobrar" : "Cobrado"}</p>
                <p className={`text-sm font-black ${saldoPendiente > 0 ? "text-red-300" : "text-emerald-300"}`}>
                  {saldoPendiente > 0 ? formatMoney(saldoPendiente) : formatMoney(totalPagado)}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Próximo service */}
        {!isLocked && (
          <section className="rounded-[2rem] border border-yellow-500/20 bg-zinc-900/95 p-4 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Bell size={13} className="text-yellow-400" />
              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-300">Proximo service</p>
            </div>

            {order.proximoControl?.activo ? (
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-white">{order.proximoControl.descripcion}</p>
                  {order.proximoControl.unidad === "km" ? (
                    <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                      A los {Number(order.proximoControl.kmObjetivo || 0).toLocaleString("es-AR")} km
                      {" · "}Aviso a {Number(order.proximoControl.kmAviso || 0).toLocaleString("es-AR")} km
                    </p>
                  ) : (
                    <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                      En {order.proximoControl.valorObjetivo} días
                      {order.proximoControl.fechaObjetivo && <> · {new Date(order.proximoControl.fechaObjetivo).toLocaleDateString("es-AR")}</>}
                    </p>
                  )}
                </div>
                <button onClick={handleQuitarProximoControl} className="rounded-2xl bg-zinc-800 px-3 py-2 text-[9px] font-black uppercase text-zinc-400 active:scale-95 transition-all flex-shrink-0">Quitar</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  {["km", "dias"].map((u) => (
                    <button key={u} onClick={() => setUnidadProximo(u)}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${unidadProximo === u ? "bg-yellow-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>
                      {u === "km" ? "Por km" : "Por días"}
                    </button>
                  ))}
                </div>

                {unidadProximo === "km" ? (
                  <>
                    <p className="text-[9px] font-bold text-zinc-500">Km al ingreso: <span className="text-zinc-300 font-black">{kmBase.toLocaleString("es-AR")} km</span></p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 focus-within:border-yellow-500 transition-colors">
                        <input type="text" inputMode="numeric" placeholder="Objetivo km..." value={kmProximoStr}
                          onChange={(e) => setKmProximoStr(e.target.value.replace(/\D/g, ""))}
                          className="w-full bg-transparent font-black text-white outline-none placeholder:text-zinc-600 text-sm" />
                        <span className="text-[10px] font-black text-zinc-500">km</span>
                      </div>
                      <button onClick={handleGuardarProximoControl}
                        disabled={!kmProximoStr || parseInt(kmProximoStr, 10) <= kmBase}
                        className="rounded-2xl bg-yellow-600 px-4 py-2.5 text-[10px] font-black uppercase text-white active:scale-95 transition-all disabled:opacity-40">
                        Guardar
                      </button>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {kmPresets.map((delta) => (
                        <button key={delta} type="button" onClick={() => setKmProximoStr(String(kmBase + delta))}
                          className="px-2.5 py-1 rounded-xl bg-zinc-800 text-[9px] font-black text-zinc-400 active:bg-yellow-600 active:text-white transition-all">
                          +{delta.toLocaleString("es-AR")}km
                        </button>
                      ))}
                      <button type="button" onClick={() => setKmProximoStr("")}
                        className="px-2.5 py-1 rounded-xl bg-zinc-800 text-[9px] font-black text-zinc-400 active:bg-yellow-600 active:text-white transition-all">
                        Personalizado
                      </button>
                    </div>
                    {kmProximoStr && parseInt(kmProximoStr, 10) > kmBase && (
                      <p className="text-[9px] font-bold text-yellow-400/80">
                        Intervalo: {(parseInt(kmProximoStr, 10) - kmBase).toLocaleString("es-AR")} km
                        {" · "}Aviso a {(parseInt(kmProximoStr, 10) - 500).toLocaleString("es-AR")} km
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 focus-within:border-yellow-500 transition-colors">
                        <input type="text" inputMode="numeric" placeholder="Cantidad de días..." value={diasProximoStr}
                          onChange={(e) => setDiasProximoStr(e.target.value.replace(/\D/g, ""))}
                          className="w-full bg-transparent font-black text-white outline-none placeholder:text-zinc-600 text-sm" />
                        <span className="text-[10px] font-black text-zinc-500">días</span>
                      </div>
                      <button onClick={handleGuardarProximoControl}
                        disabled={!diasProximoStr || parseInt(diasProximoStr, 10) <= 0}
                        className="rounded-2xl bg-yellow-600 px-4 py-2.5 text-[10px] font-black uppercase text-white active:scale-95 transition-all disabled:opacity-40">
                        Guardar
                      </button>
                    </div>
                    {diasProximoStr && parseInt(diasProximoStr, 10) > 0 && (() => {
                      const d = parseInt(diasProximoStr, 10);
                      const fecha = new Date(Date.now() + d * 86400000).toLocaleDateString("es-AR");
                      return <p className="text-[9px] font-bold text-yellow-400/80">Aviso 7 días antes · Vence el {fecha}</p>;
                    })()}
                    <div className="flex gap-1.5 flex-wrap">
                      {[{ label: "30d", v: 30 },{ label: "60d", v: 60 },{ label: "90d", v: 90 },{ label: "180d", v: 180 },{ label: "365d", v: 365 }].map(({ label, v }) => (
                        <button key={v} onClick={() => setDiasProximoStr(String(v))}
                          className="px-2.5 py-1 rounded-xl bg-zinc-800 text-[9px] font-black text-zinc-400 active:bg-yellow-600 active:text-white transition-all">
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {accionPrincipal && (
          <button onClick={accionPrincipal.action} className={`w-full rounded-[1.75rem] py-4 text-[11px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${accionPrincipal.className}`}>
            {accionPrincipal.label}
          </button>
        )}
      </div>

      {/* Sheet: editar item */}
      {editandoItem && (
        <EditarItemSheet
          tipo={editandoItem.type}
          datos={editandoItem.data}
          cilindrada={bike.cilindrada}
          onSave={handleGuardarItemEditado}
          onCancel={() => setEditandoItem(null)}
        />
      )}

      {/* Sheet: rechazo */}
      {showRechazoSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowRechazoSheet(false)} />
          <div className="relative w-full max-h-[92vh] overflow-y-auto rounded-t-[2rem] border-t border-red-700/40 bg-zinc-900 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto max-w-[440px] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-300">Cierre comun de taller</p>
                  <h3 className="mt-1 text-lg font-black uppercase tracking-tight text-white">Cliente rechaza / pospone</h3>
                </div>
                <button onClick={() => setShowRechazoSheet(false)} className="rounded-xl bg-zinc-800 p-2 text-zinc-400 active:scale-95 transition-all"><X size={18} /></button>
              </div>

              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-200">Presupuesto original</p>
                <p className="mt-1 text-2xl font-black text-orange-100">{formatMoney(res.total)}</p>
                <p className="mt-1 text-[10px] font-bold text-orange-200/70">Este monto queda como referencia. No entra a caja si el cliente no lo aprueba.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-violet-300">Tiempo tomado</p>
                  <p className="mt-1 text-xl font-black text-white tabular-nums">{formatTiempo(tiempoDiag)}</p>
                  <p className="mt-1 text-[10px] font-bold text-violet-200/70">{formatTiempoCorto(tiempoDiag)}</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-300">Mano de obra</p>
                  <p className="mt-1 text-xl font-black text-emerald-200">{formatMoney(rechazoBaseManoObra)}</p>
                  <p className="mt-1 text-[10px] font-bold text-emerald-200/70">Cronometro x hora taller</p>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Cargo adicional acordado</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRechazoModo("porcentaje")} className={`rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${rechazoModo === "porcentaje" ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>Porcentaje</button>
                  <button type="button" onClick={() => setRechazoModo("fijo")}       className={`rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${rechazoModo === "fijo"       ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>Monto fijo</button>
                </div>
                {rechazoModo === "porcentaje" ? (
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Extra sobre el diagnostico</label>
                    <div className="mt-2 flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500">
                      <input type="text" inputMode="decimal" value={rechazoExtraPct} onChange={(e) => setRechazoExtraPct(e.target.value)} className="w-full bg-transparent text-right text-2xl font-black text-white outline-none" placeholder="0" />
                      <span className="text-lg font-black text-orange-400">%</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Cargo fijo</label>
                    <div className="mt-2 flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500">
                      <span className="text-lg font-black text-orange-400">$</span>
                      <input type="text" inputMode="decimal" value={rechazoExtraMonto} onChange={(e) => setRechazoExtraMonto(e.target.value)} className="w-full bg-transparent text-right text-2xl font-black text-white outline-none" placeholder="0" />
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Total a cobrar ahora</p>
                <p className="mt-1 text-3xl font-black text-emerald-200">{formatMoney(rechazoTotal)}</p>
                <p className="mt-1 text-[10px] font-bold text-emerald-200/70">Solo este monto se registra en caja.</p>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Medio de pago</p>
                <div className="grid grid-cols-3 gap-2">
                  {[["efectivo","Efectivo"],["transferencia","Transferencia"],["mercadopago","Mercado Pago"]].map(([id, label]) => (
                    <button key={id} type="button" onClick={() => setRechazoMetodo(id)}
                      className={`rounded-2xl border px-2 py-3 text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 ${rechazoMetodo === id ? "border-orange-500 bg-orange-600 text-white" : "border-zinc-700 bg-zinc-800 text-zinc-400"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <input value={rechazoComprobante} onChange={(e) => setRechazoComprobante(e.target.value)}
                  placeholder="Numero de comprobante o referencia"
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-orange-500" />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Observacion para el comprobante</label>
                <textarea value={rechazoObs} onChange={(e) => setRechazoObs(e.target.value)} rows={5}
                  className="mt-2 w-full resize-none rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-bold leading-relaxed text-zinc-200 outline-none focus:border-orange-500" />
              </div>

              <button onClick={handleCerrarPorRechazo} className="w-full rounded-[1.75rem] bg-red-600 py-5 text-[11px] font-black uppercase tracking-widest text-white shadow-xl shadow-red-900/30 transition-all active:scale-95">
                Cobrar y emitir comprobante sin garantia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet: imprevisto */}
      {showImprevistoSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowImprevistoSheet(false)} />
          <div className="relative w-full max-h-[90vh] overflow-y-auto rounded-t-[2rem] bg-zinc-900 border-t border-amber-700/40 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-400">Imprevisto / Ampliacion</p>
                  <p className="text-sm font-black text-white mt-0.5">Avisar al cliente</p>
                </div>
                <button onClick={() => setShowImprevistoSheet(false)} className="rounded-xl bg-zinc-800 p-2 text-zinc-400 active:scale-90 transition-all"><X size={16} /></button>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Elegir plantilla</p>
                {mensajesImprevisto({ bike, client, totalOriginal: order.maxAutorizado || 0, totalNuevo: res.total }).map((p) => (
                  <button key={p.label} onClick={() => setImprevistoTexto(p.texto)}
                    className={`w-full text-left rounded-2xl border px-4 py-3 text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 ${imprevistoTexto === p.texto ? "border-amber-500 bg-amber-500/20 text-amber-200" : "border-zinc-700 bg-zinc-800 text-zinc-300"}`}>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Mensaje (editable)</p>
                <textarea value={imprevistoTexto} onChange={(e) => setImprevistoTexto(e.target.value)} rows={8}
                  className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs text-zinc-200 leading-relaxed resize-none focus:outline-none focus:border-amber-500" />
              </div>

              <button onClick={() => { abrirWhatsApp(clientPhone, imprevistoTexto); setShowImprevistoSheet(false); }}
                className="w-full rounded-[1.75rem] bg-green-600 py-4 text-[11px] font-black uppercase tracking-widest text-white shadow-xl transition-all active:scale-95">
                Enviar por WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet: enviar presupuesto */}
      {showPresupuestoSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPresupuestoSheet(false)} />
          <div className="relative w-full max-h-[92vh] overflow-y-auto rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto max-w-[440px] p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Enviar presupuesto al cliente</h3>
                <button onClick={() => setShowPresupuestoSheet(false)} className="rounded-xl bg-zinc-800 p-2 text-zinc-400 hover:text-white active:scale-95 transition-all"><X size={18} /></button>
              </div>
              <p className="text-xs font-bold leading-relaxed text-zinc-500">Revisa el monto. Al tocar WhatsApp se abre el mensaje para el cliente. No cobra, no cierra la orden y no genera PDF.</p>

              <div className="rounded-2xl bg-zinc-800/50 border border-zinc-700 p-4">
                <p className="text-sm font-black text-white">{client.nombre || "Cliente"}</p>
                <p className="text-xs text-zinc-400">{bike.marca || ""} {bike.modelo || ""} {bike.patente ? `— ${bike.patente}` : ""}</p>
              </div>

              <div className="flex gap-2">
                {[{ label: "Precio cerrado", val: true }, { label: "Rango estimado", val: false }].map(({ label, val }) => (
                  <button key={label} onClick={() => { setSheetTipoFijo(val); if (val) setSheetMax(sheetMin); }}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${sheetTipoFijo === val ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {sheetTipoFijo ? (
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">Total que va a ver el cliente</p>
                  <input type="text" inputMode="numeric" value={sheetMin}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setSheetMin(v); setSheetMax(v); }}
                    placeholder="0"
                    className="w-full text-center text-4xl font-black bg-transparent text-white border-b-2 border-zinc-600 focus:border-orange-500 outline-none py-2" />
                </div>
              ) : (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Mínimo</p>
                    <input type="text" inputMode="numeric" value={sheetMin} onChange={(e) => setSheetMin(e.target.value.replace(/\D/g, ""))} placeholder="0" className="w-full text-center text-2xl font-black bg-transparent text-white border-b-2 border-zinc-600 focus:border-orange-500 outline-none py-2" />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Máximo</p>
                    <input type="text" inputMode="numeric" value={sheetMax} onChange={(e) => setSheetMax(e.target.value.replace(/\D/g, ""))} placeholder="0" className="w-full text-center text-2xl font-black bg-transparent text-white border-b-2 border-zinc-600 focus:border-orange-500 outline-none py-2" />
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Adelanto que vas a pedir</p>
                <div className="flex gap-2">
                  {[0, 25, 30, 50, 70].map((p) => (
                    <button key={p} onClick={() => setSheetAdelantoPct(p)}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${sheetAdelantoPct === p ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}>
                      {p}%
                    </button>
                  ))}
                </div>
                {sheetAdelantoPct > 0 && (
                  <p className="mt-2 text-center text-sm font-black text-orange-400">
                    Monto: {formatMoney(Math.round(sheetTotalBase * (sheetAdelantoPct / 100)))}
                  </p>
                )}
              </div>

              <button onClick={() => setSheetIncluirDatos((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl bg-zinc-800/50 border border-zinc-700 p-4 active:scale-95 transition-all">
                <span className="text-sm font-black text-zinc-300">Incluir datos de transferencia</span>
                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${sheetIncluirDatos ? "border-orange-500 bg-orange-600" : "border-zinc-600 bg-transparent"}`}>
                  {sheetIncluirDatos && <CheckCircle2 size={12} className="text-white" />}
                </div>
              </button>

              <div className="rounded-2xl bg-zinc-800/50 border border-zinc-700 overflow-hidden">
                <button onClick={() => setSheetPreview((v) => !v)} className="flex w-full items-center justify-between p-4">
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Vista previa</span>
                  <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-200 ${sheetPreview ? "rotate-180" : ""}`} />
                </button>
                {sheetPreview && (
                  sheetEditando ? (
                    <div className="px-4 pb-4">
                      <textarea value={sheetMensaje} onChange={(e) => setSheetMensaje(e.target.value)} rows={10}
                        className="w-full bg-zinc-900 text-zinc-200 text-xs rounded-xl p-3 border border-zinc-600 focus:border-orange-500 outline-none resize-none font-mono leading-relaxed" />
                    </div>
                  ) : (
                    <div className="px-4 pb-4">
                      <pre className="whitespace-pre-wrap text-xs text-zinc-300 leading-relaxed font-mono">{mensajeAutoSheet}</pre>
                    </div>
                  )
                )}
              </div>

              <div className="flex gap-3 pb-2">
                <button onClick={() => { if (!sheetEditando) { setSheetMensaje(mensajeAutoSheet); setSheetPreview(true); } setSheetEditando((v) => !v); }}
                  className="flex-1 rounded-[1.5rem] border border-zinc-600 bg-zinc-800 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all">
                  {sheetEditando ? "Texto automatico" : "Editar mensaje"}
                </button>
                <button onClick={handleEnviarDesdeSheet}
                  className="flex-[2] rounded-[1.5rem] bg-emerald-600 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-xl hover:bg-emerald-500 active:scale-95 transition-all">
                  Abrir WhatsApp y enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {localConfirm && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-zinc-700 rounded-[2rem] p-6 w-full max-w-sm space-y-4">
            <p className="text-white font-black text-sm text-center leading-relaxed">{localConfirm.mensaje}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setLocalConfirm(null)} className="bg-zinc-800 text-zinc-300 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Cancelar</button>
              <button onClick={() => { localConfirm.onOk(); setLocalConfirm(null); }} className="bg-red-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
