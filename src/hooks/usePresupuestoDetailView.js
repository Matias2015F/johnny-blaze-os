import { useEffect, useMemo, useState } from "react";
import { db, auth } from "../firebase.js";
import { getDoc, updateDoc, doc } from "firebase/firestore";
import { LS, generateId } from "../lib/storage.js";
import { CONFIG_DEFAULT, TEXTO_CIERRE_RECHAZO, hoyEstable } from "../lib/constants.js";
import { generarMensajePresupuestoConDatos, abrirWhatsApp, normalizarTelWA } from "../lib/messages.js";
import { iniciarCronometro, pausarCronometro, obtenerTiempoActual } from "../lib/timer.js";

// Tokens semánticos exportados — la vista los mapea a CSS
export const ESTADO_TOKEN = {
  borrador:   { label: "Borrador",          variant: "muted" },
  enviado:    { label: "Enviado al cliente", variant: "info" },
  aprobado:   { label: "Aprobado",          variant: "success" },
  rechazado:  { label: "Rechazado",         variant: "danger" },
  convertido: { label: "Convertido a OT",   variant: "warning" },
};

export function usePresupuestoDetailView({ presupuesto, bike, client }) {
  const [beneficio, setBeneficio] = useState(null);

  // clienteBeneficios no está en DATA_COLS — getDoc puntual es correcto, no es suscripción
  useEffect(() => {
    const patente = String(bike?.patente || "").trim().toUpperCase().replace(/\s+/g, "");
    const uid     = auth.currentUser?.uid;
    const estado  = presupuesto?.estado;
    const finalizado = estado === "convertido" || estado === "rechazado";

    if (!uid || !patente || finalizado || !presupuesto) {
      setBeneficio(null);
      return;
    }

    getDoc(doc(db, "users", uid, "clienteBeneficios", patente))
      .then((snap) => setBeneficio(
        snap.exists() && snap.data()?.estado === "activo" ? snap.data() : null
      ))
      .catch(() => setBeneficio(null));
  }, [bike?.patente, presupuesto?.estado]);

  const config = useMemo(() => LS.getDoc("config", "global") || CONFIG_DEFAULT, []);

  const totales = useMemo(() => {
    if (!presupuesto) return { manoObra: 0, repuestos: 0, insumos: 0, fletes: 0 };
    return {
      manoObra:  (presupuesto.tareas    || []).reduce((s, t) => s + (t.monto || 0), 0),
      repuestos: (presupuesto.repuestos || []).reduce((s, r) => s + (r.monto || 0) * (r.cantidad || 1), 0),
      insumos:   (presupuesto.insumos   || []).reduce((s, i) => s + (i.monto || 0) * (i.cantidad || 1), 0),
      fletes:    (presupuesto.fletes    || []).reduce((s, f) => s + (f.monto || 0), 0),
    };
  }, [presupuesto]);

  const yaFinalizado   = presupuesto?.estado === "convertido" || presupuesto?.estado === "rechazado";
  const tiempoAcumulado = presupuesto ? obtenerTiempoActual(presupuesto) : 0;

  // ── Acciones de dominio ──────────────────────────────────────────────────────

  const toggleCronometro = () => {
    if (!presupuesto) return;
    const { id } = presupuesto;
    if (presupuesto.cronometroActivo) {
      const updated = pausarCronometro(presupuesto);
      LS.updateDoc("presupuestos", id, {
        cronometroActivo: false,
        inicioCronometro: null,
        tiempoReal:       updated.tiempoReal,
        updatedAt:        Date.now(),
      });
    } else {
      const updated = iniciarCronometro(presupuesto);
      LS.updateDoc("presupuestos", id, {
        cronometroActivo:  true,
        inicioCronometro:  updated.inicioCronometro,
        updatedAt:         Date.now(),
      });
    }
  };

  // LS write only — el toast lo llama la vista con el label del token
  const actualizarEstado = (nuevoEstado, extra = {}) => {
    if (!presupuesto) return;
    const pausaExtra = {};
    if (presupuesto.cronometroActivo) {
      const updated = pausarCronometro(presupuesto);
      pausaExtra.cronometroActivo = false;
      pausaExtra.inicioCronometro = null;
      pausaExtra.tiempoReal       = updated.tiempoReal;
    }
    LS.updateDoc("presupuestos", presupuesto.id, {
      estado: nuevoEstado,
      ...pausaExtra,
      ...extra,
      updatedAt: Date.now(),
    });
  };

  // Crea trabajoCierre + registro en caja, retorna nuevoTrabajoId para que la vista navegue
  const confirmarRechazo = (cierre) => {
    if (!presupuesto) return null;
    const { id, numeroPresupuesto, estado, tareas = [], repuestos = [], insumos = [], fletes = [], total = 0, motivoConsulta } = presupuesto;
    const fecha = hoyEstable();
    const hora  = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const observacion = cierre.observacion || TEXTO_CIERRE_RECHAZO;

    const pago = {
      id:          generateId(),
      fecha, hora,
      monto:       cierre.totalCobrado,
      metodo:      cierre.metodo || "efectivo",
      comprobante: cierre.comprobante || "",
      tipo:        "rechazo_presupuesto",
      concepto:    "Diagnostico por presupuesto rechazado o pospuesto",
    };

    const trabajoCierre = {
      numeroTrabajo:        `CIE-${numeroPresupuesto || id.slice(-6).toUpperCase()}`,
      presupuestoId:        id,
      fechaIngreso:         fecha,
      fecha,
      clientId:             presupuesto.clientId,
      bikeId:               presupuesto.bikeId,
      estado:               "listo_para_emitir",
      prioridad:            "normal",
      diagnostico:          motivoConsulta || "Presupuesto rechazado o pospuesto.",
      tareas, repuestos, insumos, fletes,
      total:                cierre.totalCobrado,
      costoFinal:           cierre.totalCobrado,
      pagos:                [pago],
      cierreTipo:           "rechazo_cliente",
      presupuestoOriginalTotal: total,
      garantiaFinal:        observacion,
      vencimientoGarantia:  "",
      motivoRechazo:        cierre.motivo || "",
      cierreRechazo: {
        fecha, hora,
        horasDiagnostico:   Math.round((cierre.horasDiagnostico || 0) * 100) / 100,
        valorHora:          cierre.valorHora,
        baseManoObra:       cierre.baseManoObra,
        extraTipo:          cierre.extraTipo,
        extraPct:           cierre.extraPct,
        extraMonto:         cierre.extraMonto,
        montoCobradoAlCerrar: cierre.totalCobrado,
        totalCobrado:       cierre.totalCobrado,
        observacion,
        motivo:             cierre.motivo || "",
        presupuestoOriginalTotal: total,
      },
      historial: [{
        fecha:  new Date().toISOString(),
        de:     estado,
        a:      "listo_para_emitir",
        nota:   "Presupuesto rechazado o pospuesto. Se cobra diagnostico facturable.",
      }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const nuevoTrabajo = LS.addDoc("trabajos", trabajoCierre);
    LS.addDoc("caja", {
      fecha, hora,
      tipo:        "ingreso",
      concepto:    `Diagnostico por rechazo ${bike?.patente || numeroPresupuesto || ""}`.trim(),
      monto:       cierre.totalCobrado,
      metodo:      cierre.metodo || "efectivo",
      comprobante: cierre.comprobante || "",
      orderId:     nuevoTrabajo.id,
      presupuestoId: id,
      categoria:   "rechazo_presupuesto",
    });
    actualizarEstado("rechazado", {
      cronometroActivo: false,
      inicioCronometro: null,
      motivoRechazo:    cierre.motivo || "",
      fechaRechazo:     Date.now(),
      cierreTipo:       "rechazo_cliente",
      cierreTrabajoId:  nuevoTrabajo.id,
      cierreRechazo:    trabajoCierre.cierreRechazo,
    });

    return nuevoTrabajo.id;
  };

  const marcarBeneficioUsado = async () => {
    if (!beneficio || !presupuesto) return;
    const patente = String(bike?.patente || "").trim().toUpperCase().replace(/\s+/g, "");
    const uid = auth.currentUser?.uid;
    if (!uid || !patente) return;
    try {
      await updateDoc(doc(db, "users", uid, "clienteBeneficios", patente), {
        estado:    "usado",
        usadoEn:   Date.now(),
        ordenUsada: presupuesto.id,
      });
      setBeneficio(null);
    } catch (e) {
      console.warn("[beneficio] no se pudo marcar como usado:", e.message);
    }
  };

  // Retorna true si OK, false si no hay teléfono (la vista llama showToast)
  const enviarPresupuestoWhatsApp = () => {
    if (!presupuesto || !client) return false;
    const { tareas = [], repuestos = [], total = 0, id, estado } = presupuesto;
    const tel     = client?.whatsapp || client?.tel || client?.telefono || "";
    const telNorm = normalizarTelWA(tel);
    if (!telNorm) return false;

    const presupuestoConfig = config.presupuestoConfig || CONFIG_DEFAULT.presupuestoConfig;
    const datosCobro = {
      titular: config.titular || config.nombreTaller || "",
      alias:   config.alias   || "",
      cbu:     config.cbu     || "",
    };
    const incluirDatos = presupuestoConfig.incluirAlias || presupuestoConfig.incluirCBU;

    const msg = generarMensajePresupuestoConDatos({
      client, bike, tareas, repuestos, total,
      adelantoPct:          presupuestoConfig.adelantoPct || 0,
      incluirDatos, datosCobro,
      nombreTaller:         config.nombreTaller || "",
      beneficioCalificacion: beneficio,
    });

    abrirWhatsApp(telNorm, msg);

    if (estado === "borrador") {
      LS.updateDoc("presupuestos", id, { estado: "enviado", updatedAt: Date.now() });
    }
    if (beneficio) marcarBeneficioUsado();

    return true;
  };

  return {
    config, beneficio,
    totales, yaFinalizado, tiempoAcumulado,
    toggleCronometro,
    actualizarEstado,
    confirmarRechazo,
    enviarPresupuestoWhatsApp,
    getEstadoToken: (estado) => ESTADO_TOKEN[estado] || ESTADO_TOKEN.borrador,
  };
}
