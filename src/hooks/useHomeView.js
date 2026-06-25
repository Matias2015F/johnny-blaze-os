import { useEffect, useMemo } from "react";
import { auth } from "../firebase.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { evaluarEstado } from "../lib/calc.js";
import { evaluarEstadoRecordatorio, generarMensajeWhatsApp } from "../lib/proximoControl.js";
import { LS, useCollection } from "../lib/storage.js";
import { trackEvent } from "../lib/telemetry.js";
import { obtenerTiempoActual } from "../lib/timer.js";
import { normalizarTelWA } from "../lib/messages.js";
import { abrirEnlaceExterno } from "../lib/whatsappService.js";

const ORDEN_PRIORIDAD = { BLOQUEADO: 0, ALERTA: 1, NORMAL: 2 };
const ALERTAS_NOTIFICADAS_KEY = "jbos_alertas_notificadas_v1";

// Traduce estado de cronometro a tokens semanticos consumibles por Badge
const CRON_TOKEN = {
  NORMAL:    { variant: "success", label: "Normal" },
  ALERTA:    { variant: "warning", label: "Atencion" },
  BLOQUEADO: { variant: "error",   label: "Detenido" },
};

// Traduce estado de orden a accion urgente — sin CSS, solo semantica
const ACCION_CONFIG = {
  listo_para_emitir: { label: "Emitir comprobante",  urgency: "ready",    urgenciaOrder: 1 },
  presupuesto:       { label: "Enviar presupuesto",   urgency: "document", urgenciaOrder: 3 },
  aprobacion:        { label: "Reenviar aprobacion",  urgency: "waiting",  urgenciaOrder: 4 },
  diagnostico:       { label: "Armar presupuesto",    urgency: "neutral",  urgenciaOrder: 6 },
};

function leerAlertasNotificadas() {
  try {
    return JSON.parse(localStorage.getItem(ALERTAS_NOTIFICADAS_KEY) || "{}");
  } catch {
    return {};
  }
}

function guardarAlertaNotificada(id, estado) {
  const actuales = leerAlertasNotificadas();
  actuales[id] = estado;
  localStorage.setItem(ALERTAS_NOTIFICADAS_KEY, JSON.stringify(actuales));
}

function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [[880, 0], [660, 0.22], [880, 0.44]].forEach(([freq, start]) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      osc.start(t);
      osc.stop(t + 0.2);
    });
    setTimeout(() => ctx.close().catch(() => {}), 1200);
  } catch { /* ignorar si el browser bloquea AudioContext */ }
}

