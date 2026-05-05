import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Download, LogOut, Trash2, Database, Info, Shield,
  RotateCcw, FileSpreadsheet, ChevronRight, BarChart2,
  Settings, HardDrive, Wrench, Plus, Minus,
} from "lucide-react";
import { LS, useCollection, migrateFromRootCollections, forceSyncCacheToFirestore } from "../lib/storage.js";
import { auth, db } from "../firebase.js";
import { createCloudBackup, listCloudBackups, restoreCloudBackup } from "../lib/cloudBackup.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { APP_BUILD } from "../generated/appVersion.js";
import { applyRemoteUpdate, bindInstallPromptCapture, canPromptInstall, ensureNotificationPermission, fetchRemoteVersion, getDisplayModeInfo, isNewerBuild, promptInstallApp, sendTestNotification } from "../lib/appUpdate.js";
import { DEFAULT_SAAS_ADMIN_SETTINGS as DEFAULT_ADMIN_SETTINGS, PLATFORM_ADMIN_EMAILS, PLATFORM_ADMIN_UIDS, actualizarSuscripcionUsuario, crearTicketSoporte, guardarAdminSettings, leerAdminSettings, leerUsuarioSaas, normalizeDateMs, normalizeSaasUser } from "../services/saasService.js";
import { formatMoney } from "../utils/format.js";
import { exportarOrdenes, exportarClientes, exportarBalance, exportarRepuestos } from "../utils/export.js";
import { descargarBackup, restaurarDesdeTexto, restaurarAutoBackup, estadoBackup, tiempoDesde } from "../utils/backup.js";
import { collection, collectionGroup, doc, getDoc, getDocs, query, limit, orderBy, setDoc } from "firebase/firestore";

const DIFICULTADES = [
  { key: "facil",      label: "Facil",      color: "text-green-500",  bg: "bg-green-50",  border: "border-green-200" },
  { key: "normal",     label: "Normal",     color: "text-blue-500",   bg: "bg-blue-50",   border: "border-blue-200" },
  { key: "dificil",    label: "Dificil",    color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "complicado", label: "Complicado", color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200" },
];

const TABS = [
  { id: "resumen", label: "Resumen",  Icon: BarChart2 },
  { id: "taller",  label: "Taller",   Icon: Wrench },
  { id: "datos",   label: "Datos",    Icon: HardDrive },
  { id: "sistema", label: "Sistema",  Icon: Settings },
  { id: "admin",   label: "Admin",    Icon: Shield },
];

// Stepper component
function Stepper({ value, onChange, step = 1, min = 0, max = Infinity, format = v => v, suffix = "" }) {

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center active:scale-90 transition-all"
      >
        <Minus size={16} className="text-slate-600" />
      </button>
      <div className="flex-1 text-center">
        <span className="text-2xl font-black text-slate-800 tracking-tight">{format(value)}</span>
        {suffix && <span className="text-sm font-bold text-slate-400 ml-1">{suffix}</span>}
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center active:scale-90 transition-all"
      >
        <Plus size={16} className="text-white" />
      </button>
    </div>
  );
}

// Section card
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-3xl shadow-sm border border-slate-100 p-6 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{children}</p>;
}

function normalizeDateValue(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }
  return null;
}

function formatAdminDate(value, fallback = "Sin dato") {
  const date = normalizeDateValue(value);
  return date ? date.toLocaleString("es-AR") : fallback;
}

function formatRequestedAction(item = {}) {
  if (item.cancelAtPeriodEnd || item.requestedAction === "cancel_plan") {
    return "Cancelar al vencer";
  }
  if (item.requestedAction === "change_plan") {
    return `Cambiar a ${item.requestedPlanKey === "pro" ? "plan pro" : "plan base"}`;
  }
  if (item.requestedAction === "pay_plan") {
    return "Pedido de pago";
  }
  return "Sin pedido";
}

function sortByDateDesc(items = [], ...fields) {
  return [...items].sort((a, b) => {
    const left = fields.map((field) => normalizeDateMs(a?.[field])).find(Boolean) || 0;
    const right = fields.map((field) => normalizeDateMs(b?.[field])).find(Boolean) || 0;
    return right - left;
  });
}

const FEATURE_LABELS = {
  pdf: "Comprobantes PDF",
  recordatorios: "Proximo control",
  analytics: "Analitica de uso",
  multiusuario: "Multiusuario",
};

const ADMIN_TABS = [
  { id: "dashboard",  label: "Resumen" },
  { id: "planes",     label: "Planes" },
  { id: "usuarios",   label: "Usuarios" },
  { id: "cobros",     label: "Cobros" },
  { id: "consultas",  label: "Consultas" },
];

