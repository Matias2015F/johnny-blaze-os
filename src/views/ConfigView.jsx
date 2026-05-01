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

function PantallaAdmin({ showToast }) {
  const [loading, setLoading] = React.useState(true);
  const [account, setAccount] = React.useState(null);
  const [accounts, setAccounts] = React.useState([]);
  const [settings, setSettings] = React.useState(DEFAULT_ADMIN_SETTINGS);
  const [snapshots, setSnapshots] = React.useState([]);
  const [eventos, setEventos] = React.useState([]);
  const [invoices, setInvoices] = React.useState([]);
  const [tickets, setTickets] = React.useState([]);
  const [motosFrecuentes, setMotosFrecuentes] = React.useState([]);
  const [serviciosFrecuentes, setServiciosFrecuentes] = React.useState([]);
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
        getDocs(collection(db, "usageSnapshots")),
        getDocs(query(collection(db, "telemetryEvents"), orderBy("createdAt", "desc"), limit(200))),
        getDocs(collection(db, "billingInvoices")),
        getDocs(collection(db, "soporteTickets")),
        getDocs(query(collectionGroup(db, "motos"), limit(250))),
        getDocs(query(collectionGroup(db, "catalogoTareas"), limit(250))),
      ]);

      const [accountsRes, snapshotsRes, eventosRes, invoicesRes, ticketsRes, motosRes, serviciosRes] = results;

      if (accountsRes.status === "fulfilled") {
        setAccounts(accountsRes.value.docs.map((d) => normalizeSaasUser({ id: d.id, ...d.data() }, { uid: d.id })));
      } else {
        console.error(accountsRes.reason);
        setAccounts([]);
      }

      if (snapshotsRes.status === "fulfilled") {
        setSnapshots(snapshotsRes.value.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || ""))));
      } else {
        console.error(snapshotsRes.reason);
        setSnapshots([]);
      }

      if (eventosRes.status === "fulfilled") {
        setEventos(sortByDateDesc(eventosRes.value.docs.map((d) => ({ id: d.id, ...d.data() })), "createdAt", "updatedAt"));
      } else {
        console.error(eventosRes.reason);
        setEventos([]);
      }

      if (invoicesRes.status === "fulfilled") {
        setInvoices(sortByDateDesc(invoicesRes.value.docs.map((d) => ({ id: d.id, ...d.data() })), "paidAt", "createdAt", "updatedAt"));
      } else {
        console.error(invoicesRes.reason);
        setInvoices([]);
      }

      if (ticketsRes.status === "fulfilled") {
        setTickets(sortByDateDesc(ticketsRes.value.docs.map((d) => ({ id: d.id, ...d.data() })), "createdAt", "updatedAt"));
      } else {
        console.error(ticketsRes.reason);
        setTickets([]);
      }

      const motosCount = {};
      if (motosRes.status === "fulfilled") {
        motosRes.value.docs.forEach((d) => {
          const item = d.data() || {};
          const key = [item.marca, item.modelo, item.cilindrada].filter(Boolean).join(" · ");
          if (!key) return;
          motosCount[key] = (motosCount[key] || 0) + 1;
        });
      } else {
        console.error(motosRes.reason);
      }
      setMotosFrecuentes(Object.entries(motosCount).sort((a, b) => b[1] - a[1]).slice(0, 5));

      const serviciosCount = {};
      if (serviciosRes.status === "fulfilled") {
        serviciosRes.value.docs.forEach((d) => {
          const item = d.data() || {};
          const key = String(item.nombre || item.label || "").trim();
          if (!key) return;
          serviciosCount[key] = (serviciosCount[key] || 0) + 1;
        });
      } else {
        console.error(serviciosRes.reason);
      }
      setServiciosFrecuentes(Object.entries(serviciosCount).sort((a, b) => b[1] - a[1]).slice(0, 5));
    } catch (e) {
      console.error(e);
      showToast("No se pudo cargar el panel admin");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    cargar();
  }, []);

  const resumenUso = React.useMemo(() => snapshots.reduce((acc, item) => {
    Object.entries(item.topActions || {}).forEach(([key, value]) => {
      acc[key] = (acc[key] || 0) + Number(value || 0);
    });
    return acc;
  }, {}), [snapshots]);

  const resumenPantallas = React.useMemo(() => snapshots.reduce((acc, item) => {
    Object.entries(item.topScreens || {}).forEach(([key, value]) => {
      acc[key] = (acc[key] || 0) + Number(value || 0);
    });
    return acc;
  }, {}), [snapshots]);

  const topAcciones = Object.entries(resumenUso).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topPantallas = Object.entries(resumenPantallas).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const totalEventosSemana = React.useMemo(() => snapshots.reduce((acc, item) => acc + Object.values(item.metrics || {}).reduce((sum, value) => sum + Number(value || 0), 0), 0), [snapshots]);
  const totalPantallasSemana = React.useMemo(() => snapshots.reduce((acc, item) => acc + Object.values(item.topScreens || {}).reduce((sum, value) => sum + Number(value || 0), 0), 0), [snapshots]);

  const resumenNegocio = React.useMemo(() => {
    const now = Date.now();
    const sieteDias = now - 7 * 24 * 60 * 60 * 1000;
    const trialsPorVencer = accounts.filter((item) => {
      const trial = normalizeDateValue(item.activoHasta || item.trialEndsAt)?.getTime();
      return item.estado === "trial" && trial && trial >= now && trial <= now + 5 * 24 * 60 * 60 * 1000;
    }).length;
    const activos7 = accounts.filter((item) => {
      const lastSeen = normalizeDateValue(item.lastSeenAt)?.getTime();
      return lastSeen && lastSeen >= sieteDias;
    }).length;
    const pendientes = invoices.filter((item) => String(item.status || "").toLowerCase() !== "approved").length;
    const facturacionMes = invoices
      .filter((item) => item.status === "approved")
      .filter((item) => {
        const created = Number(item.paidAt || item.createdAt || 0);
        const date = new Date(created);
        const current = new Date();
        return date.getMonth() === current.getMonth() && date.getFullYear() === current.getFullYear();
      })
      .reduce((acc, item) => acc + Number(item.amountPaid || item.amount || 0), 0);
    return { trialsPorVencer, activos7, pendientes, facturacionMes };
  }, [accounts, invoices]);

  const resumenUsuarios = React.useMemo(() => {
    const total = accounts.length;
    const trial = accounts.filter((item) => item.estado === "trial").length;
    const activos = accounts.filter((item) => item.estado === "activo").length;
    const vencidos = accounts.filter((item) => item.estado === "vencido").length;
    const base = accounts.filter((item) => (item.currentPlanKey || item.plan || "base") === "base").length;
    const pro = accounts.filter((item) => (item.currentPlanKey || item.plan) === "pro").length;
    const admins = accounts.filter((item) => item.rol === "admin" || item.isPlatformAdmin).length;
    return { total, trial, activos, vencidos, base, pro, admins };
  }, [accounts]);

  const funnel = React.useMemo(() => {
    const get = (key) => Number(resumenUso[key] || 0);
    return [
      { label: "Nuevo ingreso", value: get("nuevo_ingreso") },
      { label: "Guardar trabajo", value: get("guardar_trabajo") },
      { label: "Registrar pago", value: get("registrar_pago") },
      { label: "Emitir comprobante", value: get("emitir_comprobante") },
    ];
  }, [resumenUso]);

  const friction = React.useMemo(() => {
    const nuevos = Number(resumenUso.nuevo_ingreso || 0);
    const guardados = Number(resumenUso.guardar_trabajo || 0);
    const pagos = Number(resumenUso.registrar_pago || 0);
    const comprobantes = Number(resumenUso.emitir_comprobante || 0);
    return {
      abandonoNuevaOrden: nuevos > 0 ? Math.max(0, Math.round(((nuevos - guardados) / nuevos) * 100)) : 0,
      conversionTrabajoPago: guardados > 0 ? Math.round((pagos / guardados) * 100) : 0,
      conversionPagoCierre: pagos > 0 ? Math.round((comprobantes / pagos) * 100) : 0,
    };
  }, [resumenUso]);

  const guardarSettings = async () => {
    try {
      await guardarAdminSettings(settings, { uid: user?.uid || "", email: user?.email || "" });
      showToast("Reglas globales guardadas");
      cargar();
    } catch (error) {
      console.error(error);
      showToast("No se pudieron guardar las reglas");
    }
  };

  const cuentasConPedidos = accounts.filter((item) => item.requestedAction || item.cancelAtPeriodEnd);

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
      console.error(error);
      showToast("No se pudo resolver el pedido");
    }
  };

  const resolverTicket = async (ticketId) => {
    try {
      await setDoc(doc(db, "soporteTickets", ticketId), { estado: "resuelto", updatedAt: new Date().toISOString() }, { merge: true });
      showToast("Reclamo marcado como resuelto");
      cargar();
    } catch (error) {
      console.error(error);
      showToast("No se pudo resolver el reclamo");
    }
  };

  if (loading) {
    return <Card><SectionTitle>Admin</SectionTitle><p className="text-sm font-black text-slate-500">Cargando métricas y licencias...</p></Card>;
  }

  if (!(isPlatformAdmin || account?.isPlatformAdmin)) {
    return <Card><SectionTitle>Admin</SectionTitle><p className="text-sm font-black text-slate-700">Este panel es solo para vos como autor y administrador de Johnny Blaze OS.</p></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>Configuración global</SectionTitle>
        <p className="mb-4 text-[11px] font-bold leading-relaxed text-slate-500">
          Desde acá definís prueba, precios y funciones para los talleres nuevos.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Días de prueba</p>
            <p className="mt-1 text-[10px] font-bold text-slate-500">Cuántos días gratis recibe un taller nuevo.</p>
            <input type="text" inputMode="numeric" value={String(settings.duracionTrialDias || 14)} onChange={(e) => setSettings((prev) => ({ ...prev, duracionTrialDias: Number(e.target.value.replace(/\D/g, "") || 14) }))} className="mt-3 w-full bg-transparent text-2xl font-black text-slate-800 outline-none" />
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Días de gracia</p>
            <p className="mt-1 text-[10px] font-bold text-slate-500">Cuántos días extra tiene antes de bloquear acceso.</p>
            <input type="text" inputMode="numeric" value={String(settings.graceDaysDefault || 3)} onChange={(e) => setSettings((prev) => ({ ...prev, graceDaysDefault: Number(e.target.value.replace(/\D/g, "") || 3) }))} className="mt-3 w-full bg-transparent text-2xl font-black text-slate-800 outline-none" />
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio plan base</p>
            <p className="mt-1 text-[10px] font-bold text-slate-500">Valor para talleres nuevos del plan base.</p>
            <input type="text" inputMode="numeric" value={String(settings.precios?.base || 0)} onChange={(e) => setSettings((prev) => ({ ...prev, precios: { ...(prev.precios || {}), base: Number(e.target.value.replace(/\D/g, "") || 0) } }))} className="mt-3 w-full bg-transparent text-2xl font-black text-slate-800 outline-none" />
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio plan pro</p>
            <p className="mt-1 text-[10px] font-bold text-slate-500">Valor para talleres nuevos del plan pro.</p>
            <input type="text" inputMode="numeric" value={String(settings.precios?.pro || 0)} onChange={(e) => setSettings((prev) => ({ ...prev, precios: { ...(prev.precios || {}), pro: Number(e.target.value.replace(/\D/g, "") || 0) } }))} className="mt-3 w-full bg-transparent text-2xl font-black text-slate-800 outline-none" />
          </div>
        </div>
        <div className="mt-3 bg-slate-50 border border-slate-100 rounded-2xl p-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Aplicación de precios</p>
          <p className="mt-1 text-[10px] font-bold text-slate-500">Definí si los cambios de precio afectan solo a los talleres nuevos.</p>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm font-black text-slate-800">Aplicar solo a cuentas nuevas</p>
            <button onClick={() => setSettings((prev) => ({ ...prev, applyPricingToNewAccountsOnly: !prev.applyPricingToNewAccountsOnly }))} className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${settings.applyPricingToNewAccountsOnly !== false ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-700"}`}>{settings.applyPricingToNewAccountsOnly !== false ? "Sí" : "No"}</button>
          </div>
        </div>
        <div className="mt-3">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Funciones incluidas</p>
          <p className="mt-1 text-[10px] font-bold text-slate-500">Prendé o apagá funciones para talleres nuevos según el plan.</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {Object.entries(settings.features || {}).map(([key, value]) => (
            <button key={key} onClick={() => setSettings((prev) => ({ ...prev, features: { ...(prev.features || {}), [key]: !value } }))} className={`rounded-2xl border px-3 py-3 text-left ${value ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              <p className="text-[10px] font-black uppercase tracking-widest">{FEATURE_LABELS[key] || key}</p>
              <p className="mt-1 text-[10px] font-bold">{value ? "Activa" : "Desactivada"}</p>
            </button>
          ))}
        </div>
        <div className="mt-3"><button onClick={guardarSettings} className="w-full rounded-2xl bg-blue-600 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95">Guardar configuración global</button></div>
      </Card>

      <Card>
        <SectionTitle>Salud del SaaS</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Activos 7 días</p><p className="mt-1 text-2xl font-black text-slate-800">{resumenNegocio.activos7}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trials por vencer</p><p className="mt-1 text-2xl font-black text-slate-800">{resumenNegocio.trialsPorVencer}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pagos pendientes</p><p className="mt-1 text-2xl font-black text-slate-800">{resumenNegocio.pendientes}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Facturación del mes</p><p className="mt-1 text-xl font-black text-emerald-600">{formatMoney(resumenNegocio.facturacionMes)}</p></div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Usuarios y planes</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Usuarios totales</p><p className="mt-1 text-2xl font-black text-slate-800">{resumenUsuarios.total}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Admins</p><p className="mt-1 text-2xl font-black text-slate-800">{resumenUsuarios.admins}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">En prueba</p><p className="mt-1 text-2xl font-black text-amber-600">{resumenUsuarios.trial}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Activos</p><p className="mt-1 text-2xl font-black text-emerald-600">{resumenUsuarios.activos}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vencidos</p><p className="mt-1 text-2xl font-black text-red-600">{resumenUsuarios.vencidos}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan pro</p><p className="mt-1 text-2xl font-black text-blue-600">{resumenUsuarios.pro}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 col-span-2"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Plan base</p><p className="mt-1 text-2xl font-black text-slate-800">{resumenUsuarios.base}</p></div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Pedidos de usuarios</SectionTitle>
        <div className="space-y-3">
          {cuentasConPedidos.length === 0 && <p className="text-sm font-black text-slate-500">No hay pedidos pendientes.</p>}
          {cuentasConPedidos.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-800">{item.nombreTaller || item.email || item.uid}</p>
                  <p className="text-[10px] font-bold text-slate-400">{item.email || item.uid}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">UID: {item.uid}</p>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">
                  {formatRequestedAction(item)}
                </p>
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
                  Limpiar pedido
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Reclamos</SectionTitle>
        <div className="space-y-3">
          {tickets.length === 0 && <p className="text-sm font-black text-slate-500">No hay reclamos cargados.</p>}
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-800">{ticket.email || ticket.uid}</p>
                  <p className="text-[10px] font-bold text-slate-500">UID: {ticket.uid}</p>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">{ticket.estado || "nuevo"}</p>
              </div>
              <p className="text-[11px] font-bold leading-relaxed text-slate-700">{ticket.mensaje || "Sin mensaje"}</p>
              <button
                onClick={() => resolverTicket(ticket.id)}
                disabled={ticket.estado === "resuelto"}
                className="w-full rounded-2xl bg-blue-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                {ticket.estado === "resuelto" ? "Resuelto" : "Marcar como resuelto"}
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Uso de los últimos 7 días</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Eventos</p><p className="mt-1 text-2xl font-black text-slate-800">{totalEventosSemana}</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pantallas</p><p className="mt-1 text-2xl font-black text-slate-800">{totalPantallasSemana}</p></div>
        </div>
        <div className="space-y-3">
          {topAcciones.length > 0 ? topAcciones.map(([accion, total]) => (
            <div key={accion} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500"><span>{accion.replaceAll("_", " ")}</span><span className="text-slate-800">{total}</span></div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min((total / Math.max(topAcciones[0]?.[1] || 1, 1)) * 100, 100)}%` }} /></div>
            </div>
          )) : <p className="text-sm font-black text-slate-500">Todavía no hay datos de uso suficientes.</p>}
        </div>
      </Card>

      <Card>
        <SectionTitle>Embudo y fricción</SectionTitle>
        <div className="space-y-3">
          {funnel.map((item) => (
            <div key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-500"><span>{item.label}</span><span className="text-slate-800">{item.value}</span></div>
              <div className="h-3 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min((item.value / Math.max(funnel[0]?.value || 1, 1)) * 100, 100)}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Abandono nueva orden</p><p className="mt-1 text-xl font-black text-red-600">{friction.abandonoNuevaOrden}%</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Trabajo a pago</p><p className="mt-1 text-xl font-black text-slate-800">{friction.conversionTrabajoPago}%</p></div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pago a cierre</p><p className="mt-1 text-xl font-black text-slate-800">{friction.conversionPagoCierre}%</p></div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Qué usan más</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Pantallas</p>
            <div className="space-y-2">
              {topPantallas.length > 0 ? topPantallas.map(([pantalla, total]) => (
                <div key={pantalla} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{pantalla}</span><span className="text-sm font-black text-slate-800">{total}</span></div>
              )) : <p className="text-sm font-black text-slate-500">Sin datos.</p>}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Funciones</p>
            <div className="space-y-2">
              {topAcciones.length > 0 ? topAcciones.map(([accion, total]) => (
                <div key={accion} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{accion.replaceAll("_", " ")}</span><span className="text-sm font-black text-slate-800">{total}</span></div>
              )) : <p className="text-sm font-black text-slate-500">Sin datos.</p>}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Mercado y uso real</SectionTitle>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Motos más cargadas</p>
            <div className="space-y-2">
              {motosFrecuentes.length > 0 ? motosFrecuentes.map(([item, total]) => (
                <div key={item} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3"><span className="text-xs font-black text-slate-700">{item}</span><span className="text-sm font-black text-slate-800">{total}</span></div>
              )) : <p className="text-sm font-black text-slate-500">Sin datos.</p>}
            </div>
          </div>
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Servicios más usados</p>
            <div className="space-y-2">
              {serviciosFrecuentes.length > 0 ? serviciosFrecuentes.map(([item, total]) => (
                <div key={item} className="flex items-center justify-between rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3"><span className="text-xs font-black text-slate-700">{item}</span><span className="text-sm font-black text-slate-800">{total}</span></div>
              )) : <p className="text-sm font-black text-slate-500">Sin datos.</p>}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle>Usuarios</SectionTitle>
        <div className="space-y-3">
          {accounts.length === 0 && <p className="text-sm font-black text-slate-500">Todavia no aparecen usuarios cargados en la coleccion nueva.</p>}
          {accounts.slice(0, 20).map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-800">{item.nombreTaller || item.email || item.uid}</p>
                  <p className="text-[10px] font-bold text-slate-400">{item.email || "Sin email"}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1">UID: {item.uid || item.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">{item.estado || "trial"}</p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{item.rol || "user"}</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[10px] font-black text-slate-500">
                <div>Plan: <span className="text-slate-800">{item.currentPlanKey || item.plan || "base"}</span></div>
                <div>Vigente hasta: <span className="text-slate-800">{formatAdminDate(item.activoHasta, "Sin fecha")}</span></div>
                <div>Pago: <span className="text-slate-800">{item.pagoEstado || "pendiente"}</span></div>
                <div>Ultimo uso: <span className="text-slate-800">{formatAdminDate(item.lastSeenAt, "Sin dato")}</span></div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Actividad reciente global</SectionTitle>
        <div className="space-y-2">
          {eventos.length > 0 ? eventos.slice(0, 15).map((evento) => (
            <div key={evento.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">{evento.action?.replaceAll("_", " ")}</p>
              <p className="mt-1 text-xs font-black text-slate-800">{evento.screen || "sin pantalla"} · {evento.entityType || "general"}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-400">{evento.uid || "sin usuario"}</p>
              <p className="mt-1 text-[10px] font-bold text-slate-400">{formatAdminDate(evento.createdAt, "Sin fecha")}</p>
            </div>
          )) : <p className="text-sm font-black text-slate-500">Todavía no hay actividad reciente.</p>}
        </div>
      </Card>
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
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
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

  const planLabel = account?.currentPlanKey === "pro" ? "Plan Pro" : account?.estado === "trial" ? "Prueba" : "Plan Base";
  const estadoLabel = account?.estado === "activo" ? "Activa" : account?.estado === "trial" ? "En prueba" : "Vencida";
  const activoHasta = normalizeDateMs(account?.activoHasta || account?.trialEndsAt || account?.nextBillingAt);
  const previousPlanKey = account?.previousPlanKey || "";

  const irAPagar = async (planKey) => {
    try {
      setSending(true);
      const res = await fetch("/api/mp-create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid, plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "No se pudo generar el pago");
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


