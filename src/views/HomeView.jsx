import React, { useEffect } from "react";
import { Bell, Calendar, Clock, History, LogOut, MessageCircle, PlusCircle, ReceiptText, Wrench } from "lucide-react";
import { auth } from "../firebase.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { evaluarEstado } from "../lib/calc.js";
import { evaluarEstadoRecordatorio, generarMensajeWhatsApp } from "../lib/proximoControl.js";
import { LS, useCollection } from "../lib/storage.js";
import { trackEvent } from "../lib/telemetry.js";
import { obtenerTiempoActual } from "../lib/timer.js";
import { formatMoney } from "../utils/format.js";

const ESTADO_BADGE = {
  NORMAL: "bg-green-500/20 text-green-300 border-green-500/30",
  ALERTA: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  BLOQUEADO: "bg-red-500/20 text-red-300 border-red-500/30",
};

const ESTADO_LABEL_CRON = {
  NORMAL: "Normal",
  ALERTA: "Atención",
  BLOQUEADO: "Detenido",
};

const ORDEN_ESTADO = { BLOQUEADO: 0, ALERTA: 1, NORMAL: 2 };
const ALERTAS_NOTIFICADAS_KEY = "jbos_alertas_notificadas_v1";

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

export default function HomeView({ setView, bikes, orders, setSelectedOrderId, handleLogout }) {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const recordatorios = useCollection("recordatorios");
  const clients = useCollection("clientes");
  const user = auth.currentUser;
  const userLabel = user?.email || user?.phoneNumber || "";
  const valorHora = config.valorHoraCliente || 15000;

  const ordenesActivas = (orders || [])
    .filter((order) => order.estado !== "cerrado_emitido")
    .map((order) => {
      const tiempoHoras = obtenerTiempoActual(order);
      const { estadoCron, costoActual } = evaluarEstado({
        tiempoHoras,
        valorHora,
        maxAutorizado: order.maxAutorizado || 0,
      });
      return { ...order, estadoCron, costoActual };
    })
    .sort((a, b) => ORDEN_ESTADO[a.estadoCron] - ORDEN_ESTADO[b.estadoCron]);

  const alertasService = (recordatorios || [])
    .filter((recordatorio) => recordatorio.estado === "pendiente" || recordatorio.estado === "avisado")
    .map((recordatorio) => {
      const moto = bikes?.find((item) => item.id === recordatorio.motoId);
      const cliente = clients?.find((item) => item.id === recordatorio.clienteId);
      const kmActual = moto?.kilometrajeActual || moto?.km;
      const estado = evaluarEstadoRecordatorio(recordatorio, kmActual);
      return { ...recordatorio, moto, cliente, estado };
    })
    .filter((recordatorio) => recordatorio.estado === "proximo_service" || recordatorio.estado === "service_vencido")
    .sort((a, b) => (a.estado === "service_vencido" ? -1 : 1));

  useEffect(() => {
    const habilitadas = config.alertasNavegadorActivas ?? true;
    if (!habilitadas || typeof window === "undefined" || !("Notification" in window)) return;
    if (!alertasService.length) return;
    const NotificationApi = window.Notification;

    const lanzar = () => {
      const yaNotificadas = leerAlertasNotificadas();
      alertasService.forEach((recordatorio) => {
        const claveEstado = `${recordatorio.estado}-${recordatorio.enviado ? "avisado" : "pendiente"}`;
        if (yaNotificadas[recordatorio.id] === claveEstado) return;

        const titulo = recordatorio.estado === "service_vencido" ? "Service vencido" : "Próximo service";
        const cuerpo = `${recordatorio.moto?.patente || "---"} · ${recordatorio.descripcion}`;
        const notification = new NotificationApi(titulo, { body: cuerpo, silent: false });
        notification.onclick = () => window.focus();
        guardarAlertaNotificada(recordatorio.id, claveEstado);
      });
    };

    if (NotificationApi.permission === "granted") {
      lanzar();
      return;
    }

    if (NotificationApi.permission === "default") {
      NotificationApi.requestPermission().then((permiso) => {
        if (permiso === "granted") lanzar();
      }).catch(() => {});
    }
  }, [alertasService, config.alertasNavegadorActivas]);

  const alerta = ordenesActivas.filter((order) => order.estadoCron === "ALERTA").length;
  const bloqueado = ordenesActivas.filter((order) => order.estadoCron === "BLOQUEADO").length;
  const totalPendienteCobro = ordenesActivas.reduce((sum, order) => {
    const totalPagado = (order.pagos || []).reduce((acc, pago) => acc + (pago.monto || 0), 0);
    const saldo = (order.total || 0) - totalPagado;
    return sum + Math.max(saldo, 0);
  }, 0);

  useEffect(() => {
    trackEvent("open_home", { screen: "home" }).catch(console.error);
  }, []);

  return (
    <div className="space-y-5 p-4 pb-28 text-left animate-in fade-in duration-500">
      <header className="rounded-[2.5rem] border border-white/10 bg-gradient-to-br from-blue-600/20 via-slate-900 to-slate-950 p-8 shadow-2xl backdrop-blur">
        <div className="font-bold">
          <p className="mb-1 text-xs font-black uppercase tracking-[0.4em] text-blue-500">Taller OS</p>
          <h1 className="mb-1 text-4xl font-black leading-none tracking-tighter text-white">JOHNNY BLAZE</h1>
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="max-w-[75%] truncate text-[10px] font-normal text-slate-400">{userLabel}</p>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:text-red-400 active:scale-95"
            >
              <LogOut size={13} /> Salir
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300">Trabajos activos</p>
              <p className="mt-2 text-2xl font-black text-emerald-400">{ordenesActivas.length}</p>
              <p className="mt-1 text-[10px] font-bold text-emerald-600">En movimiento hoy</p>
            </div>
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-blue-300">Pendiente de cobro</p>
              <p className="mt-2 text-2xl font-black text-blue-400">{formatMoney(totalPendienteCobro)}</p>
              <p className="mt-1 text-[10px] font-bold text-blue-600">Saldo total</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-yellow-300">Atención</p>
              <p className="mt-2 text-2xl font-black text-yellow-400">{alerta}</p>
              <p className="mt-1 text-[10px] font-bold text-yellow-600">Cerca del límite</p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-red-300">Detenidos</p>
              <p className="mt-2 text-2xl font-black text-red-400">{bloqueado}</p>
              <p className="mt-1 text-[10px] font-bold text-red-600">Necesitan acción</p>
            </div>
          </div>
        </div>
      </header>

      <button onClick={() => {
        trackEvent("nuevo_ingreso", { screen: "home" }).catch(console.error);
        setView("nuevaOrden");
      }} className="w-full rounded-[2.5rem] bg-blue-600 p-8 text-white shadow-xl transition-all active:scale-[0.98]">
        <div className="flex items-center gap-5 text-left font-bold">
          <div className="rounded-3xl bg-white/20 p-4"><PlusCircle size={32} /></div>
          <div>
            <p className="mb-1 text-2xl font-black uppercase leading-none tracking-tighter">Nuevo ingreso</p>
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Ingresar moto al taller</p>
          </div>
        </div>
      </button>

      <button onClick={() => setView("agenda")} className="w-full rounded-[2rem] border border-blue-500/20 bg-blue-500/10 p-5 text-left shadow-xl transition-all active:scale-95">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-blue-600/20 p-3">
            <Calendar className="text-blue-400" size={24} />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-white">Agenda semanal</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Ocupación y trabajos por día</p>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => {
          trackEvent("open_trabajos", { screen: "home" }).catch(console.error);
          setView("ordenes");
        }} className="rounded-[2rem] border border-slate-800 bg-slate-900 p-5 text-left shadow-xl transition-all active:scale-95">
          <Clock className="text-blue-400" size={24} />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-white">Trabajos</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Ver y seguir trabajos activos</p>
        </button>
        <button onClick={() => {
          trackEvent("open_pagos", { screen: "home" }).catch(console.error);
          setView("pagosView");
        }} className="rounded-[2rem] border border-slate-800 bg-slate-900 p-5 text-left shadow-xl transition-all active:scale-95">
          <ReceiptText className="text-emerald-400" size={24} />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-white">Pagos</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Cobrar y emitir comprobantes</p>
        </button>
        <button onClick={() => {
          trackEvent("open_historial", { screen: "home" }).catch(console.error);
          setView("historial");
        }} className="rounded-[2rem] border border-slate-800 bg-slate-900 p-5 text-left shadow-xl transition-all active:scale-95">
          <History className="text-blue-400" size={24} />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-white">Historial</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Buscar patente, cliente o comprobante</p>
        </button>
        <button onClick={() => {
          trackEvent("open_config", { screen: "home" }).catch(console.error);
          setView("config");
        }} className="rounded-[2rem] border border-slate-800 bg-slate-900 p-5 text-left shadow-xl transition-all active:scale-95">
          <Wrench className="text-slate-300" size={24} />
          <p className="mt-4 text-xs font-black uppercase tracking-widest text-white">Más</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">Configuración y herramientas</p>
        </button>
      </div>

      {alertasService.length > 0 && (
        <div className="rounded-[2.5rem] border border-yellow-500/30 bg-gradient-to-br from-yellow-500/15 to-orange-500/10 p-5 shadow-xl backdrop-blur space-y-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-yellow-300">
              <Bell size={16} /> {alertasService.length} Notificación{alertasService.length !== 1 ? 'es' : ''} pendiente{alertasService.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-3">
            {alertasService.map((recordatorio) => (
              <div
                key={recordatorio.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  recordatorio.estado === "service_vencido"
                    ? "border-red-500/40 bg-red-500/25"
                    : "border-yellow-500/40 bg-yellow-500/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-black uppercase tracking-tight text-white">
                      {recordatorio.moto?.patente || "---"} · {recordatorio.moto?.marca || ""} {recordatorio.moto?.modelo || ""}
                    </p>
                    <p className="mt-1 text-xs text-white font-bold">👤 {recordatorio.cliente?.nombre || "Cliente"}</p>
                    <p className={`mt-2 text-[10px] font-black uppercase ${recordatorio.estado === "service_vencido" ? "text-red-300" : "text-yellow-300"}`}>
                      {recordatorio.estado === "service_vencido" ? "⚠️ SERVICE VENCIDO" : "🔔 PRÓXIMO SERVICE"} · {recordatorio.descripcion}
                    </p>
                    {recordatorio.kmObjetivo && (
                      <p className="mt-2 text-[9px] text-slate-200">
                        Km actual: <span className="font-black text-white">{(recordatorio.moto?.kilometrajeActual || recordatorio.moto?.km || 0).toLocaleString("es-AR")}</span> / Objetivo: <span className="font-black text-white">{recordatorio.kmObjetivo.toLocaleString("es-AR")} km</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => LS.updateDoc("recordatorios", recordatorio.id, { estado: "hecho" })}
                    className="shrink-0 text-slate-400 hover:text-red-400 text-2xl font-black active:scale-110 transition-colors"
                    title="Cerrar notificación"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      const msg = generarMensajeWhatsApp(recordatorio.cliente, recordatorio.moto, recordatorio, config);
                      const tel = recordatorio.cliente?.whatsapp || recordatorio.cliente?.telefono || recordatorio.cliente?.tel || "";
                      trackEvent("recordatorio_whatsapp", {
                        screen: "home",
                        entityType: "recordatorio",
                        entityId: recordatorio.id,
                        metadata: { estado: recordatorio.estado, testMode: !!recordatorio.testMode },
                      }).catch(console.error);
                      window.open(`https://wa.me/${tel.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                      LS.updateDoc("recordatorios", recordatorio.id, { estado: "avisado", enviado: true });
                    }}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-3 text-[9px] font-black uppercase active:scale-95 transition-all shadow-lg"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                  <button
                    onClick={() => LS.updateDoc("recordatorios", recordatorio.id, { estado: "hecho" })}
                    className="rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 py-3 px-3 text-[9px] font-black uppercase active:scale-95 transition-all"
                  >
                    Marcar leído
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ordenesActivas.length > 0 && (
        <div className="space-y-3 rounded-[2rem] border border-slate-800 bg-slate-900 p-5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Trabajos en curso</p>
          {ordenesActivas.map((order) => {
            const bike = bikes?.find((item) => item.id === order.bikeId) || {};
            return (
              <button
                key={order.id}
                onClick={() => {
                  trackEvent("open_detalle_trabajo", {
                    screen: "home",
                    entityType: "trabajo",
                    entityId: order.id,
                  }).catch(console.error);
                  setSelectedOrderId(order.id);
                  setView("detalleOrden");
                }}
                className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-left transition-all active:scale-[0.98]"
              >
                <div>
                  <p className="text-sm font-black uppercase tracking-tight text-white">
                    {bike.patente || "---"} · {bike.marca || ""} {bike.modelo || ""}
                  </p>
                  <span className={`mt-2 inline-block rounded-lg border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${ESTADO_BADGE[order.estadoCron]}`}>
                    {ESTADO_LABEL_CRON[order.estadoCron]}
                  </span>
                </div>
                {order.maxAutorizado > 0 && (
                  <div className="text-right">
                    <p className="text-[9px] font-black uppercase text-slate-500">Acumulado</p>
                    <p className="text-sm font-black text-white">{formatMoney(order.costoActual)}</p>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
