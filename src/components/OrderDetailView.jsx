import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, ChevronDown, ClipboardList, DollarSign, Edit2, FileText, Play, Search, Send, ShieldCheck, ThumbsUp, Trash2, Truck, Wrench, X } from "lucide-react";
import { LS, buscarRepuestosAutocomplete, guardarRepuestoHistorial } from "../lib/storage.js";
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

// ── Editor parcial: repuesto / flete / insumo ───────────────────────────────
function EditarItemSheet({ tipo, datos, cilindrada, onSave, onCancel }) {
  const esFlete = tipo === "fletes";
  const tipoHistorial = tipo === "repuestos" ? "repuesto" : tipo === "insumos" ? "insumo" : "flete";

  const [form, setForm] = useState({ ...datos });
  const [busqueda, setBusqueda] = useState(datos.nombre || "");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSug, setMostrarSug] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 120); }, []);

  const handleBusqueda = (valor) => {
    setBusqueda(valor);
    setForm(f => ({ ...f, nombre: valor }));
    if (!valor.trim()) { setSugerencias([]); setMostrarSug(false); return; }
    const r = buscarRepuestosAutocomplete(valor, esFlete ? null : cilindrada, tipoHistorial);
    setSugerencias(r);
    setMostrarSug(r.length > 0);
  };

  const seleccionar = (s) => {
    setBusqueda(s.nombre);
    setForm(f => ({ ...f, nombre: s.nombre, monto: s.precio }));
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
            <button onClick={onCancel} className="rounded-xl bg-zinc-800 p-2 text-zinc-400 active:scale-90 transition-all">
              <X size={18} />
            </button>
          </div>

          {/* Nombre con autocomplete */}
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
                  onChange={e => handleBusqueda(e.target.value)}
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

          {/* Cantidad (repuestos / insumos) */}
          {!esFlete && (
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">Cantidad</label>
              <input
                type="text" inputMode="numeric"
                className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-black text-white outline-none focus:border-orange-500 transition-colors"
                value={form.cantidad || 1}
                onChange={e => setForm(f => ({ ...f, cantidad: Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1) }))}
              />
            </div>
          )}

          {/* Precio / Monto */}
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">
              {esFlete ? "Monto" : "Precio unitario"}
            </label>
            <div className="flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 focus-within:border-orange-500 transition-colors">
              <span className="font-black text-zinc-400">$</span>
              <input
                type="text" inputMode="numeric"
                className="w-full bg-transparent font-black text-orange-400 outline-none text-right"
                value={form.monto > 0 ? form.monto.toLocaleString("es-AR") : ""}
                onChange={e => {
                  const v = Number(e.target.value.replace(/\D/g, "")) || 0;
                  setForm(f => ({ ...f, monto: v }));
                }}
                placeholder="0"
              />
            </div>
          </div>

          {/* Total preview */}
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
  const [sheetMin, setSheetMin] = useState("");
  const [sheetMax, setSheetMax] = useState("");
  const [editandoItem, setEditandoItem] = useState(null); // { type, index, data }

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
  const detallePresupuesto = [
    {
      label: "Trabajos / mano de obra",
      note: "Ganancia del taller",
      total: res.desglose.moCliente,
      items: (order.tareas || []).map((item, index) => ({
        type: "tareas",
        index,
        raw: item,
        nombre: item.nombre || "Trabajo",
        detalle: item.horasBase ? `${item.horasBase} h` : "",
        total: item.monto || 0,
      })),
    },
    {
      label: "Repuestos",
      note: "Se cobran al cliente al costo",
      total: res.desglose.repuestosCliente,
      items: (order.repuestos || []).map((item, index) => ({
        type: "repuestos",
        index,
        raw: item,
        nombre: item.nombre || "Repuesto",
        detalle: `Cant. ${item.cantidad || 1}`,
        total: (item.monto || 0) * (item.cantidad || 1),
      })),
    },
    {
      label: "Flete / cadetería",
      note: "Traslados y búsqueda de repuestos",
      total: res.desglose.fletesCliente,
      items: (order.fletes || []).map((item, index) => ({
        type: "fletes",
        index,
        raw: item,
        nombre: item.nombre || item.descripcion || "Flete / cadetería",
        detalle: "",
        total: item.monto || 0,
      })),
    },
    {
      label: "Insumos / terceros",
      note: "Gastos cobrados sin ganancia adicional",
      total: res.desglose.insumosCliente,
      items: (order.insumos || []).map((item, index) => ({
        type: "insumos",
        index,
        raw: item,
        nombre: item.nombre || "Insumo / tercero",
        detalle: `Cant. ${item.cantidad || 1}`,
        total: (item.monto || 0) * (item.cantidad || 1),
      })),
    },
  ];
  const totalDetallePresupuesto = detallePresupuesto.reduce((sum, item) => sum + item.total, 0);
  const puedeEditarPresupuesto = !isLocked && ["diagnostico", "presupuesto"].includes(order.estado);

  const editarDetallePresupuesto = (item = null) => {
    if (!item) { setServiceToEdit?.(null); setView("gestionarTareas"); return; }
    if (item.type === "tareas") { setServiceToEdit?.(item.raw); setView("gestionarTareas"); return; }
    // Edición parcial inline para repuesto / flete / insumo
    setEditandoItem({ type: item.type, index: item.index, data: { ...item.raw } });
  };

  const guardarItemEditado = (itemData) => {
    if (!editandoItem) return;
    const { type, index } = editandoItem;
    const lista = [...(order[type] || [])];
    lista[index] = { ...lista[index], ...itemData };
    const tareas    = order.tareas    || [];
    const repuestos = type === "repuestos" ? lista : order.repuestos || [];
    const fletes    = type === "fletes"    ? lista : order.fletes    || [];
    const insumos   = type === "insumos"   ? lista : order.insumos   || [];
    const nTotal = calcularNuevoTotal(tareas, repuestos, fletes, insumos);
    LS.updateDoc("trabajos", order.id, { [type]: lista, total: nTotal });
    setEditandoItem(null);
    showToast("Guardado ✓");
  };

  const eliminarDetallePresupuesto = (item) => {
    if (!item?.type || typeof item.index !== "number") return;
    if (!window.confirm("¿Eliminar este ítem del presupuesto?")) return;
    eliminarItem(item.type, item.index);
  };

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
  const sheetMinVal = Number(sheetMin) > 0 ? Number(sheetMin) : presupuestoMinSheet;
  const sheetMaxVal = Number(sheetMax) > 0 ? Number(sheetMax) : presupuestoMaxSheet;
  const sheetTotalBase = sheetTipoFijo ? sheetMinVal : sheetMaxVal;

  const mensajeAutoSheet = generarMensajePresupuestoConDatos({
    client,
    bike,
    tareas: order.tareas || [],
    total: sheetTotalBase,
    min: sheetMinVal,
    max: sheetMaxVal,
    nivel: nivelEfectivo,
    adelantoPct: sheetAdelantoPct,
    incluirDatos: sheetIncluirDatos,
    datosCobro: config.datosCobro || {},
    nombreTaller: config.nombreTaller,
  });

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
    ? { label: "Ver / reimprimir comprobante", action: () => setView("imprimirOrden"), className: "bg-zinc-700 text-white" }
    : order.estado === "diagnostico"
      ? { label: "Pasar a presupuesto", action: () => cambiarEstado("presupuesto"), className: "bg-violet-600 text-white" }
      : order.estado === "presupuesto"
        ? presupuestoSent
          ? { label: "Presupuesto enviado", action: abrirSheet, className: "bg-emerald-600 text-white" }
          : { label: "Enviar presupuesto", action: abrirSheet, className: "bg-amber-400 text-zinc-950" }
        : order.estado === "aprobacion"
          ? { label: "Iniciar reparación", action: () => setView("ejecucion"), className: "bg-orange-600 text-white" }
          : order.estado === "reparacion"
            ? { label: "Continuar ejecución", action: () => setView("ejecucion"), className: "bg-orange-600 text-white" }
            : order.estado === "finalizada"
              ? { label: "Finalizar trabajo", action: () => setView("finalizacion"), className: "bg-orange-600 text-white" }
              : order.estado === "listo_para_emitir"
                ? { label: "Registrar cobro", action: () => setView("pago"), className: "bg-green-600 text-white" }
                : order.estado === "cerrado_emitido"
                  ? { label: "Emitir comprobante", action: () => setView("prePdf"), className: "bg-orange-600 text-white" }
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
    <div className="min-h-screen bg-zinc-950 pb-40 text-left text-zinc-100 animate-in slide-in-from-right duration-300">
      {/* Sticky total bar */}
      {res.total > 0 && (
        <div className="fixed bottom-[64px] left-0 right-0 z-40 px-4 pb-2 pointer-events-none">
          <div className="mx-auto max-w-[440px]">
            <div className="rounded-2xl border border-orange-500/25 bg-zinc-950/95 px-4 py-3 shadow-2xl backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total del presupuesto</p>
                  <p className="mt-1 text-xl font-black leading-tight text-white">{formatMoney(res.total)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Estado</p>
                  {saldoPendiente > 0 && (
                    <p className="mt-1 text-xs font-black leading-tight text-red-300">
                      Saldo {formatMoney(saldoPendiente)}
                    </p>
                  )}
                  {saldoPendiente <= 0 && totalPagado > 0 && (
                    <p className="mt-1 text-xs font-black leading-tight text-emerald-300">Pagado</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 px-5 pb-8 pt-5 text-white shadow-2xl">
        <div className="mx-auto max-w-[440px]">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => setView("ordenes")} className="rounded-2xl border-2 border-orange-500/50 bg-orange-600/20 p-3 text-orange-300 hover:text-orange-100 hover:bg-orange-600/40 shadow-lg backdrop-blur transition-all active:scale-90">
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
                  <input
                    type="text"
                    value={clientNombre}
                    onChange={e => setClientNombre(e.target.value)}
                    placeholder="Nombre del cliente"
                    className="w-full bg-black/60 text-white text-sm px-3 py-2 rounded-lg border border-white/10 focus:border-orange-500 outline-none"
                  />
                  <input
                    type="tel"
                    value={clientTel}
                    onChange={e => setClientTel(e.target.value)}
                    placeholder="Teléfono"
                    className="w-full bg-black/60 text-white text-sm px-3 py-2 rounded-lg border border-white/10 focus:border-orange-500 outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={guardarCliente}
                      className="flex-1 bg-orange-600 text-white text-xs font-black py-2 rounded-lg hover:bg-orange-500 active:scale-95"
                    >
                      Guardar
                    </button>
                    <button
                      onClick={() => setEditingClient(false)}
                      className="flex-1 bg-zinc-700 text-zinc-200 text-xs font-black py-2 rounded-lg hover:bg-zinc-600 active:scale-95"
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
                  <p className="text-sm font-black uppercase tracking-tight text-zinc-300 group-hover:text-orange-400 transition-colors">{clientNombre || "Cliente desconocido"}</p>
                  <p className="text-[9px] text-zinc-500 group-hover:text-zinc-400 transition-colors">{clientTel || "Sin teléfono"}</p>
                </button>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Total presupuesto</p>
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
                    ? "scale-105 border-orange-400 bg-orange-600 text-white shadow-orange-500/40"
                    : isDone
                      ? "border-emerald-400 bg-emerald-500 text-white"
                      : "border-zinc-800 bg-zinc-900 text-zinc-500"
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
          <div className="flex items-center gap-3 rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-4 shadow-lg backdrop-blur">
            <div className="rounded-xl bg-orange-500 p-2 text-white"><ShieldCheck size={20} /></div>
            <p className="text-[10px] font-black uppercase leading-tight text-orange-200">Trabajo cerrado: ya se emitió comprobante.</p>
          </div>
        )}

        {!isLocked && order.estado !== "cerrado_emitido" && (
          <button
            onClick={() => setView("gestionarTareas")}
            className="w-full rounded-[1.75rem] border border-orange-500/50 bg-zinc-900 py-4 text-[11px] font-black uppercase tracking-widest text-orange-100 shadow-lg transition-all active:scale-95"
          >
            Gestionar tareas / repuestos
          </button>
        )}

        {accionPrincipal && (
          <button
            onClick={accionPrincipal.action}
            className={`w-full rounded-[1.75rem] py-4 text-[11px] font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 ${accionPrincipal.className}`}
          >
            {accionPrincipal.label}
          </button>
        )}

        {res.total > 0 && (
          <section className="rounded-[2rem] border border-orange-500/25 bg-zinc-900/95 p-4 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-400">Detalle del presupuesto</p>
                <p className="mt-1 text-[10px] font-bold text-zinc-500">Todo lo cargado debe coincidir con el total.</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-black text-white">{formatMoney(res.total)}</p>
                {puedeEditarPresupuesto && (
                  <button
                    type="button"
                    onClick={() => editarDetallePresupuesto()}
                    className="mt-2 rounded-full border border-orange-500/30 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-orange-300 active:scale-95"
                  >
                    Editar
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {detallePresupuesto.filter((grupo) => grupo.total > 0 || grupo.items.length > 0).map((grupo) => (
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
                      {grupo.items.map((item, idx) => (
                        <div key={`${grupo.label}-${idx}`} className="flex items-start justify-between gap-3 text-[10px]">
                          <div className="min-w-0">
                            <p className="truncate font-black uppercase text-zinc-300">{item.nombre}</p>
                            {item.detalle && <p className="font-bold text-zinc-600">{item.detalle}</p>}
                            {puedeEditarPresupuesto && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => editarDetallePresupuesto(item)}
                                  className="rounded-full bg-orange-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-orange-300"
                                >
                                  Cambiar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => eliminarDetallePresupuesto(item)}
                                  className="rounded-full bg-red-500/10 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-red-300"
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                          <p className="shrink-0 font-black text-zinc-200">{formatMoney(item.total)}</p>
                        </div>
                      ))}
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
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-orange-500/20 pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                  {saldoPendiente > 0 ? "Falta cobrar" : "Cobrado"}
                </p>
                <p className={`text-sm font-black ${saldoPendiente > 0 ? "text-red-300" : "text-emerald-300"}`}>
                  {saldoPendiente > 0 ? formatMoney(saldoPendiente) : formatMoney(totalPagado)}
                </p>
              </div>
            </div>
          </section>
        )}
      </div>

      {editandoItem && (
        <EditarItemSheet
          tipo={editandoItem.type}
          datos={editandoItem.data}
          cilindrada={bike.cilindrada}
          onSave={guardarItemEditado}
          onCancel={() => setEditandoItem(null)}
        />
      )}

      {showPresupuestoSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowPresupuestoSheet(false)} />
          <div className="relative w-full max-h-[92vh] overflow-y-auto rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="mx-auto max-w-[440px] p-6 space-y-5">

              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">Enviar Presupuesto</h3>
                <button onClick={() => setShowPresupuestoSheet(false)} className="rounded-xl bg-zinc-800 p-2 text-zinc-400 hover:text-white active:scale-90 transition-all">
                  <X size={18} />
                </button>
              </div>

              <div className="rounded-2xl bg-zinc-800/50 border border-zinc-700 p-4">
                <p className="text-sm font-black text-white">{client.nombre || "Cliente"}</p>
                <p className="text-xs text-zinc-400">{bike.marca || ""} {bike.modelo || ""} {bike.patente ? `— ${bike.patente}` : ""}</p>
              </div>

              <div className="flex gap-2">
                {[{ label: "Fijo", val: true }, { label: "Estimado", val: false }].map(({ label, val }) => (
                  <button
                    key={label}
                    onClick={() => {
                      setSheetTipoFijo(val);
                      if (val) setSheetMax(sheetMin);
                    }}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                      sheetTipoFijo === val
                        ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {sheetTipoFijo ? (
                <div>
                  <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">Monto total</p>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={sheetMin}
                    onChange={(e) => { setSheetMin(e.target.value); setSheetMax(e.target.value); }}
                    placeholder="0"
                    className="w-full text-center text-4xl font-black bg-transparent text-white border-b-2 border-zinc-600 focus:border-orange-500 outline-none py-2"
                  />
                </div>
              ) : (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Mínimo</p>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={sheetMin}
                      onChange={(e) => setSheetMin(e.target.value)}
                      placeholder="0"
                      className="w-full text-center text-2xl font-black bg-transparent text-white border-b-2 border-zinc-600 focus:border-orange-500 outline-none py-2"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 text-center">Máximo</p>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={sheetMax}
                      onChange={(e) => setSheetMax(e.target.value)}
                      placeholder="0"
                      className="w-full text-center text-2xl font-black bg-transparent text-white border-b-2 border-zinc-600 focus:border-orange-500 outline-none py-2"
                    />
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-zinc-500">Adelanto</p>
                <div className="flex gap-2">
                  {[0, 25, 30, 50, 70].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setSheetAdelantoPct(pct)}
                      className={`flex-1 rounded-xl py-2.5 text-xs font-black transition-all active:scale-95 ${
                        sheetAdelantoPct === pct
                          ? "bg-orange-600 text-white shadow-lg shadow-orange-500/30"
                          : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                {sheetAdelantoPct > 0 && (
                  <p className="mt-2 text-center text-sm font-black text-orange-400">
                    Monto: {formatMoney(Math.round(sheetTotalBase * (sheetAdelantoPct / 100)))}
                  </p>
                )}
              </div>

              <button
                onClick={() => setSheetIncluirDatos((v) => !v)}
                className="flex w-full items-center justify-between rounded-2xl bg-zinc-800/50 border border-zinc-700 p-4 active:scale-95 transition-all"
              >
                <span className="text-sm font-black text-zinc-300">Incluir datos de transferencia</span>
                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all ${sheetIncluirDatos ? "border-orange-500 bg-orange-600" : "border-zinc-600 bg-transparent"}`}>
                  {sheetIncluirDatos && <CheckCircle2 size={12} className="text-white" />}
                </div>
              </button>

              <div className="rounded-2xl bg-zinc-800/50 border border-zinc-700 overflow-hidden">
                <button
                  onClick={() => setSheetPreview((v) => !v)}
                  className="flex w-full items-center justify-between p-4"
                >
                  <span className="text-xs font-black uppercase tracking-widest text-zinc-400">Vista previa</span>
                  <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-200 ${sheetPreview ? "rotate-180" : ""}`} />
                </button>
                {sheetPreview && (
                  sheetEditando ? (
                    <div className="px-4 pb-4">
                      <textarea
                        value={sheetMensaje}
                        onChange={(e) => setSheetMensaje(e.target.value)}
                        rows={10}
                        className="w-full bg-zinc-900 text-zinc-200 text-xs rounded-xl p-3 border border-zinc-600 focus:border-orange-500 outline-none resize-none font-mono leading-relaxed"
                      />
                    </div>
                  ) : (
                    <div className="px-4 pb-4">
                      <pre className="whitespace-pre-wrap text-xs text-zinc-300 leading-relaxed font-mono">{mensajeAutoSheet}</pre>
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
                  className="flex-1 rounded-[1.5rem] border border-zinc-600 bg-zinc-800 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-300 hover:bg-zinc-700 active:scale-95 transition-all"
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