export function useHomeView({ orders, bikes, presupuestos = [] }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const recordatorios = useCollection("recordatorios");
  const clients = useCollection("clientes");
  const user = auth.currentUser;
  const valorHora = config.valorHoraCliente || 15000;

  // Toda la logica de negocio derivada de ordenes en un unico useMemo
  const { ordenesActivas, accionesUrgentes, stats } = useMemo(() => {
    const hoy = new Date().toLocaleDateString("sv-SE");

    const enriched = (orders || [])
      .filter((o) => o.estado !== "cerrado_emitido")
      .map((o) => {
        const tiempoHoras = obtenerTiempoActual(o);
        const { estadoCron, costoActual } = evaluarEstado({
          tiempoHoras,
          valorHora,
          maxAutorizado: o.maxAutorizado || 0,
        });
        const token = CRON_TOKEN[estadoCron] || CRON_TOKEN.NORMAL;
        const bike = bikes?.find((b) => b.id === o.bikeId) || {};
        return { ...o, bike, estadoCron, costoActual, token };
      })
      .sort((a, b) => ORDEN_PRIORIDAD[a.estadoCron] - ORDEN_PRIORIDAD[b.estadoCron]);

    // Shape publica para la vista: sin campos internos de negocio
    const ordenesActivas = enriched.map((o) => ({
      id: o.id,
      patente: o.bike.patente || "---",
      marca: o.bike.marca || "",
      modelo: o.bike.modelo || "",
      statusVariant: o.token.variant,
      statusLabel: o.token.label,
      costoActual: o.costoActual,
      maxAutorizado: o.maxAutorizado || 0,
    }));

    const alerta    = enriched.filter((o) => o.estadoCron === "ALERTA").length;
    const bloqueado = enriched.filter((o) => o.estadoCron === "BLOQUEADO").length;

    const totalPendienteCobro = enriched.reduce((sum, o) => {
      const pagado = (o.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
      return sum + Math.max((o.total || 0) - pagado, 0);
    }, 0);

    const listasParaEntregar = enriched.filter(
      (o) => o.estado === "finalizada" || o.estado === "listo_para_emitir"
    ).length;

    const ingresosHoy = (orders || []).filter((o) => {
      const fecha = o.fechaIngreso || (o.createdAt ? new Date(o.createdAt).toLocaleDateString("sv-SE") : "");
      return fecha === hoy;
    }).length;

    const cobradoHoy = (orders || [])
      .flatMap((o) => o.pagos || [])
      .filter((p) => (p.fecha || "").slice(0, 10) === hoy)
      .reduce((s, p) => s + (p.monto || 0), 0);

    const presupuestosActivos = (presupuestos || []).filter(
      (p) => p.estado === "borrador" || p.estado === "enviado"
    ).length;

    const accionesUrgentes = enriched
      .map((o) => {
        const totalPagado = (o.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
        const saldo = (o.total || 0) - totalPagado;
        let accion = ACCION_CONFIG[o.estado] ? { ...ACCION_CONFIG[o.estado] } : null;
        if (o.estado === "finalizada" && saldo > 0)
          accion = { label: "Cobrar saldo",     urgency: "payment", urgenciaOrder: 2 };
        if (o.estado === "reparacion" && o.estadoCron === "BLOQUEADO")
          accion = { label: "Trabajo detenido", urgency: "blocked", urgenciaOrder: 5 };
        if (!accion) return null;
        return {
          orderId: o.id,
          patente: o.bike.patente || "---",
          marca:   o.bike.marca   || "",
          modelo:  o.bike.modelo  || "",
          accion,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.accion.urgenciaOrder - b.accion.urgenciaOrder)
      .slice(0, 5);

    return {
      ordenesActivas,
      accionesUrgentes,
      stats: {
        alerta,
        bloqueado,
        totalPendienteCobro,
        listasParaEntregar,
        ingresosHoy,
        cobradoHoy,
        presupuestosActivos,
        totalOrdenes: enriched.length,
      },
    };
  }, [orders, bikes, presupuestos, valorHora]);

  // Alertas de service — depende de recordatorios/bikes/clients
  const alertasService = useMemo(() => {
    return (recordatorios || [])
      .filter((r) => r.estado === "pendiente" || r.estado === "avisado")
      .map((r) => {
        const moto    = bikes?.find((b) => b.id === r.motoId);
        const cliente = clients?.find((c) => c.id === r.clienteId);
        const kmActual = moto?.kilometrajeActual || moto?.km;
        const estado   = evaluarEstadoRecordatorio(r, kmActual);
        return { ...r, moto, cliente, estado };
      })
      .filter((r) => r.estado === "proximo_service" || r.estado === "service_vencido")
      .sort((a) => (a.estado === "service_vencido" ? -1 : 1));
  }, [recordatorios, bikes, clients]);

  // Side effect: notificaciones del browser
  useEffect(() => {
    const habilitadas = config.alertasNavegadorActivas ?? true;
    if (!habilitadas || !alertasService.length || typeof window === "undefined" || !("Notification" in window)) return;
    const NotificationApi = window.Notification;

    const lanzar = () => {
      const yaNotificadas = leerAlertasNotificadas();
      let hayNuevas = false;
      alertasService.forEach((r) => {
        const claveEstado = `${r.estado}-${r.enviado ? "avisado" : "pendiente"}`;
        if (yaNotificadas[r.id] === claveEstado) return;
        hayNuevas = true;
        const titulo = r.estado === "service_vencido" ? "Service vencido" : "Proximo service";
        const cuerpo = `${r.moto?.patente || "---"} · ${r.descripcion}`;
        const notif = new NotificationApi(titulo, { body: cuerpo, silent: false });
        notif.onclick = () => window.focus();
        guardarAlertaNotificada(r.id, claveEstado);
      });
      if (hayNuevas) playBeep();
    };

    if (NotificationApi.permission === "granted") { lanzar(); return; }
    if (NotificationApi.permission === "default") {
      NotificationApi.requestPermission().then((p) => { if (p === "granted") lanzar(); }).catch(() => {});
    }
  }, [alertasService, config.alertasNavegadorActivas]);

  // Side effect: telemetria de apertura
  useEffect(() => {
    trackEvent("open_home", { screen: "home" }).catch(console.error);
  }, []);

  // Acciones — mutacion + side effects encapsulados
  const enviarWhatsAppRecordatorio = (rec) => {
    const msg = generarMensajeWhatsApp(rec.cliente, rec.moto, rec, config);
    const tel = rec.cliente?.whatsapp || rec.cliente?.telefono || rec.cliente?.tel || "";
    trackEvent("recordatorio_whatsapp", {
      screen: "home",
      entityType: "recordatorio",
      entityId: rec.id,
      metadata: { estado: rec.estado, testMode: !!rec.testMode },
    }).catch(console.error);
    abrirEnlaceExterno(`https://wa.me/${normalizarTelWA(tel)}?text=${encodeURIComponent(msg)}`);
    LS.updateDoc("recordatorios", rec.id, { estado: "avisado", enviado: true });
  };

  const descartarRecordatorio = (id) => {
    LS.updateDoc("recordatorios", id, { estado: "hecho" });
  };

  return {
    userLabel: user?.email || user?.phoneNumber || "",
    stats,
    ordenesActivas,
    alertasService,
    accionesUrgentes,
    config,
    enviarWhatsAppRecordatorio,
    descartarRecordatorio,
  };
}
