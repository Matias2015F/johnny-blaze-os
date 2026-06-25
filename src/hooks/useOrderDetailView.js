import { useMemo } from "react";
import { LS, crearEntradaHistorial, generateId } from "../lib/storage.js";
import { buildProximoControl } from "../lib/proximoControl.js";
import { CONFIG_DEFAULT, ESTADO_LABEL, TEXTO_CIERRE_RECHAZO, hoyEstable } from "../lib/constants.js";
import { calcularNuevoTotal, calcularResultadosOrden } from "../lib/calc.js";
import { obtenerAprendizaje } from "../lib/priceLearning.js";
import {
  detenerCronometro,
  formatTiempoCorto,
  iniciarCronometro,
  iniciarDiag,
  obtenerTiempoDiagActual,
  pausarCronometro,
  pausarDiag,
  trabajarSinCronometro,
} from "../lib/timer.js";
import { generarMensajePresupuestoConDatos } from "../lib/messages.js";
import { trackEvent } from "../lib/telemetry.js";
import { formatMoney, parseMonto } from "../utils/format.js";

export function useOrderDetailView({ order, bikes, clients }) {
  const config = useMemo(() => LS.getDoc("config", "global") || CONFIG_DEFAULT, []);

  const kmPresets = useMemo(() => {
    const raw = Array.isArray(config?.proximoServiceKmPresets)
      ? config.proximoServiceKmPresets
      : [2500, 5000, 7500, 10000];
    const nums = raw
      .map((n) => (typeof n === "string" ? parseInt(n, 10) : n))
      .filter((n) => Number.isFinite(n) && n > 0)
      .map((n) => Math.round(n));
    return Array.from(new Set(nums)).sort((a, b) => a - b).slice(0, 10);
  }, [config?.proximoServiceKmPresets]);

  const bike   = useMemo(() => bikes.find((x) => x.id === order?.bikeId)  || {}, [bikes,   order?.bikeId]);
  const client = useMemo(() => clients.find((x) => x.id === order?.clientId) || {}, [clients, order?.clientId]);

  const res = useMemo(() => calcularResultadosOrden(order), [order]);

  const derived = useMemo(() => {
    if (!order) return {};
    const esCierreRechazo = order.cierreTipo === "rechazo_cliente";
    const valorHora       = config.valorHoraCliente || 15000;
    const totalPagado     = (order.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
    const saldoPendiente  = res.total - totalPagado;
    const isLocked        = !!order.pdfEntregado;
    const trabajoLabel    = order.numeroTrabajo || `#${order.id.slice(-4).toUpperCase()}`;
    const presupuestoOriginalCierre =
      order.presupuestoOriginalTotal || order.cierreRechazo?.presupuestoOriginalTotal || 0;

    const detallePresupuesto = esCierreRechazo
      ? [
          {
            label: "Cierre por rechazo / pausa",
            note:  presupuestoOriginalCierre > 0
              ? `Presupuesto original no cobrado: ${formatMoney(presupuestoOriginalCierre)}`
              : "Solo figura lo realmente cobrado",
            total: res.total,
            items: [
              {
                type:   "cierre_rechazo",
                index:  0,
                raw:    order.cierreRechazo || {},
                nombre: "Diagnostico / revision facturable",
                detalle: `${formatTiempoCorto(order.cierreRechazo?.horasDiagnostico || 0)} + cargos acordados`,
                total:  res.total,
              },
            ],
          },
        ]
      : [
          {
            label: "Trabajos / mano de obra",
            note:  "Ganancia del taller",
            total: res.desglose.moCliente,
            items: (order.tareas || []).map((item, i) => ({
              type: "tareas", index: i, raw: item,
              nombre: item.nombre || "Trabajo",
              detalle: item.horasBase ? `${item.horasBase} h` : "",
              total: item.monto || 0,
            })),
          },
          {
            label: "Repuestos",
            note:  "Se cobran al cliente al costo",
            total: res.desglose.repuestosCliente,
            items: (order.repuestos || []).map((item, i) => ({
              type: "repuestos", index: i, raw: item,
              nombre: item.nombre || "Repuesto",
              detalle: `Cant. ${item.cantidad || 1}`,
              total: (item.monto || 0) * (item.cantidad || 1),
            })),
          },
          {
            label: "Flete / cadetería",
            note:  "Traslados y búsqueda de repuestos",
            total: res.desglose.fletesCliente,
            items: (order.fletes || []).map((item, i) => ({
              type: "fletes", index: i, raw: item,
              nombre: item.nombre || item.descripcion || "Flete / cadetería",
              detalle: "",
              total: item.monto || 0,
            })),
          },
          {
            label: "Insumos / terceros",
            note:  "Gastos cobrados sin ganancia adicional",
            total: res.desglose.insumosCliente,
            items: (order.insumos || []).map((item, i) => ({
              type: "insumos", index: i, raw: item,
              nombre: item.nombre || "Insumo / tercero",
              detalle: `Cant. ${item.cantidad || 1}`,
              total: (item.monto || 0) * (item.cantidad || 1),
            })),
          },
        ];

    const totalDetallePresupuesto = detallePresupuesto.reduce((s, g) => s + g.total, 0);
    const puedeEditarPresupuesto  = !isLocked && ["diagnostico", "presupuesto"].includes(order.estado);

    const STEPS_ID = ["diagnostico","presupuesto","aprobacion","reparacion","finalizada","listo_para_emitir","cobrado_pendiente_retiro","cerrado_emitido"];
    const currentStepIndex = Math.max(STEPS_ID.findIndex((s) => s === order.estado), 0);

    const dificultades = (order.tareas || []).map((t) => t.dificultad || "normal");
    const nivelRiesgo  = dificultades.some((d) => d === "complicado" || d === "dificil")
      ? "alto"
      : dificultades.length > 0 && dificultades.every((d) => d === "facil")
        ? "bajo"
        : "medio";

    const canApprove = !isLocked && ["aprobacion", "reparacion", "finalizada"].includes(order.estado);
    const presBase   = res.total > 0 ? res.total : 0;

    const estadoPaso = ({
      diagnostico:          "Siguiente paso: armar presupuesto",
      presupuesto:          "Siguiente paso: esperar aprobación",
      aprobacion:           "Siguiente paso: iniciar reparación",
      reparacion:           "Siguiente paso: dejar listo para cobrar",
      finalizada:           "Siguiente paso: registrar pago",
      listo_para_emitir:    "Siguiente paso: emitir comprobante",
      cerrado_emitido:      "Trabajo cerrado con comprobante emitido",
    })[order.estado] || "Revisá este trabajo";

    return {
      esCierreRechazo, valorHora, totalPagado, saldoPendiente, isLocked,
      trabajoLabel, presupuestoOriginalCierre,
      detallePresupuesto, totalDetallePresupuesto, puedeEditarPresupuesto,
      currentStepIndex, nivelRiesgo, canApprove, presBase, estadoPaso,
    };
  }, [order, config, res]);

  // promedioHoras para price learning — depende de tareas y bike.cilindrada
  const promedioHoras = useMemo(() => {
    if (!order) return 1;
    return (order.tareas || []).reduce((sum, tarea) => {
      const apr = obtenerAprendizaje(tarea.nombre, bike.cilindrada);
      return sum + (apr ? apr.promedio : tarea.horasBase || 1);
    }, 0) || 1;
  }, [order, bike.cilindrada]);

  // ── Acciones de dominio ──────────────────────────────────────────────────────

  // Retorna el label del estado nuevo, o false si isLocked. View llama showToast.
  const cambiarEstado = (nuevo) => {
    if (derived.isLocked) return false;
    const entrada = crearEntradaHistorial(order.estado, nuevo);
    LS.updateDoc("trabajos", order.id, {
      estado: nuevo,
      historial: [...(order.historial || []), entrada],
    });
    return ESTADO_LABEL[nuevo];
  };

  const guardarCliente = (nombre, tel) => {
    if (!client?.id) return;
    LS.updateDoc("clientes", client.id, {
      nombre:   nombre || client.nombre,
      tel:      tel    || client.tel,
      telefono: tel    || client.telefono || client.tel,
      whatsapp: tel    || client.whatsapp || client.tel,
    });
  };

  const guardarItemEditado = (type, index, itemData) => {
    const lista     = [...(order[type] || [])];
    lista[index]    = { ...lista[index], ...itemData };
    const tareas    = order.tareas    || [];
    const repuestos = type === "repuestos" ? lista : order.repuestos || [];
    const fletes    = type === "fletes"    ? lista : order.fletes    || [];
    const insumos   = type === "insumos"   ? lista : order.insumos   || [];
    const nTotal    = calcularNuevoTotal(tareas, repuestos, fletes, insumos);
    LS.updateDoc("trabajos", order.id, { [type]: lista, total: nTotal });
  };

  // Retorna false si isLocked. View muestra toast y decide.
  const eliminarItem = (lista, index) => {
    if (derived.isLocked) return false;
    const nuevaLista = [...(order[lista] || [])];
    nuevaLista.splice(index, 1);
    const tareas    = lista === "tareas"    ? nuevaLista : order.tareas    || [];
    const repuestos = lista === "repuestos" ? nuevaLista : order.repuestos || [];
    const fletes    = lista === "fletes"    ? nuevaLista : order.fletes    || [];
    const insumos   = lista === "insumos"   ? nuevaLista : order.insumos   || [];
    const total     = calcularNuevoTotal(tareas, repuestos, fletes, insumos);
    LS.updateDoc("trabajos", order.id, { [lista]: nuevaLista, total });
    return true;
  };

  const confirmarAprobacion = (max) => {
    trackEvent("confirmar_aprobacion", {
      screen: "detalleOrden", entityType: "trabajo", entityId: order.id,
      metadata: { monto: max },
    }).catch(console.error);
    const entrada = crearEntradaHistorial(order.estado, "aprobacion");
    LS.updateDoc("trabajos", order.id, {
      maxAutorizado: max,
      estado: "aprobacion",
      historial: [...(order.historial || []), entrada],
    });
  };

  const toggleAprobacion = (tipo, index, nuevo) => {
    const lista  = [...(order[tipo] || [])];
    const actual = lista[index]?.aprobacion;
    lista[index] = { ...lista[index], aprobacion: actual === nuevo ? "pendiente" : nuevo };
    const tareas    = tipo === "tareas"    ? lista : order.tareas    || [];
    const repuestos = tipo === "repuestos" ? lista : order.repuestos || [];
    const fletes    = tipo === "fletes"    ? lista : order.fletes    || [];
    const insumos   = tipo === "insumos"   ? lista : order.insumos   || [];
    const nTotal    = calcularNuevoTotal(tareas, repuestos, fletes, insumos);
    LS.updateDoc("trabajos", order.id, { [tipo]: lista, total: nTotal });
  };

  const aprobarTodo = () => {
    const apAll = (lista) => (lista || []).map((x) => ({ ...x, aprobacion: "aprobado" }));
    const tareas    = apAll(order.tareas);
    const repuestos = apAll(order.repuestos);
    const fletes    = apAll(order.fletes);
    const insumos   = apAll(order.insumos);
    const nTotal    = calcularNuevoTotal(tareas, repuestos, fletes, insumos);
    LS.updateDoc("trabajos", order.id, { tareas, repuestos, fletes, insumos, total: nTotal });
  };

  const startDiag = () => LS.updateDoc("trabajos", order.id, iniciarDiag(order));
  const pauseDiag = () => LS.updateDoc("trabajos", order.id, pausarDiag(order));

  // Retorna horasLabel (string) para el toast, o null si tiempo < 0.01h.
  const cargarDiag = () => {
    const pausado = pausarDiag(order);
    const horas   = obtenerTiempoDiagActual(order);
    if (horas < 0.01) return null;
    const monto     = Math.round(horas * (derived.valorHora || 15000));
    const nuevaTarea = { nombre: "Diagnóstico / revisión", horasBase: Math.round(horas * 100) / 100, monto };
    const tareas    = [...(order.tareas || []), nuevaTarea];
    const nTotal    = calcularNuevoTotal(tareas, order.repuestos || [], order.fletes || [], order.insumos || []);
    LS.updateDoc("trabajos", order.id, {
      ...pausado, tareas, total: nTotal,
      diagActivo: false, diagInicio: null, diagTiempoMs: 0,
    });
    return formatTiempoCorto(horas);
  };

  const startTimer    = () => LS.updateDoc("trabajos", order.id, iniciarCronometro(order));
  const pauseTimer    = () => LS.updateDoc("trabajos", order.id, pausarCronometro(order));
  const stopTimer     = () => LS.updateDoc("trabajos", order.id, detenerCronometro(order));
  const sinCronometro = () => LS.updateDoc("trabajos", order.id, trabajarSinCronometro(order));

  // Retorna true si guardó, false si parámetros inválidos.
  const guardarProximoControl = ({ unidad, kmObj, diasObj, kmBase }) => {
    let pc;
    if (unidad === "km") {
      if (!kmObj || kmObj <= kmBase) return false;
      pc = buildProximoControl({ tipo: "service", descripcion: "Service general", unidad: "km", valorObjetivo: kmObj - kmBase, kmBase });
    } else {
      if (!diasObj || diasObj <= 0) return false;
      pc = buildProximoControl({ tipo: "service", descripcion: "Service general", unidad: "dias", valorObjetivo: diasObj });
    }
    LS.updateDoc("trabajos", order.id, { proximoControl: pc });
    return true;
  };

  const quitarProximoControl = () => {
    LS.updateDoc("trabajos", order.id, { proximoControl: null });
  };

  // Retorna false si totalCobrado <= 0, true on success. View navega + showToast.
  const cerrarPorRechazo = ({ modo, extraPct, extraMonto, metodo, comprobante, obs, resTotal, pagos }) => {
    const horasDiagnostico = obtenerTiempoDiagActual(order);
    const baseManoObra     = Math.max(0, Math.round(horasDiagnostico * (derived.valorHora || 15000)));
    const extra            = modo === "porcentaje"
      ? Math.round(baseManoObra * (Math.max(0, parseMonto(extraPct)) / 100))
      : Math.max(0, Math.round(parseMonto(extraMonto)));
    const totalCobrado     = Math.max(0, baseManoObra + extra);
    if (totalCobrado <= 0) return false;

    const fecha          = hoyEstable();
    const hora           = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const observacion    = (obs || "").trim() || TEXTO_CIERRE_RECHAZO;
    const pausado        = pausarDiag(order);
    const pagadoPrevio   = (pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
    const totalFinalCierre = pagadoPrevio + totalCobrado;

    const pago = {
      id: generateId(), fecha, hora,
      monto: totalCobrado, metodo, comprobante,
      tipo: "rechazo_presupuesto",
      concepto: "Diagnostico por presupuesto rechazado o pospuesto",
    };
    const entrada = crearEntradaHistorial(order.estado, "listo_para_emitir");

    LS.updateDoc("trabajos", order.id, {
      ...pausado,
      estado: "listo_para_emitir",
      cierreTipo: "rechazo_cliente",
      presupuestoOriginalTotal: resTotal,
      costoFinal:  totalFinalCierre,
      total:       totalFinalCierre,
      pagos:       [...(pagos || []), pago],
      garantiaFinal: observacion,
      vencimientoGarantia: "",
      cierreRechazo: {
        fecha, hora,
        horasDiagnostico: Math.round(horasDiagnostico * 100) / 100,
        valorHora:    derived.valorHora,
        baseManoObra,
        extraTipo:    modo,
        extraPct:     modo === "porcentaje" ? Math.max(0, parseMonto(extraPct)) : 0,
        extraMonto:   extra,
        montoCobradoAlCerrar: totalCobrado,
        totalCobrado: totalFinalCierre,
        observacion,
        presupuestoOriginalTotal: resTotal,
      },
      historial: [...(order.historial || []), entrada],
    });

    LS.addDoc("caja", {
      fecha, hora, tipo: "ingreso",
      concepto:    `Diagnostico por rechazo ${derived.trabajoLabel || ""}`.trim(),
      monto:       totalCobrado,
      metodo, comprobante,
      orderId:     order.id,
      categoria:   "rechazo_presupuesto",
    });

    trackEvent("cerrar_presupuesto_rechazado", {
      screen: "detalleOrden", entityType: "trabajo", entityId: order.id,
      metadata: { totalCobrado: totalFinalCierre, montoCobradoAlCerrar: totalCobrado, baseManoObra, extra, presupuestoOriginalTotal: resTotal },
    }).catch(console.error);

    return true;
  };

  // LS write + cambiarEstado + trackEvent. View llama abrirWhatsApp antes.
  const marcarPresupuestoEnviado = (tipoPresupuesto) => {
    LS.updateDoc("trabajos", order.id, { tipoPresupuesto });
    cambiarEstado("aprobacion");
    trackEvent("enviar_presupuesto_whatsapp", {
      screen: "detalleOrden", entityType: "trabajo", entityId: order.id,
      metadata: { tipoPresupuesto },
    }).catch(console.error);
  };

  // Genera el texto del mensaje de presupuesto. View llama abrirWhatsApp con el resultado.
  const buildMensajePresupuesto = ({ sheetMin, sheetMax, sheetTipoFijo, sheetAdelantoPct, sheetIncluirDatos }) => {
    const sheetMinVal    = Number(sheetMin) > 0 ? Number(sheetMin) : derived.presBase;
    const sheetMaxVal    = Number(sheetMax) > 0 ? Number(sheetMax) : derived.presBase;
    const sheetTotalBase = sheetTipoFijo ? sheetMinVal : sheetMaxVal;
    const nivelEfectivo  = sheetTipoFijo ? "bajo" : derived.nivelRiesgo;
    return generarMensajePresupuestoConDatos({
      client, bike,
      tareas:    order.tareas    || [],
      repuestos: order.repuestos || [],
      total:     sheetTotalBase,
      min:       sheetMinVal,
      max:       sheetMaxVal,
      nivel:     nivelEfectivo,
      adelantoPct:   sheetAdelantoPct,
      incluirDatos:  sheetIncluirDatos,
      datosCobro:    config.datosCobro || {},
      nombreTaller:  config.nombreTaller,
    });
  };

  return {
    bike, client, config, kmPresets, res, promedioHoras,
    ...derived,
    // Actions
    cambiarEstado,
    guardarCliente,
    guardarItemEditado,
    eliminarItem,
    confirmarAprobacion,
    toggleAprobacion,
    aprobarTodo,
    startDiag, pauseDiag, cargarDiag,
    startTimer, pauseTimer, stopTimer, sinCronometro,
    guardarProximoControl,
    quitarProximoControl,
    cerrarPorRechazo,
    marcarPresupuestoEnviado,
    buildMensajePresupuesto,
  };
}
