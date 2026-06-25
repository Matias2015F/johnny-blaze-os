import React from "react";
import { AlertTriangle, Bell, Calendar, Clock, ChevronRight, FileText, History, LogOut, MessageCircle, PlusCircle, ReceiptText, User, Wrench, X, Zap } from "lucide-react";
import { Badge, Button, Card } from "../components/ui/index.js";
import { trackEvent } from "../lib/telemetry.js";
import { formatMoneyShort } from "../utils/format.js";
import { useHomeView } from "../hooks/useHomeView.js";

// Mapeo de token semantico a clase CSS — responsabilidad de la capa de presentacion
const URGENCY_COLOR = {
  ready:    "text-emerald-400",
  payment:  "text-green-400",
  document: "text-purple-400",
  waiting:  "text-yellow-400",
  blocked:  "text-red-400",
  neutral:  "text-slate-400",
};

const SEVERITY_CLASSES = {
  service_vencido: "border-red-500/40 bg-red-500/25",
  proximo_service: "border-yellow-500/40 bg-yellow-500/20",
};

const SEVERITY_TEXT = {
  service_vencido: "text-red-300",
  proximo_service: "text-yellow-300",
};

export default function HomeView({ setView, bikes, orders, presupuestos = [], setSelectedOrderId, handleLogout, modoLectura = false }) {
  const {
    userLabel,
    stats,
    ordenesActivas,
    alertasService,
    accionesUrgentes,
    enviarWhatsAppRecordatorio,
    descartarRecordatorio,
  } = useHomeView({ orders, bikes, presupuestos, modoLectura });

  return (
    <div className="space-y-5 p-4 pb-28 text-left animate-in fade-in duration-500">
      <header className="relative overflow-hidden rounded-[2.5rem] border border-orange-600/20 bg-gradient-to-b from-[#1C1004] via-[#141414] to-[#0A0A0A] p-8 shadow-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
        <div className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full bg-orange-600/10 blur-3xl" />
        <div className="font-bold">
          <a href="https://motogestion.ar/" className="mb-5 block overflow-hidden rounded-[1.75rem] border border-orange-500/20 bg-black/80 px-3 py-4 shadow-inner shadow-orange-950/30 active:opacity-80 transition-opacity">
            <img
              src="/brand/motogestion-banner.png"
              alt="Moto Gestion - Sistema de gestion para talleres de motos"
              className="h-auto max-h-44 w-full object-contain"
            />
          </a>
          <div className="mb-5 flex items-center justify-between gap-3">
            <p className="max-w-[75%] truncate text-[10px] font-normal text-zinc-400">{userLabel}</p>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-500 transition-all hover:text-red-400 active:scale-95"
            >
              <LogOut size={13} /> Salir
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300">Trabajos activos</p>
              <p className="mt-2 text-2xl font-black text-emerald-400">{stats.totalOrdenes}</p>
              <p className="mt-1 text-[10px] font-bold text-emerald-600">En movimiento hoy</p>
            </div>
            <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-orange-300">Pendiente de cobro</p>
              <p className="mt-2 text-xl font-black leading-none text-orange-400">{formatMoneyShort(stats.totalPendienteCobro)}</p>
              <p className="mt-1 text-[10px] font-bold text-orange-600">Saldo total</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-yellow-300">Atencion</p>
              <p className="mt-2 text-2xl font-black text-yellow-400">{stats.alerta}</p>
              <p className="mt-1 text-[10px] font-bold text-yellow-600">Cerca del limite</p>
            </div>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-[9px] font-black uppercase tracking-wider text-red-300">Detenidos</p>
              <p className="mt-2 text-2xl font-black text-red-400">{stats.bloqueado}</p>
              <p className="mt-1 text-[10px] font-bold text-red-600">Necesitan accion</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Listas hoy</p>
          <p className="mt-2 text-2xl font-black text-emerald-400">{stats.listasParaEntregar}</p>
          <p className="mt-1 text-[9px] font-bold text-zinc-600">Para entregar</p>
        </Card>
        <Card className="text-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Ingresos hoy</p>
          <p className="mt-2 text-2xl font-black text-orange-400">{stats.ingresosHoy}</p>
          <p className="mt-1 text-[9px] font-bold text-zinc-600">Motos nuevas</p>
        </Card>
        <Card className="text-center">
          <p className="text-[8px] font-black uppercase tracking-widest text-zinc-500">Cobrado</p>
          <p className="mt-2 text-base font-black leading-none text-yellow-400">{formatMoneyShort(stats.cobradoHoy)}</p>
          <p className="mt-1 text-[9px] font-bold text-zinc-600">Hoy</p>
        </Card>
      </div>

      {accionesUrgentes.length > 0 && (
        <div className="rounded-[2.5rem] border border-orange-600/30 bg-gradient-to-b from-orange-600/10 to-zinc-900/80 p-5 space-y-3 shadow-xl">
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-orange-300">
            <Zap size={13} />
            {accionesUrgentes.length} accion{accionesUrgentes.length !== 1 ? "es" : ""} urgente{accionesUrgentes.length !== 1 ? "s" : ""}
          </p>
          {accionesUrgentes.map(({ orderId, patente, marca, modelo, accion }) => (
            <button
              key={orderId}
              onClick={() => {
                trackEvent("accion_urgente", { screen: "home", entityType: "trabajo", entityId: orderId, metadata: { accion: accion.label } }).catch(console.error);
                setSelectedOrderId(orderId);
                setView("detalleOrden");
              }}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 text-left transition-all active:scale-[0.98]"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-black uppercase text-white">{patente} · {marca} {modelo}</p>
                <p className={`mt-1 text-[10px] font-black uppercase tracking-widest ${URGENCY_COLOR[accion.urgency]}`}>
                  {accion.label}
                </p>
              </div>
              <ChevronRight size={16} className="shrink-0 text-orange-400" />
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            trackEvent("nuevo_ingreso", { screen: "home" }).catch(console.error);
            setView("nuevaOrden");
          }}
          className={`rounded-[2.5rem] p-6 text-white shadow-xl transition-all active:scale-[0.98] ${modoLectura ? "bg-zinc-700 opacity-60" : "bg-orange-600"}`}
        >
          <div className="flex flex-col items-start gap-3 font-bold">
            <div className={`rounded-3xl p-3 ${modoLectura ? "bg-white/10" : "bg-white/20"}`}><PlusCircle size={26} /></div>
            <div>
              <p className="text-lg font-black uppercase leading-tight tracking-tighter">Nuevo ingreso</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/70 mt-0.5">{modoLectura ? "Plan vencido" : "Ingresar moto"}</p>
            </div>
          </div>
        </button>
        <button onClick={() => setView("presupuestos")} className="rounded-[2.5rem] border border-zinc-700 bg-zinc-900 p-6 text-white shadow-xl transition-all active:scale-[0.98]">
          <div className="flex flex-col items-start gap-3 font-bold">
            <div className="rounded-3xl bg-zinc-800 p-3"><FileText size={26} className="text-orange-400" /></div>
            <div>
              <p className="text-lg font-black uppercase leading-tight tracking-tighter">Presupuestos</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-0.5">
                {stats.presupuestosActivos > 0
                  ? `${stats.presupuestosActivos} activo${stats.presupuestosActivos !== 1 ? "s" : ""}`
                  : "Cotizar trabajos"}
              </p>
            </div>
          </div>
        </button>
      </div>

      {(orders || []).length === 0 && !modoLectura && (
        <Card className="space-y-4 p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Por donde empezar</p>
          <div className="space-y-3">
            {[
              { num: "1", color: "bg-orange-600", label: "Configura tu taller", desc: "Nombre, logo y datos de garantia en Mas → Configuracion." },
              { num: "2", color: "bg-zinc-700",   label: "Carga tu primer cliente", desc: "En Nuevo ingreso podes crearlo en el momento." },
              { num: "3", color: "bg-zinc-700",   label: "Abri tu primera orden", desc: "Desde ahi registras el trabajo y generás el comprobante." },
            ].map(({ num, color, label, desc }) => (
              <div key={num} className="flex items-start gap-3">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${color} text-[10px] font-black text-white`}>{num}</span>
                <div>
                  <p className="text-sm font-black text-white">{label}</p>
                  <p className="text-[10px] text-zinc-500">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <Button variant="primary" size="lg" onClick={() => setView("nuevaOrden")}>
            Empezar primer ingreso
          </Button>
        </Card>
      )}

      <button onClick={() => setView("agenda")} className="w-full rounded-[2rem] border border-orange-500/20 bg-orange-500/10 p-5 text-left shadow-xl transition-all active:scale-95">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-orange-600/20 p-3"><Calendar className="text-orange-400" size={24} /></div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-white">Agenda semanal</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Ocupacion y trabajos por dia</p>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-4">
        {[
          { view: "ordenes",   icon: <Clock className="text-orange-400" size={24} />,   label: "Trabajos",  desc: "Ver y seguir trabajos activos",      event: "open_trabajos" },
          { view: "pagosView", icon: <ReceiptText className="text-emerald-400" size={24} />, label: "Pagos", desc: "Cobrar y emitir comprobantes",       event: "open_pagos" },
          { view: "historial", icon: <History className="text-orange-400" size={24} />, label: "Historial", desc: "Buscar patente, cliente o comprobante", event: "open_historial" },
          { view: "config",    icon: <Wrench className="text-zinc-300" size={24} />,    label: "Mas",       desc: "Configuracion y herramientas",        event: "open_config" },
        ].map(({ view, icon, label, desc, event }) => (
          <button
            key={view}
            onClick={() => {
              trackEvent(event, { screen: "home" }).catch(console.error);
              setView(view);
            }}
            className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 text-left shadow-xl transition-all active:scale-95"
          >
            {icon}
            <p className="mt-4 text-xs font-black uppercase tracking-widest text-white">{label}</p>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{desc}</p>
          </button>
        ))}
      </div>

      <button
        onClick={() => setView("recordatorios")}
        className="w-full rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 text-left shadow-xl transition-all active:scale-95 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-yellow-500/15 p-3"><Bell className="text-yellow-400" size={24} /></div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-white">Recordatorios</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {alertasService.length > 0
                ? `${alertasService.length} pendiente${alertasService.length !== 1 ? "s" : ""}`
                : "Proximos controles"}
            </p>
          </div>
        </div>
        <ChevronRight size={18} className="text-zinc-600 shrink-0" />
      </button>

      {alertasService.length > 0 && (
        <div className="rounded-[2.5rem] border border-yellow-500/30 bg-gradient-to-br from-yellow-500/15 to-orange-500/10 p-5 shadow-xl backdrop-blur space-y-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-yellow-300">
              <Bell size={16} /> {alertasService.length} Notificacion{alertasService.length !== 1 ? "es" : ""} pendiente{alertasService.length !== 1 ? "s" : ""}
            </p>
            <button
              onClick={() => setView("recordatorios")}
              className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-zinc-400 active:text-orange-400 transition-colors"
            >
              Ver todos <ChevronRight size={13} />
            </button>
          </div>

          <div className="space-y-3">
            {alertasService.map((rec) => (
              <div key={rec.id} className={`rounded-2xl border p-4 space-y-3 ${SEVERITY_CLASSES[rec.estado]}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-black uppercase tracking-tight text-white">
                      {rec.moto?.patente || "---"} · {rec.moto?.marca || ""} {rec.moto?.modelo || ""}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-white font-bold">
                      <User size={11} className="shrink-0" /> {rec.cliente?.nombre || "Cliente"}
                    </p>
                    <p className={`mt-2 flex items-center gap-1 text-[10px] font-black uppercase ${SEVERITY_TEXT[rec.estado]}`}>
                      {rec.estado === "service_vencido"
                        ? <AlertTriangle size={10} className="shrink-0" />
                        : <Bell size={10} className="shrink-0" />}
                      {rec.estado === "service_vencido" ? "SERVICE VENCIDO" : "PROXIMO SERVICE"} · {rec.descripcion}
                    </p>
                    {rec.kmObjetivo && (
                      <p className="mt-2 text-[9px] text-zinc-200">
                        Km actual: <span className="font-black text-white">{(rec.moto?.kilometrajeActual || rec.moto?.km || 0).toLocaleString("es-AR")}</span>
                        {" / "}Objetivo: <span className="font-black text-white">{rec.kmObjetivo.toLocaleString("es-AR")} km</span>
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => descartarRecordatorio(rec.id)}
                    className="shrink-0 cursor-pointer p-1 text-zinc-400 hover:text-red-400 active:scale-95 transition-colors"
                    title="Cerrar notificacion"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => enviarWhatsAppRecordatorio(rec)}
                    className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-3 text-[9px] font-black uppercase active:scale-95 transition-all shadow-lg"
                  >
                    <MessageCircle size={14} /> WhatsApp
                  </button>
                  <button
                    onClick={() => descartarRecordatorio(rec.id)}
                    className="rounded-xl bg-zinc-700 hover:bg-zinc-600 text-zinc-200 py-3 px-3 text-[9px] font-black uppercase active:scale-95 transition-all"
                  >
                    Marcar leido
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {ordenesActivas.length > 0 && (
        <Card className="space-y-3 p-5 shadow-xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Trabajos en curso</p>
          {ordenesActivas.map((order) => (
            <button
              key={order.id}
              onClick={() => {
                trackEvent("open_detalle_trabajo", { screen: "home", entityType: "trabajo", entityId: order.id }).catch(console.error);
                setSelectedOrderId(order.id);
                setView("detalleOrden");
              }}
              className="flex w-full items-center justify-between rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-left transition-all active:scale-[0.98]"
            >
              <div>
                <p className="text-sm font-black uppercase tracking-tight text-white">
                  {order.patente} · {order.marca} {order.modelo}
                </p>
                <Badge variant={order.statusVariant} className="mt-2">{order.statusLabel}</Badge>
              </div>
              {order.maxAutorizado > 0 && (
                <div className="text-right">
                  <p className="text-[9px] font-black uppercase text-zinc-500">Acumulado</p>
                  <p className="text-sm font-black text-white">{formatMoneyShort(order.costoActual)}</p>
                </div>
              )}
            </button>
          ))}
        </Card>
      )}
    </div>
  );
}