function StatBox({ label, value, color = "text-slate-800" }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`mt-1 text-2xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function PantallaAdmin({ showToast }) {
  const [loading, setLoading] = React.useState(true);
  const [adminTab, setAdminTab] = React.useState("dashboard");
  const [account, setAccount] = React.useState(null);
  const [accounts, setAccounts] = React.useState([]);
  const [settings, setSettings] = React.useState(DEFAULT_ADMIN_SETTINGS);
  const [invoices, setInvoices] = React.useState([]);
  const [tickets, setTickets] = React.useState([]);
  const [filterEstado, setFilterEstado] = React.useState("todos");
  const [expandedUid, setExpandedUid] = React.useState(null);
  const [accionando, setAccionando] = React.useState(null);
  const user = auth.currentUser;
  const isPlatformAdmin =
    PLATFORM_ADMIN_EMAILS.includes((user?.email || "").toLowerCase()) ||
    PLATFORM_ADMIN_UIDS.includes(user?.uid || "");

  const cargar = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    try {
      const accountSnap = await getDoc(doc(db, "usuarios", uid));
      const mine = accountSnap.exists()
        ? { id: accountSnap.id, ...accountSnap.data() }
        : { id: uid, uid, estado: "trial", rol: "user", activoHasta: null, lastSeenAt: null };
      setAccount(mine);

      setSettings(await leerAdminSettings());

      const results = await Promise.allSettled([
        getDocs(collection(db, "usuarios")),
        getDocs(collection(db, "billingInvoices")),
        getDocs(collection(db, "soporteTickets")),
      ]);

      const [accountsRes, invoicesRes, ticketsRes] = results;

      if (accountsRes.status === "fulfilled") {
        setAccounts(accountsRes.value.docs.map((d) => normalizeSaasUser({ id: d.id, ...d.data() }, { uid: d.id })));
      } else {
        setAccounts([]);
      }

      if (invoicesRes.status === "fulfilled") {
        setInvoices(sortByDateDesc(invoicesRes.value.docs.map((d) => ({ id: d.id, ...d.data() })), "paidAt", "createdAt", "updatedAt"));
      } else {
        setInvoices([]);
      }

      if (ticketsRes.status === "fulfilled") {
        setTickets(sortByDateDesc(ticketsRes.value.docs.map((d) => ({ id: d.id, ...d.data() })), "createdAt", "updatedAt"));
      } else {
        setTickets([]);
      }
    } catch (e) {
      console.error(e);
      showToast("No se pudo cargar el panel admin");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { cargar(); }, []);

  // Métricas calculadas
  const stats = React.useMemo(() => {
    const now = Date.now();
    const mesInicio = new Date(); mesInicio.setDate(1); mesInicio.setHours(0,0,0,0);
    const mesInicioMs = mesInicio.getTime();

    const total = accounts.length;
    const trial = accounts.filter(a => a.estado === "trial").length;
    const activos = accounts.filter(a => a.estado === "activo").length;
    const vencidos = accounts.filter(a => ["vencido","suspendido"].includes(a.estado)).length;
    const admins = accounts.filter(a => a.rol === "admin" || a.isPlatformAdmin).length;
    const planBase = accounts.filter(a => (a.currentPlanKey || a.plan || "base") === "base" && a.estado === "activo").length;
    const planPro = accounts.filter(a => (a.currentPlanKey || a.plan) === "pro" && a.estado === "activo").length;

    // Pagos: combinar invoices + ultimoPago de accounts
    const pagosDesdeAccounts = accounts
      .filter(a => a.ultimoPago?.fecha && a.ultimoPago?.monto)
      .map(a => ({
        id: a.ultimoPago.paymentId || a.uid,
        uid: a.uid,
        email: a.email || "",
        monto: Number(a.ultimoPago.monto || 0),
        fecha: Number(a.ultimoPago.fecha),
        paymentId: a.ultimoPago.paymentId || "",
        plan: a.currentPlanKey || a.plan || "base",
        status: "approved",
      }));
    const pagosDesdeInvoices = invoices
      .filter(inv => inv.status === "approved")
      .map(inv => ({
        id: inv.id,
        uid: inv.uid || "",
        email: inv.email || "",
        monto: Number(inv.amountPaid || inv.amount || 0),
        fecha: Number(inv.paidAt || inv.createdAt || 0),
        paymentId: inv.mpPaymentId || inv.id,
        plan: inv.planKey || "base",
        status: "approved",
      }));
    // Deduplicar por paymentId
    const seen = new Set();
    const todosPagos = [...pagosDesdeAccounts, ...pagosDesdeInvoices]
      .filter(p => { if (seen.has(p.paymentId || p.id)) return false; seen.add(p.paymentId || p.id); return true; })
      .sort((a, b) => b.fecha - a.fecha);

    const totalCobrado = todosPagos.reduce((s, p) => s + p.monto, 0);
    const cobradoMes = todosPagos.filter(p => p.fecha >= mesInicioMs).reduce((s, p) => s + p.monto, 0);
    const pagosEsteMes = todosPagos.filter(p => p.fecha >= mesInicioMs).length;

    // Tiempo promedio trial → pago (en días)
    const tiemposConversion = accounts
      .filter(a => a.ultimoPago?.fecha && a.createdAt)
      .map(a => (Number(a.ultimoPago.fecha) - Number(a.createdAt)) / (1000 * 60 * 60 * 24));
    const promDias = tiemposConversion.length > 0
      ? Math.round(tiemposConversion.reduce((s, d) => s + d, 0) / tiemposConversion.length)
      : null;

    const trialsPorVencer = accounts.filter(a => {
      const fin = normalizeDateMs(a.activoHasta || a.trialEndsAt);
      return a.estado === "trial" && fin && fin >= now && fin <= now + 5 * 24 * 60 * 60 * 1000;
    }).length;

    const pedidosPendientes = accounts.filter(a => a.requestedAction || a.cancelAtPeriodEnd).length;
    const reclamosPendientes = tickets.filter(t => t.estado !== "resuelto").length;

    return {
      total, trial, activos, vencidos, admins, planBase, planPro,
      todosPagos, totalCobrado, cobradoMes, pagosEsteMes,
      promDias, trialsPorVencer, pedidosPendientes, reclamosPendientes,
    };
  }, [accounts, invoices, tickets]);

  const guardarSettings = async () => {
    try {
      await guardarAdminSettings(settings, { uid: user?.uid || "", email: user?.email || "" });
      showToast("Configuracion guardada");
      cargar();
    } catch (error) {
      showToast("No se pudo guardar");
    }
  };

  const resolverPedidoCuenta = async (item, patch, message) => {
    try {
      await actualizarSuscripcionUsuario(item.uid, {
        ...patch,
        requestedAction: null,
        requestedPlanKey: null,
        cancelAtPeriodEnd: false,
      });
      showToast(message);
      cargar();
    } catch (error) {
      showToast("No se pudo resolver el pedido");
    }
  };

  const resolverTicket = async (ticketId) => {
    try {
      await setDoc(doc(db, "soporteTickets", ticketId), { estado: "resuelto", updatedAt: new Date().toISOString() }, { merge: true });
      showToast("Reclamo resuelto");
      cargar();
    } catch (error) {
      showToast("No se pudo resolver el reclamo");
    }
  };

  const activarUsuario = async (item, planKey = "base", extraDias = 30) => {
    setAccionando(item.uid);
    try {
      await actualizarSuscripcionUsuario(item.uid, {
        estado: "activo",
        plan: planKey,
        currentPlanKey: planKey,
        pagoEstado: "pagado",
        activoHasta: Date.now() + extraDias * 24 * 60 * 60 * 1000,
        requestedAction: null,
        cancelAtPeriodEnd: false,
      });
      showToast(`${item.email || item.uid} activado por ${extraDias} dias`);
      setExpandedUid(null);
      cargar();
    } catch (error) {
      showToast("No se pudo activar");
    } finally {
      setAccionando(null);
    }
  };

  const extenderUsuario = async (item, dias = 30) => {
    setAccionando(item.uid);
    try {
      const base = Math.max(Number(normalizeDateMs(item.activoHasta) || 0), Date.now());
      await actualizarSuscripcionUsuario(item.uid, {
        estado: "activo",
        activoHasta: base + dias * 24 * 60 * 60 * 1000,
      });
      showToast(`Extendido ${dias} dias`);
      setExpandedUid(null);
      cargar();
    } catch (error) {
      showToast("No se pudo extender");
    } finally {
      setAccionando(null);
    }
  };

  if (loading) {
    return <Card><p className="text-sm font-black text-slate-500 text-center py-4">Cargando panel admin...</p></Card>;
  }

  if (!(isPlatformAdmin || account?.isPlatformAdmin)) {
    return <Card><p className="text-sm font-black text-slate-700">Este panel es solo para el administrador.</p></Card>;
  }

  const cuentasConPedidos = accounts.filter(a => a.requestedAction || a.cancelAtPeriodEnd);
  const usuariosFiltrados = filterEstado === "todos" ? accounts
    : filterEstado === "activos" ? accounts.filter(a => a.estado === "activo")
    : filterEstado === "trial" ? accounts.filter(a => a.estado === "trial")
    : filterEstado === "vencidos" ? accounts.filter(a => ["vencido","suspendido"].includes(a.estado))
    : accounts;

  return (
    <div>
      {/* Sub-navegación */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 -mx-1">
        {ADMIN_TABS.map(t => (
          <button key={t.id} onClick={() => setAdminTab(t.id)}
            className={`shrink-0 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
              adminTab === t.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 active:scale-95"
            }`}
          >
            {t.label}
            {t.id === "consultas" && (stats.pedidosPendientes + stats.reclamosPendientes) > 0 && (
              <span className="ml-1.5 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[8px]">
                {stats.pedidosPendientes + stats.reclamosPendientes}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {adminTab === "dashboard" && (
        <div className="space-y-4">
          <Card>
            <SectionTitle>Este mes</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 col-span-2">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Cobrado este mes</p>
                <p className="mt-1 text-3xl font-black text-emerald-700">{formatMoney(stats.cobradoMes)}</p>
                <p className="text-[10px] font-bold text-emerald-500 mt-1">{stats.pagosEsteMes} {stats.pagosEsteMes === 1 ? "pago" : "pagos"} recibidos</p>
              </div>
              <StatBox label="Total cobrado" value={formatMoney(stats.totalCobrado)} color="text-slate-800" />
              <StatBox label="Tiempo promedio a pagar" value={stats.promDias !== null ? `${stats.promDias} dias` : "—"} />
            </div>
          </Card>

          <Card>
            <SectionTitle>Usuarios ahora</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Total" value={stats.total} />
              <StatBox label="Activos" value={stats.activos} color="text-emerald-600" />
              <StatBox label="En prueba" value={stats.trial} color="text-amber-600" />
              <StatBox label="Vencidos" value={stats.vencidos} color="text-red-600" />
            </div>
          </Card>

          <Card>
            <SectionTitle>Alertas</SectionTitle>
            <div className="space-y-2">
              {stats.trialsPorVencer > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-sm font-black text-amber-700">Trials por vencer en 5 dias</p>
                  <p className="text-lg font-black text-amber-700">{stats.trialsPorVencer}</p>
                </div>
              )}
              {stats.pedidosPendientes > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3">
                  <p className="text-sm font-black text-blue-700">Pedidos pendientes</p>
                  <p className="text-lg font-black text-blue-700">{stats.pedidosPendientes}</p>
                </div>
              )}
              {stats.reclamosPendientes > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-sm font-black text-red-700">Reclamos sin resolver</p>
                  <p className="text-lg font-black text-red-700">{stats.reclamosPendientes}</p>
                </div>
              )}
              {stats.trialsPorVencer === 0 && stats.pedidosPendientes === 0 && stats.reclamosPendientes === 0 && (
                <p className="text-sm font-black text-slate-500 text-center py-2">Todo en orden. No hay alertas.</p>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle>Distribucion de planes</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Plan base activos" value={stats.planBase} />
              <StatBox label="Plan pro activos" value={stats.planPro} color="text-blue-600" />
            </div>
          </Card>
        </div>
      )}

      {/* ── PLANES ── */}
      {adminTab === "planes" && (
        <div className="space-y-4">
          <Card>
            <SectionTitle>Precios y duracion</SectionTitle>
            <p className="text-[11px] font-bold text-slate-500 mb-4">Estos valores se usan al momento del pago. Cambiarlo no afecta suscripciones ya activas.</p>
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio Plan Base (ARS)</p>
                <input
                  type="text" inputMode="numeric"
                  value={String(settings.precios?.base || 0)}
                  onChange={e => setSettings(p => ({ ...p, precios: { ...(p.precios || {}), base: Number(e.target.value.replace(/\D/g,"") || 0) }}))}
                  className="mt-2 w-full bg-transparent text-3xl font-black text-slate-800 outline-none"
                  placeholder="5000"
                />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio Plan Pro (ARS)</p>
                <input
                  type="text" inputMode="numeric"
                  value={String(settings.precios?.pro || 0)}
                  onChange={e => setSettings(p => ({ ...p, precios: { ...(p.precios || {}), pro: Number(e.target.value.replace(/\D/g,"") || 0) }}))}
                  className="mt-2 w-full bg-transparent text-3xl font-black text-slate-800 outline-none"
                  placeholder="12000"
                />
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>Periodos</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dias de prueba (trial)</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">Acceso gratis al registrarse.</p>
                <input
                  type="text" inputMode="numeric"
                  value={String(settings.duracionTrialDias || 14)}
                  onChange={e => setSettings(p => ({ ...p, duracionTrialDias: Number(e.target.value.replace(/\D/g,"") || 14) }))}
                  className="mt-3 w-full bg-transparent text-2xl font-black text-slate-800 outline-none"
                />
              </div>
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dias de gracia</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">Extra tras vencimiento antes de bloquear.</p>
                <input
                  type="text" inputMode="numeric"
                  value={String(settings.graceDaysDefault || 3)}
                  onChange={e => setSettings(p => ({ ...p, graceDaysDefault: Number(e.target.value.replace(/\D/g,"") || 3) }))}
                  className="mt-3 w-full bg-transparent text-2xl font-black text-slate-800 outline-none"
                />
              </div>
            </div>
          </Card>

          <Card>
            <SectionTitle>Funciones por plan</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(settings.features || {}).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => setSettings(p => ({ ...p, features: { ...(p.features || {}), [key]: !value }}))}
                  className={`rounded-2xl border px-3 py-3 text-left transition-all ${value ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest">{FEATURE_LABELS[key] || key}</p>
                  <p className="mt-1 text-[10px] font-bold">{value ? "Activa" : "Desactivada"}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Aplicacion de precios</SectionTitle>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black text-slate-800">Solo cuentas nuevas</p>
                <p className="text-[10px] font-bold text-slate-400 mt-0.5">Si esta apagado, afecta a todos al renovar.</p>
              </div>
              <button
                onClick={() => setSettings(p => ({ ...p, applyPricingToNewAccountsOnly: !p.applyPricingToNewAccountsOnly }))}
                className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${settings.applyPricingToNewAccountsOnly !== false ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}
              >
                {settings.applyPricingToNewAccountsOnly !== false ? "Si" : "No"}
              </button>
            </div>
          </Card>

          <button onClick={guardarSettings} className="w-full rounded-2xl bg-blue-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95">
            Guardar todos los cambios
          </button>
        </div>
      )}

      {/* ── USUARIOS ── */}
      {adminTab === "usuarios" && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="flex gap-2 overflow-x-auto -mx-1">
            {[
              { id: "todos", label: `Todos (${stats.total})` },
              { id: "activos", label: `Activos (${stats.activos})` },
              { id: "trial", label: `Trial (${stats.trial})` },
              { id: "vencidos", label: `Vencidos (${stats.vencidos})` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterEstado(f.id)}
                className={`shrink-0 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${filterEstado === f.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {usuariosFiltrados.length === 0 && (
              <Card><p className="text-sm font-black text-slate-500">No hay usuarios en este filtro.</p></Card>
            )}
            {usuariosFiltrados.map(item => {
              const isExpanded = expandedUid === item.uid;
              const estadoColor = item.estado === "activo" ? "text-emerald-600 bg-emerald-50 border-emerald-100"
                : item.estado === "trial" ? "text-amber-600 bg-amber-50 border-amber-100"
                : "text-red-600 bg-red-50 border-red-100";
              const vigencia = normalizeDateMs(item.activoHasta || item.trialEndsAt);
              const vigenciaStr = vigencia
                ? new Date(vigencia).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" })
                : "Sin fecha";

              return (
                <div key={item.uid || item.id} className="rounded-2xl border border-slate-100 bg-white overflow-hidden">
                  <button
                    onClick={() => setExpandedUid(isExpanded ? null : (item.uid || item.id))}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{item.email || item.uid}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {item.currentPlanKey || item.plan || "base"} · hasta {vigenciaStr}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest border rounded-xl px-2 py-1 ${estadoColor}`}>
                      {item.estado || "trial"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-slate-500">
                        <div>UID: <span className="text-slate-700 font-bold text-[9px] break-all">{item.uid || item.id}</span></div>
                        <div>Pago: <span className="text-slate-700">{item.pagoEstado || "pendiente"}</span></div>
                        {item.ultimoPago?.fecha && (
                          <>
                            <div>Ultimo pago: <span className="text-slate-700">{new Date(item.ultimoPago.fecha).toLocaleDateString("es-AR")}</span></div>
                            <div>Monto: <span className="text-emerald-700">{formatMoney(item.ultimoPago.monto || 0)}</span></div>
                            <div className="col-span-2">ID MP: <span className="text-slate-700 font-bold text-[9px]">{item.ultimoPago.paymentId || "—"}</span></div>
                          </>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          disabled={accionando === item.uid}
                          onClick={() => activarUsuario(item, "base", 30)}
                          className="rounded-2xl bg-emerald-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                        >
                          {accionando === item.uid ? "..." : "Activar 30d"}
                        </button>
                        <button
                          disabled={accionando === item.uid}
                          onClick={() => activarUsuario(item, "pro", 30)}
                          className="rounded-2xl bg-blue-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                        >
                          Activar Pro
                        </button>
                        <button
                          disabled={accionando === item.uid}
                          onClick={() => extenderUsuario(item, 30)}
                          className="rounded-2xl bg-slate-900 py-3 text-[10px] font-black uppercase tracking-widest text-white col-span-2 disabled:opacity-50"
                        >
                          Extender +30 dias
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── COBROS ── */}
      {adminTab === "cobros" && (
        <div className="space-y-4">
          <Card>
            <SectionTitle>Resumen de ingresos</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 col-span-2">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Total cobrado</p>
                <p className="mt-1 text-3xl font-black text-emerald-700">{formatMoney(stats.totalCobrado)}</p>
              </div>
              <StatBox label="Cobrado este mes" value={formatMoney(stats.cobradoMes)} color="text-emerald-600" />
              <StatBox label="Pagos este mes" value={stats.pagosEsteMes} />
              <StatBox label="Total de pagos" value={stats.todosPagos.length} />
              <StatBox label="Tiempo prom. a pagar" value={stats.promDias !== null ? `${stats.promDias}d` : "—"} />
            </div>
          </Card>

          <Card>
            <SectionTitle>Historial de pagos</SectionTitle>
            {stats.todosPagos.length === 0 && (
              <p className="text-sm font-black text-slate-500">No hay pagos registrados todavia.</p>
            )}
            <div className="space-y-2">
              {stats.todosPagos.map(pago => (
                <div key={pago.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{pago.email || pago.uid}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {pago.fecha ? new Date(pago.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha"}
                        {" · "}Plan {pago.plan || "base"}
                      </p>
                      {pago.paymentId && (
                        <p className="text-[9px] font-bold text-slate-400 mt-0.5 break-all">MP: {pago.paymentId}</p>
                      )}
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5 break-all">UID: {pago.uid}</p>
                    </div>
                    <p className="text-base font-black text-emerald-600 shrink-0">{formatMoney(pago.monto)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── CONSULTAS ── */}
      {adminTab === "consultas" && (
        <div className="space-y-4">
          <Card>
            <SectionTitle>Pedidos de usuarios</SectionTitle>
            {cuentasConPedidos.length === 0 && (
              <p className="text-sm font-black text-slate-500">No hay pedidos pendientes.</p>
            )}
            <div className="space-y-3">
              {cuentasConPedidos.map(item => (
                <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-800">{item.email || item.uid}</p>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">UID: {item.uid}</p>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 shrink-0">{formatRequestedAction(item)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => resolverPedidoCuenta(item, { estado: "activo", currentPlanKey: item.requestedPlanKey || item.currentPlanKey || "base" }, "Pedido aprobado")}
                      className="rounded-2xl bg-emerald-600 py-3 text-[10px] font-black uppercase tracking-widest text-white"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => resolverPedidoCuenta(item, {}, "Pedido limpiado")}
                      className="rounded-2xl bg-slate-900 py-3 text-[10px] font-black uppercase tracking-widest text-white"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Reclamos ({tickets.filter(t => t.estado !== "resuelto").length} pendientes)</SectionTitle>
            {tickets.length === 0 && <p className="text-sm font-black text-slate-500">No hay reclamos.</p>}
            <div className="space-y-3">
              {tickets.map(ticket => (
                <div key={ticket.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{ticket.email || ticket.uid}</p>
                      <p className="text-[10px] font-bold text-slate-500 mt-0.5">UID: {ticket.uid}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest border rounded-xl px-2 py-1 shrink-0 ${ticket.estado === "resuelto" ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-red-50 border-red-100 text-red-600"}`}>
                      {ticket.estado || "nuevo"}
                    </span>
                  </div>
                  <p className="text-xs font-bold leading-relaxed text-slate-700">{ticket.mensaje || "Sin mensaje"}</p>
                  <p className="text-[9px] font-bold text-slate-400">{formatAdminDate(ticket.createdAt, "Fecha desconocida")}</p>
                  <button
                    onClick={() => resolverTicket(ticket.id)}
                    disabled={ticket.estado === "resuelto"}
                    className="w-full rounded-2xl bg-blue-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
                  >
                    {ticket.estado === "resuelto" ? "Ya resuelto" : "Marcar como resuelto"}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Botón actualizar */}
      <button onClick={cargar} className="w-full mt-2 rounded-2xl bg-slate-100 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 active:scale-95">
        Actualizar datos
      </button>
    </div>
  );
}

// PANTALLA: Resumen
function PantallaResumen({ orders, caja }) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const ordenesMes = useMemo(() => orders.filter(o => (o.fechaIngreso || "").startsWith(mesActual)), [orders, mesActual]);
  const { totalMes, gananciaMes } = useMemo(() => ({
    totalMes:    ordenesMes.reduce((s, o) => s + (o.total || 0), 0),
    gananciaMes: ordenesMes.reduce((s, o) => s + calcularResultadosOrden(o).margen, 0),
  }), [ordenesMes]);
  const balance = useMemo(() => caja.reduce((acc, m) => (m.tipo === "ingreso" ? acc + m.monto : acc - m.monto), 0), [caja]);

  const mes = new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Caja */}
      <Card>
        <SectionTitle>Caja actual</SectionTitle>
        <p className={`text-5xl font-black tracking-tighter ${balance >= 0 ? "text-green-500" : "text-red-500"}`}>
          {formatMoney(balance)}
        </p>
        <p className="text-xs text-slate-400 font-bold mt-1 capitalize">{mes}</p>
      </Card>

      {/* Stats del mes */}
      <Card>
        <SectionTitle>Este mes</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
            <p className="text-3xl font-black text-blue-500">{ordenesMes.length}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Trabajos</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
            <p className="text-xl font-black text-slate-800">{formatMoney(totalMes)}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Cobrado</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
            <p className={`text-xl font-black ${gananciaMes >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatMoney(gananciaMes)}
            </p>
            <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Ganancia</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// PANTALLA: Taller
function PantallaTaller({ cfg, setCfg, showToast }) {
  const margen = cfg.margenPolitica ?? 25;
  const horaCliente = Math.round(cfg.valorHoraInterno * (1 + margen / 100));

  const guardar = () => {
    LS.setDoc("config", "global", { ...cfg, margenPolitica: margen, valorHoraCliente: horaCliente });
    showToast("Guardado OK");
  };

  const setFactor = (key, val) => {
    const f = Math.round(val * 10) / 10;
    if (f <= 0) return;
    setCfg({ ...cfg, factorDificultad: { ...(cfg.factorDificultad || CONFIG_DEFAULT.factorDificultad), [key]: f } });
  };

  return (
    <div className="space-y-4">
      {/* Datos del taller */}
      <Card>
        <SectionTitle>Datos del Taller</SectionTitle>
        <div className="space-y-3">
          {[
            ["nombreTaller",        "Nombre del Taller", "text"],
            ["mecanicoResponsable", "Responsable",       "text"],
            ["dniMecanico",         "DNI",               "text"],
            ["telefonoTaller",      "Telefono",          "tel"],
          ].map(([field, label, type]) => (
            <div key={field}>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
              <input
                type={type}
                value={cfg[field] ?? ""}
                onChange={e => setCfg({ ...cfg, [field]: e.target.value })}
                className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors bg-slate-50"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Costo hora */}
      <Card>
        <SectionTitle>Costo por Hora</SectionTitle>
        <p className="text-[10px] text-slate-400 font-bold mb-4">Gastos fijos / horas trabajadas al mes</p>
        <Stepper
          value={cfg.valorHoraInterno}
          onChange={v => setCfg({ ...cfg, valorHoraInterno: v })}
          step={500}
          min={0}
          format={formatMoney}
        />
      </Card>

      {/* Margen */}
      <Card>
        <SectionTitle>Margen por Defecto</SectionTitle>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-slate-400 font-bold">Ganancia sobre el costo</span>
          <span className="text-2xl font-black text-blue-600">{margen}%</span>
        </div>
        <input
          type="range" min="5" max="120" step="5"
          value={margen}
          onChange={e => setCfg({ ...cfg, margenPolitica: Number(e.target.value) })}
          className="w-full accent-blue-600 mb-2"
        />
        <div className="flex justify-between text-[9px] text-slate-400 font-bold">
          <span>5%</span><span>60%</span><span>120%</span>
        </div>
        <div className="mt-4 bg-slate-900 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio hora al cliente</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{formatMoney(cfg.valorHoraInterno)} x {(1 + margen / 100).toFixed(2)}</p>
          </div>
          <p className="text-2xl font-black text-blue-400">{formatMoney(horaCliente)}</p>
        </div>
      </Card>

      {/* Multiplicadores */}
      <Card>
        <SectionTitle>Multiplicadores por Dificultad</SectionTitle>
        <div className="space-y-3">
          {DIFICULTADES.map(({ key, label, color, bg, border }) => {
            const factor = cfg.factorDificultad?.[key] ?? CONFIG_DEFAULT.factorDificultad[key];
            return (
              <div key={key} className={`${bg} border ${border} rounded-2xl p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-black ${color}`}>{label}</span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    = {formatMoney(Math.round(horaCliente * factor))}/h
                  </span>
                </div>
                <Stepper
                  value={factor}
                  onChange={v => setFactor(key, v)}
                  step={0.1}
                  min={0.5}
                  max={5}
                  format={v => `${v.toFixed(1)}x`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Plantilla WhatsApp */}
      <Card>
        <SectionTitle>Plantilla WhatsApp - Proximo control</SectionTitle>
        <p className="text-[10px] text-slate-400 font-bold mb-3 leading-relaxed">
          Variables: {"{nombreCliente}"} {"{nombreTaller}"} {"{marca}"} {"{modelo}"} {"{patente}"} {"{tipoControl}"}
        </p>
        <textarea
          rows="5"
          value={cfg.whatsappPlantillas?.recordatorioService ?? "Hola {nombreCliente}, te escribimos de {nombreTaller}.\n\nTu moto {marca} {modelo} patente {patente} puede estar cerca del proximo control recomendado: {tipoControl}.\n\nSi queres, podes pasar por el taller y la revisamos para verificarlo."}
          onChange={e => setCfg({ ...cfg, whatsappPlantillas: { ...(cfg.whatsappPlantillas || {}), recordatorioService: e.target.value } })}
          className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-xs outline-none focus:border-blue-500 resize-none"
        />
      </Card>

      <button
        onClick={guardar}
        className="w-full bg-blue-600 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
      >
        Guardar cambios
      </button>
    </div>
  );
}

// PANTALLA: Datos
function PantallaDatos({ orders, bikes, clients, cfg, showToast, bkpEstado, setBkpEstado, fileInputRef, handleRestaurarArchivo, handleRestaurarAuto }) {
  const [backups, setBackups] = React.useState([]);
  const [loadingBackups, setLoadingBackups] = React.useState(false);
  const [guardandoBkp, setGuardandoBkp] = React.useState(false);
  const [restaurando, setRestaurando] = React.useState(null);

  const cargarBackups = async () => {
    setLoadingBackups(true);
    try {
      const uid = auth.currentUser?.uid;
      const lista = await listCloudBackups(uid);
      setBackups(lista);
    } catch (e) {
      showToast("Error al cargar copias: " + e.message);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleGuardarEnNube = async () => {
    setGuardandoBkp(true);
    try {
      const uid = auth.currentUser?.uid;
      const r = await createCloudBackup(uid);
      showToast(r ? `Copia guardada en la nube (${r.total} registros) OK` : "No hay datos para guardar");
      cargarBackups();
    } catch (e) {
      showToast("Error: " + e.message);
    } finally {
      setGuardandoBkp(false);
    }
  };

  const handleRestaurarNube = async (backupId, fecha) => {
    if (!window.confirm(`¿Restaurar la copia del ${new Date(fecha).toLocaleString("es-AR")}?\n\nEsto reemplaza todos los datos actuales.`)) return;
    setRestaurando(backupId);
    try {
      const uid = auth.currentUser?.uid;
      const n = await restoreCloudBackup(uid, backupId);
      showToast(`Restaurado: ${n} registros recuperados OK`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showToast("Error al restaurar: " + e.message);
    } finally {
      setRestaurando(null);
    }
  };

  React.useEffect(() => { cargarBackups(); }, []);

  return (
    <div className="space-y-4">
      {/* Exportar */}
      <Card>
        <SectionTitle>Exportar Datos</SectionTitle>
        <button
          onClick={() => { exportarOrdenes(orders, bikes, clients); showToast("Exportando CSV..."); }}
          className="w-full flex items-center justify-between bg-green-600 text-white rounded-2xl p-5 active:scale-[0.98] transition-all shadow-md mb-4"
        >
          <div className="text-left">
            <p className="text-sm font-black uppercase">Exportar trabajos (CSV)</p>
            <p className="text-[10px] font-bold text-green-100 mt-0.5">Todos los trabajos con detalle</p>
          </div>
          <FileSpreadsheet size={22} />
        </button>

        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">CSV separados</p>
        <div className="space-y-2">
          {[
            { label: "Clientes",             sub: `${clients.length} registros`,   fn: () => { exportarClientes(clients, orders); showToast("Exportando clientes..."); } },
            { label: "Balance mensual",      sub: "Totales por mes",               fn: () => { exportarBalance(orders);           showToast("Exportando balance..."); } },
            { label: "Repuestos utilizados", sub: "Ranking por uso",               fn: () => { exportarRepuestos(orders);         showToast("Exportando repuestos..."); } },
          ].map(({ label, sub, fn }) => (
            <button key={label} onClick={fn}
              className="w-full flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-4 active:scale-[0.98] transition-all">
              <div className="text-left">
                <p className="text-sm font-black text-slate-800">{label}</p>
                <p className="text-[10px] text-slate-400 font-bold">{sub}</p>
              </div>
              <Download size={16} className="text-blue-500" />
            </button>
          ))}
        </div>
      </Card>

      {/* Backup */}
      <Card>
        <SectionTitle>Copia de Seguridad</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Ultima manual</p>
            <p className="text-xs font-black text-slate-700">{tiempoDesde(bkpEstado.ultimoManual) || "Nunca"}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Auto-guardado</p>
            <p className="text-xs font-black text-slate-700">{tiempoDesde(bkpEstado.ultimoAuto) || "Nunca"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => { descargarBackup(); setBkpEstado(estadoBackup()); showToast("Copia descargada OK"); }}
            className="w-full flex items-center justify-between bg-blue-600 text-white rounded-2xl p-5 active:scale-[0.98] transition-all shadow-md"
          >
            <div className="text-left">
              <p className="text-sm font-black uppercase">Descargar copia</p>
              <p className="text-[10px] font-bold text-blue-100 mt-0.5">Archivo .json en tu dispositivo</p>
            </div>
            <Download size={20} />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between bg-slate-900 text-white rounded-2xl p-5 active:scale-[0.98] transition-all"
          >
            <div className="text-left">
              <p className="text-sm font-black uppercase">Restaurar desde archivo</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Elegi el .json descargado</p>
            </div>
            <RotateCcw size={20} />
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestaurarArchivo} className="hidden" />

          {bkpEstado.tieneAuto && (
            <button
              onClick={handleRestaurarAuto}
              className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl p-4 active:scale-[0.98] transition-all"
            >
              <div className="text-left">
                <p className="text-sm font-black">Restaurar auto-guardado</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Guardado {tiempoDesde(bkpEstado.ultimoAuto)}</p>
              </div>
              <RotateCcw size={16} className="text-slate-500" />
            </button>
          )}
        </div>
      </Card>

      {/* Backup en la nube */}
      <Card>
        <SectionTitle>Copias en la Nube</SectionTitle>
        <p className="text-[10px] text-slate-400 font-bold mb-3 leading-relaxed">
          Se guarda automaticamente 1 vez por dia. Podes guardar ahora o restaurar una copia anterior desde cualquier dispositivo.
        </p>
        <button
          onClick={handleGuardarEnNube}
          disabled={guardandoBkp}
          className="w-full flex items-center justify-between bg-blue-600 text-white rounded-2xl p-5 active:scale-[0.98] transition-all shadow-md mb-3 disabled:opacity-50"
        >
          <div className="text-left">
            <p className="text-sm font-black uppercase">{guardandoBkp ? "Guardando..." : "Guardar copia ahora"}</p>
            <p className="text-[10px] font-bold text-blue-100 mt-0.5">Guarda todos los datos en la nube</p>
          </div>
          <HardDrive size={20} />
        </button>

        {loadingBackups ? (
          <p className="text-center text-[10px] text-slate-400 font-bold py-4">Cargando copias...</p>
        ) : backups.length === 0 ? (
          <p className="text-center text-[10px] text-slate-400 font-bold py-4">No hay copias guardadas en la nube todavia</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Copias disponibles (ultimas {backups.length})</p>
            {backups.map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div>
                  <p className="text-xs font-black text-slate-800">{new Date(b.fecha).toLocaleString("es-AR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</p>
                  <p className="text-[9px] font-bold text-slate-400">{b.total} registros</p>
                </div>
                <button
                  onClick={() => handleRestaurarNube(b.id, b.fecha)}
                  disabled={restaurando === b.id}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all disabled:opacity-50"
                >
                  {restaurando === b.id ? "..." : "Restaurar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// PANTALLA: Sistema
function PantallaSuscripcion({ showToast }) {
  const [loading, setLoading] = React.useState(true);
  const [account, setAccount] = React.useState(null);
  const [settings, setSettings] = React.useState(DEFAULT_ADMIN_SETTINGS);
  const [invoices, setInvoices] = React.useState([]);
  const [paymentResult, setPaymentResult] = React.useState(null); // ok | error | pendiente | null
  const [lastAttempt, setLastAttempt] = React.useState(null); // { invoiceId, preferenceId, mode, planKey, at }
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const uid = auth.currentUser?.uid;

  const cargar = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const [usuario, global, invoicesSnap] = await Promise.all([
        leerUsuarioSaas(uid),
        leerAdminSettings(),
        getDocs(collection(db, "billingInvoices")),
      ]);
      setAccount(usuario);
      setSettings(global);
      const mine = invoicesSnap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((item) => item.uid === uid)
        .sort((a, b) => Number(normalizeDateMs(b.updatedAt) || normalizeDateMs(b.createdAt) || 0) - Number(normalizeDateMs(a.updatedAt) || normalizeDateMs(a.createdAt) || 0));
      setInvoices(mine.slice(0, 5));
    } catch (error) {
      console.error(error);
      showToast("No se pudo cargar la suscripción");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    cargar();
  }, [uid]);

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const pago = params.get("pago");
      if (pago === "ok" || pago === "error" || pago === "pendiente") setPaymentResult(pago);
      else setPaymentResult(null);
    } catch {
      setPaymentResult(null);
    }

    try {
      const raw = window.localStorage.getItem("jbos_last_mp_attempt");
      setLastAttempt(raw ? JSON.parse(raw) : null);
    } catch {
      setLastAttempt(null);
    }
  }, []);

  const planLabel = account?.currentPlanKey === "pro" ? "Plan Pro" : account?.estado === "trial" ? "Prueba" : "Plan Base";
  const estadoLabel = account?.estado === "activo" ? "Activa" : account?.estado === "trial" ? "En prueba" : "Vencida";
  const activoHasta = normalizeDateMs(account?.activoHasta || account?.trialEndsAt || account?.nextBillingAt);
  const previousPlanKey = account?.previousPlanKey || "";
  const latestInvoiceAttempt = React.useMemo(() => {
    const latest = invoices[0];
    if (!latest) return null;
    return {
      invoiceId: latest.invoiceId || latest.id || null,
      preferenceId: latest.preferenceId || null,
      mode: latest.mpMode || null,
      tokenMode: latest.mercadoPagoTokenMode || null,
      planKey: latest.planKey || null,
      at: normalizeDateMs(latest.updatedAt) || normalizeDateMs(latest.createdAt) || null,
      status: latest.status || null,
      errorMessage: latest.errorMessage || latest.errorText || null,
      mpStatus: latest.errorHttpStatus || null,
    };
  }, [invoices]);
  const activeAttempt = React.useMemo(() => {
    if (!lastAttempt) return latestInvoiceAttempt;
    if (!latestInvoiceAttempt) return lastAttempt;
    const localAt = Number(lastAttempt.at || 0);
    const invoiceAt = Number(latestInvoiceAttempt.at || 0);
    return invoiceAt >= localAt ? latestInvoiceAttempt : lastAttempt;
  }, [lastAttempt, latestInvoiceAttempt]);

  const persistPaymentAttempt = (attempt) => {
    if (!attempt?.invoiceId && !attempt?.preferenceId) return;
    const normalized = {
      invoiceId: attempt.invoiceId || null,
      preferenceId: attempt.preferenceId || null,
      mode: attempt.mode || null,
      tokenMode: attempt.tokenMode || null,
      planKey: attempt.planKey || null,
      at: attempt.at || Date.now(),
      status: attempt.status || null,
      errorMessage: attempt.errorMessage || null,
      mpStatus: attempt.mpStatus || null,
    };
    try {
      window.localStorage.setItem("jbos_last_mp_attempt", JSON.stringify(normalized));
    } catch {
      // ignore
    }
    setLastAttempt(normalized);
  };

  const irAPagar = async (planKey) => {
    try {
      setSending(true);
      const res = await fetch("/api/mp-create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, plan: planKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        persistPaymentAttempt({
          invoiceId: data.invoiceId || null,
          preferenceId: data.preferenceId || null,
          planKey,
          tokenMode: data.tokenMode || null,
          at: Date.now(),
          status: "error",
          errorMessage: data.mpMessage || data.error || null,
          mpStatus: data.mpStatus || null,
        });
        await cargar();
        throw new Error(data.error || "No se pudo generar el pago");
      }

      persistPaymentAttempt({
        invoiceId: data.invoiceId || null,
        preferenceId: data.preferenceId || null,
        mode: data.mode || null,
        tokenMode: data.tokenMode || null,
        planKey,
        at: Date.now(),
      });
      if (data.mode === "sandbox") {
        showToast("Pago en modo SANDBOX: entra con usuario COMPRADOR de prueba y usá tarjeta de prueba.");
      }
      window.location.href = data.url;
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo iniciar el pago");
      setSending(false);
    }
  };

  const guardarPedido = async (patch, okMessage) => {
    try {
      setSending(true);
      await actualizarSuscripcionUsuario(uid, patch);
      showToast(okMessage);
      await cargar();
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar el pedido");
    } finally {
      setSending(false);
    }
  };

  const enviarReclamo = async () => {
    if (!note.trim()) {
      showToast("Escribí el reclamo antes de enviarlo");
      return;
    }
    try {
      setSending(true);
      await crearTicketSoporte({
        uid,
        email: auth.currentUser?.email || "",
        tipo: "reclamo_suscripcion",
        mensaje: note.trim(),
        currentPlanKey: account?.currentPlanKey || "",
      });
      setNote("");
      showToast("Reclamo enviado al administrador");
    } catch (error) {
      console.error(error);
      showToast("No se pudo enviar el reclamo");
    } finally {
      setSending(false);
    }
  };

  const diagnosticarPago = async () => {
    try {
      setSending(true);
      const res = await fetch("/api/mp-diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferenceId: activeAttempt?.preferenceId || null,
          invoiceId: activeAttempt?.invoiceId || null,
          uid: uid || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo diagnosticar");

      const payment = Array.isArray(data.payments) && data.payments.length ? data.payments[0] : null;
      const status = payment?.status || payment?.status_detail || null;
      const detail = payment?.status_detail || null;

      if (!payment) {
        const invoiceError = data.invoice?.errorMessage || data.invoice?.errorText || data.preferenceError || data.paymentsError;
        if (invoiceError) {
          showToast(String(invoiceError).slice(0, 180));
          return;
        }
        if (data.preference) {
          showToast("Preferencia creada, pero Mercado Pago no registro pago. Revisa que el comprador sea usuario test distinto.");
          return;
        }
        showToast("Sin pagos asociados todavia. Proba de nuevo en 30s.");
        return;
      }

      showToast(`MP: ${String(status || "sin estado")} ${detail ? `(${detail})` : ""}`.trim());
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo diagnosticar el pago");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <SectionTitle>Suscripción</SectionTitle>
        <p className="text-sm font-black text-slate-500">Cargando estado actual...</p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Suscripción</SectionTitle>
      <div className="space-y-3">
        {paymentResult === "error" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-700">Pago rechazado</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-rose-800">
              Mercado Pago devolvió un error. En sandbox, lo más común es:
            </p>
            <ul className="mt-2 space-y-1 text-[11px] font-bold text-rose-800">
              <li>Estás logueado con el usuario vendedor (tu cuenta) en vez de un comprador de prueba.</li>
              <li>Comprador y vendedor son el mismo usuario (no se puede).</li>
              <li>La tarjeta es de prueba, pero el comprador no es de prueba.</li>
            </ul>
            {activeAttempt?.invoiceId && (
              <div className="mt-3 bg-white/70 border border-rose-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-rose-700">Último intento</p>
                <p className="mt-1 text-[10px] font-black text-rose-900">Invoice: {activeAttempt.invoiceId}</p>
                {activeAttempt.preferenceId && (
                  <p className="text-[10px] font-black text-rose-900">Preference: {activeAttempt.preferenceId}</p>
                )}
                {activeAttempt.errorMessage && (
                  <p className="mt-1 text-[10px] font-bold text-rose-800 break-all">{String(activeAttempt.errorMessage).slice(0, 180)}</p>
                )}
              </div>
            )}
            <button
              onClick={diagnosticarPago}
              disabled={sending || (!activeAttempt?.invoiceId && !activeAttempt?.preferenceId)}
              className="mt-3 w-full rounded-2xl bg-slate-900 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
            >
              {sending ? "Consultando..." : "Diagnosticar pago"}
            </button>
          </div>
        )}

        {paymentResult === "ok" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Pago aprobado</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-emerald-800">
              Perfecto. Si el plan no cambia en unos segundos, recargá esta pantalla.
            </p>
          </div>
        )}

        {paymentResult === "pendiente" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Pago pendiente</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-amber-800">
              Mercado Pago informó que el pago quedó pendiente. Revisalo en unos minutos.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Importante</p>
          <p className="mt-1 text-[11px] font-bold leading-relaxed text-amber-800">
            Si Mercado Pago abre en <span className="font-black">SANDBOX</span>, el pago solo funciona con:
          </p>
          <ul className="mt-2 space-y-1 text-[11px] font-bold leading-relaxed text-amber-800">
            <li>Usuario <span className="font-black">COMPRADOR</span> de prueba.</li>
            <li>Vendedor (tu cuenta) distinto al comprador.</li>
            <li>Tarjeta de prueba.</li>
          </ul>
        </div>

        {true && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Último intento de pago</p>
            <div className="mt-2 space-y-1">
              {activeAttempt?.invoiceId && (
                <p className="text-[10px] font-black text-slate-800 break-all">Invoice: {activeAttempt.invoiceId}</p>
              )}
              {activeAttempt?.preferenceId && (
                <p className="text-[10px] font-black text-slate-800 break-all">Preference: {activeAttempt.preferenceId}</p>
              )}
              {activeAttempt?.at && (
                <p className="text-[10px] font-bold text-slate-500">
                  {new Date(Number(activeAttempt.at)).toLocaleString("es-AR")}
                </p>
              )}
              {activeAttempt?.status && (
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Estado: {activeAttempt.status}</p>
              )}
              {activeAttempt?.mode && (
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Checkout: {activeAttempt.mode}</p>
              )}
              {activeAttempt?.tokenMode && (
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Token MP: {activeAttempt.tokenMode}</p>
              )}
              {activeAttempt?.errorMessage && (
                <p className="text-[10px] font-bold text-rose-600 break-all">{String(activeAttempt.errorMessage).slice(0, 180)}</p>
              )}
              {!activeAttempt && (
                <p className="text-[10px] font-bold text-slate-500">Todavia no hay intento registrado en este dispositivo.</p>
              )}
            </div>
            <button
              onClick={diagnosticarPago}
              disabled={sending || (!activeAttempt?.invoiceId && !activeAttempt?.preferenceId)}
              className="mt-3 w-full rounded-2xl bg-slate-900 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
            >
              {sending ? "Consultando..." : "Diagnosticar pago"}
            </button>
            <p className="mt-2 text-[10px] font-bold text-slate-500">
              Si Mercado Pago te devolvió un error pero volviste a la app sin el mensaje, podés usar este botón igual.
            </p>
          </div>
        )}
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Estado actual</p>
              <p className="mt-1 text-lg font-black text-slate-800">{estadoLabel}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Plan actual</p>
              <p className="mt-1 text-lg font-black text-slate-800">{planLabel}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Vigente hasta</p>
              <p className="mt-1 text-sm font-black text-slate-700">
                {activoHasta ? new Date(activoHasta).toLocaleString("es-AR") : "Sin fecha"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tu UID de Firebase</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="flex-1 rounded-2xl bg-white px-3 py-3 text-[11px] font-black text-slate-700 break-all">{uid || "Sin UID"}</p>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(uid || "");
                      showToast("UID copiado");
                    } catch (error) {
                      console.error(error);
                      showToast("No se pudo copiar el UID");
                    }
                  }}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
                >
                  Copiar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => irAPagar("base")}
            disabled={sending}
            className="rounded-2xl bg-blue-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
          >
            {sending ? "Procesando..." : `Pagar base ${formatMoney(settings.precios?.base || 0)}`}
          </button>
          <button
            onClick={() => irAPagar("pro")}
            disabled={sending}
            className="rounded-2xl bg-slate-900 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
          >
            {sending ? "Procesando..." : `Cambiar a pro ${formatMoney(settings.precios?.pro || 0)}`}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => guardarPedido({ cancelAtPeriodEnd: true, requestedAction: "cancel_plan" }, "Cancelación pedida al cierre del período")}
            disabled={sending}
            className="rounded-2xl bg-red-50 border border-red-100 py-4 text-[10px] font-black uppercase tracking-widest text-red-600 active:scale-95 disabled:opacity-50"
          >
            Cancelar al vencer
          </button>
          <button
            onClick={() => guardarPedido({ requestedAction: "change_plan", requestedPlanKey: previousPlanKey || "base" }, "Pedido enviado para volver al plan anterior")}
            disabled={sending || !previousPlanKey}
            className="rounded-2xl bg-slate-50 border border-slate-200 py-4 text-[10px] font-black uppercase tracking-widest text-slate-700 active:scale-95 disabled:opacity-50"
          >
            Volver al plan anterior
          </button>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Reclamo o consulta</p>
          <textarea
            rows="4"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Explicá tu problema con el cobro, el plan o la suscripción."
            className="mt-3 w-full rounded-2xl border border-slate-200 p-4 text-xs font-bold text-slate-700 outline-none resize-none"
          />
          <button
            onClick={enviarReclamo}
            disabled={sending}
            className="mt-3 w-full rounded-2xl bg-emerald-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
          >
            Enviar reclamo al administrador
          </button>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Últimos cobros</p>
          <div className="mt-3 space-y-2">
            {invoices.length === 0 && <p className="text-[11px] font-bold text-slate-500">Todavía no hay cobros registrados.</p>}
            {invoices.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black text-slate-800">{item.planLabel || item.plan || "Plan"}</p>
                    <p className="text-[10px] font-bold text-slate-500">{item.status || "pendiente"}</p>
                  </div>
                  <p className="text-sm font-black text-slate-800">{formatMoney(item.amountPaid || item.amount || 0)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function PantallaSistema({ loadDemoData, clearAllData, handleLogout, showToast, cfg, setCfg }) {
  const [migrando, setMigrando] = React.useState(false);
  const [remoteBuild, setRemoteBuild] = React.useState(null);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [updatingApp, setUpdatingApp] = React.useState(false);
  const [installAvailable, setInstallAvailable] = React.useState(false);
  const displayMode = getDisplayModeInfo();
  const permissionLabel =
    typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "no soportado";
  const hasRemoteUpdate = isNewerBuild(APP_BUILD, remoteBuild);

  React.useEffect(() => {
    const unbind = bindInstallPromptCapture();
    const syncInstallState = () => setInstallAvailable(canPromptInstall());
    syncInstallState();
    window.addEventListener("jbos-install-available", syncInstallState);
    const checkRemoteBuild = async () => {
      try {
        const remote = await fetchRemoteVersion();
        setRemoteBuild(remote);
      } catch (error) {
        console.error(error);
      }
    };

    checkRemoteBuild();
    return () => {
      unbind();
      window.removeEventListener("jbos-install-available", syncInstallState);
    };
  }, []);

  const handleMigrarRaiz = async () => {
    setMigrando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Sin sesion");
      const n = await migrateFromRootCollections(uid);
      showToast(n > 0 ? `Migracion completa: ${n} registros movidos` : "Sin datos en colecciones raiz");
    } catch (e) {
      showToast("Error: " + e.message);
    } finally {
      setMigrando(false);
    }
  };

  const handleForzarSync = async () => {
    setMigrando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Sin sesion");
      const n = await forceSyncCacheToFirestore(uid);
      showToast(n > 0 ? `Sincronizado: ${n} registros guardados en la nube` : "No hay datos en memoria para sincronizar");
    } catch (e) {
      showToast("Error: " + e.message);
    } finally {
      setMigrando(false);
    }
  };

  const toggleTestMode = () => {
    const nuevo = { ...cfg, testModeRecordatorios: !cfg.testModeRecordatorios };
    setCfg(nuevo);
    LS.setDoc("config", "global", nuevo);
    showToast(nuevo.testModeRecordatorios ? "Modo prueba activado" : "Modo prueba desactivado");
  };

  const toggleAlertasNavegador = async () => {
    const activar = !(cfg.alertasNavegadorActivas ?? true);
    if (activar) {
      const permiso = await ensureNotificationPermission();
      if (permiso !== "granted") {
        showToast("El navegador no dio permiso para notificar");
      }
    }
    const nuevo = { ...cfg, alertasNavegadorActivas: activar };
    setCfg(nuevo);
    LS.setDoc("config", "global", nuevo);
    showToast(activar ? "Alertas del navegador activadas" : "Alertas del navegador desactivadas");
  };

  const probarNotificacion = async () => {
    const result = await sendTestNotification();
    if (result.ok) {
      showToast("Notificacion de prueba enviada");
      return;
    }
    if (result.permission === "denied") {
      showToast("El navegador bloqueo las notificaciones");
      return;
    }
    showToast("No se pudo enviar la notificacion de prueba");
  };

  const toggleAnalytics = () => {
    const nuevo = { ...cfg, analyticsEnabled: !(cfg.analyticsEnabled ?? true) };
    setCfg(nuevo);
    LS.setDoc("config", "global", nuevo);
    showToast(nuevo.analyticsEnabled ? "Analitica activada" : "Analitica desactivada");
  };

  const buscarActualizacion = async () => {
    setCheckingUpdate(true);
    try {
      const remote = await fetchRemoteVersion();
      setRemoteBuild(remote);
      showToast(isNewerBuild(APP_BUILD, remote) ? "Hay una version nueva lista para instalar" : "Esta app ya tiene la ultima version");
    } catch (error) {
      console.error(error);
      showToast("No se pudo consultar la ultima version");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const instalarActualizacion = async () => {
    setUpdatingApp(true);
    try {
      const remote = remoteBuild || await fetchRemoteVersion();
      await applyRemoteUpdate(remote);
    } catch (error) {
      console.error(error);
      setUpdatingApp(false);
      showToast("No se pudo instalar la actualizacion");
    }
  };

  const instalarApp = async () => {
    const result = await promptInstallApp();
    if (result.ok) {
      setInstallAvailable(false);
      showToast("Instalacion iniciada");
      return;
    }
    if (result.reason === "unavailable") {
      showToast("El instalador no esta disponible en este navegador o dispositivo");
      return;
    }
    showToast("La instalacion fue cancelada");
  };

  return (
    <div className="space-y-4">
      <PantallaSuscripcion showToast={showToast} />

      <Card>
        <SectionTitle>Analitica del producto</SectionTitle>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-800">Medicion de uso</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              Registra pantallas, acciones clave y friccion para mejorar la app.
            </p>
          </div>
          <button
            onClick={toggleAnalytics}
            className={`relative w-14 h-7 rounded-full transition-all duration-200 active:scale-95 ${(cfg.analyticsEnabled ?? true) ? "bg-emerald-500" : "bg-slate-200"}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${(cfg.analyticsEnabled ?? true) ? "left-8" : "left-1"}`} />
          </button>
        </div>
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
          <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">
            Estado actual: {(cfg.analyticsEnabled ?? true) ? "Activo" : "Pausado"}
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>Alertas del navegador</SectionTitle>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-800">Notificaciones de proximo service</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Muestran un aviso real del navegador cuando un recordatorio entra en proximo o vencido.</p>
          </div>
          <button
            onClick={toggleAlertasNavegador}
            className={`relative w-14 h-7 rounded-full transition-all duration-200 active:scale-95 ${(cfg.alertasNavegadorActivas ?? true) ? "bg-blue-500" : "bg-slate-200"}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${(cfg.alertasNavegadorActivas ?? true) ? "left-8" : "left-1"}`} />
          </button>
        </div>
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
            Estado del permiso: {permissionLabel}
          </p>
        </div>
        <button
          onClick={probarNotificacion}
          className="mt-3 w-full bg-slate-900 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
        >
          Enviar notificacion de prueba
        </button>
        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-2xl p-3">
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-wider">
            Proba la alerta con la app abierta, instalada y tambien en segundo plano para validar si tu dispositivo realmente la muestra.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>Modo prueba de recordatorios</SectionTitle>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-800">Modo prueba</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Permite crear alertas rapidas para probar recordatorios y WhatsApp</p>
          </div>
          <button
            onClick={toggleTestMode}
            className={`relative w-14 h-7 rounded-full transition-all duration-200 active:scale-95 ${cfg.testModeRecordatorios ? "bg-purple-500" : "bg-slate-200"}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${cfg.testModeRecordatorios ? "left-8" : "left-1"}`} />
          </button>
        </div>
        {cfg.testModeRecordatorios && (
          <div className="mt-3 bg-purple-50 border border-purple-200 rounded-2xl p-3">
            <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider">
              Modo prueba activo. Las opciones de test aparecen en Proximo control al cargar un trabajo.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Version de la app</SectionTitle>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-black text-slate-800">Johnny Blaze OS</span>
          <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full border border-blue-100">{APP_BUILD.version}</span>
        </div>
        <div className="space-y-3 mb-4">
          <p className="text-[10px] text-slate-400 font-bold">
            Si la app instalada se queda vieja, busca la ultima version e instalala desde aca.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Modo de uso</p>
            <p className="text-xs font-black text-slate-700 mt-1">{displayMode.label}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Instalador PWA</p>
            <p className="text-xs font-black text-slate-700 mt-1">
              {installAvailable ? "Disponible para instalar en este navegador" : "No disponible ahora"}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Ultima compilacion local</p>
            <p className="text-xs font-black text-slate-700 mt-1">{new Date(APP_BUILD.buildTime).toLocaleString("es-AR")}</p>
          </div>
          <div className={`rounded-2xl border p-3 ${hasRemoteUpdate ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-200"}`}>
            <p className={`text-[9px] font-black uppercase tracking-wider ${hasRemoteUpdate ? "text-amber-700" : "text-slate-500"}`}>Ultimo deploy detectado</p>
            <p className={`text-xs font-black mt-1 ${hasRemoteUpdate ? "text-amber-900" : "text-slate-700"}`}>
              {remoteBuild?.version || "Sin dato"}
            </p>
            {remoteBuild?.buildTime && (
              <p className="text-[10px] font-bold text-slate-500 mt-1">
                {new Date(remoteBuild.buildTime).toLocaleString("es-AR")}
              </p>
            )}
            <p className={`mt-2 text-[10px] font-black ${hasRemoteUpdate ? "text-amber-700" : "text-emerald-600"}`}>
              {hasRemoteUpdate ? "Hay una actualizacion pendiente para esta app instalada." : "Esta app ya esta al dia."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={buscarActualizacion}
            disabled={checkingUpdate || updatingApp}
            className="w-full bg-slate-50 border border-slate-200 text-slate-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            {checkingUpdate ? "Buscando..." : "Buscar actualizacion"}
          </button>
          <button
            onClick={hasRemoteUpdate ? instalarActualizacion : () => window.location.reload()}
            disabled={checkingUpdate || updatingApp}
            className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 ${hasRemoteUpdate ? "bg-blue-600 text-white" : "bg-slate-900 text-white"}`}
          >
            {updatingApp ? "Actualizando..." : hasRemoteUpdate ? "Instalar version nueva" : "Recargar app"}
          </button>
        </div>
        {!displayMode.installed && (
          <button
            onClick={instalarApp}
            disabled={!installAvailable}
            className={`mt-3 w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 ${installAvailable ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500"}`}
          >
            Instalar app
          </button>
        )}
      </Card>

      <Card>
        <SectionTitle>Datos del sistema</SectionTitle>
        <div className="space-y-2">
          {loadDemoData && (
            <button
              onClick={() => { loadDemoData(); showToast("Demo cargado"); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              Cargar datos de prueba
            </button>
          )}

          <button
            onClick={handleForzarSync}
            disabled={migrando}
            className="w-full flex items-center justify-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            <Database size={14} /> {migrando ? "Sincronizando..." : "Forzar sincronizacion a la nube"}
          </button>

          <button
            onClick={handleMigrarRaiz}
            disabled={migrando}
            className="w-full flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            <Database size={14} /> {migrando ? "Migrando..." : "Migrar datos legado"}
          </button>

          {clearAllData && (
            <button
              onClick={clearAllData}
              className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-100 text-red-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              <Trash2 size={14} /> Borrar todos los datos
            </button>
          )}
        </div>
      </Card>

      {handleLogout && (
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
        >
          <LogOut size={16} /> Cerrar sesion
        </button>
      )}
    </div>
  );
}

export default function ConfigView({ setView, showToast, orders = [], bikes = [], clients = [], handleLogout, loadDemoData, clearAllData }) {
  const [activeTab, setActiveTab] = useState(() => window.localStorage.getItem("jbos_config_tab") || "resumen");
  const [cfg, setCfg] = useState(() => LS.getDoc("config", "global") || CONFIG_DEFAULT);
  const [bkpEstado, setBkpEstado] = useState(() => estadoBackup());
  const fileInputRef = useRef(null);
  const caja = useCollection("caja");
  const canSeeAdminTab =
    PLATFORM_ADMIN_EMAILS.includes((auth.currentUser?.email || "").toLowerCase()) ||
    PLATFORM_ADMIN_UIDS.includes(auth.currentUser?.uid || "");
  const visibleTabs = canSeeAdminTab ? TABS : TABS.filter((tab) => tab.id !== "admin");

  useEffect(() => {
    window.localStorage.setItem("jbos_config_tab", activeTab);
  }, [activeTab]);

  const handleRestaurarArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const resultado = restaurarDesdeTexto(ev.target.result);
      if (resultado.ok) {
        showToast(`Restaurado OK (${resultado.restaurados} colecciones)`);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        showToast(`Error: ${resultado.error}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRestaurarAuto = () => {
    const resultado = restaurarAutoBackup();
    if (resultado.ok) {
      showToast("Restaurado desde copia automatica OK");
      setTimeout(() => window.location.reload(), 1200);
    } else {
      showToast(`Error: ${resultado.error}`);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "resumen": return <PantallaResumen orders={orders} caja={caja} />;
      case "taller":  return <PantallaTaller cfg={cfg} setCfg={setCfg} showToast={showToast} />;
      case "datos":   return <PantallaDatos orders={orders} bikes={bikes} clients={clients} cfg={cfg} showToast={showToast} bkpEstado={bkpEstado} setBkpEstado={setBkpEstado} fileInputRef={fileInputRef} handleRestaurarArchivo={handleRestaurarArchivo} handleRestaurarAuto={handleRestaurarAuto} />;
      case "sistema": return <PantallaSistema loadDemoData={loadDemoData} clearAllData={clearAllData} handleLogout={handleLogout} showToast={showToast} cfg={cfg} setCfg={setCfg} />;
      case "admin":   return <PantallaAdmin showToast={showToast} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 bg-slate-950">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Cuenta</h1>
      </div>

      {/* Tab bar */}
      <div className="px-4 pb-3 bg-slate-950">
        <div className="flex gap-1 bg-slate-800 p-1 rounded-2xl">
          {visibleTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all ${
                activeTab === id
                  ? "bg-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={15} className={activeTab === id ? "text-slate-800" : ""} />
              <span className={`text-[9px] font-black uppercase tracking-wide ${activeTab === id ? "text-slate-800" : ""}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-4">
        {renderContent()}
      </div>
    </div>
  );
}


