import { fetchRemoteVersion } from "../lib/appUpdate.js";
import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  ChevronRight, ChevronLeft, Shield,
} from "lucide-react";
import { LS, useCollection } from "../lib/storage.js";
import { auth, db } from "../firebase.js";
import {
  collection, doc, getDoc, getDocs, getDocsFromServer,
  query, limit, orderBy, where,
} from "firebase/firestore";
import {
  DEFAULT_SAAS_ADMIN_SETTINGS as DEFAULT_ADMIN_SETTINGS,
  PLATFORM_ADMIN_EMAILS, PLATFORM_ADMIN_UIDS,
  actualizarSuscripcionUsuario, crearTicketSoporte,
  guardarAdminSettings, isPlatformAdminUser, leerAdminSettings,
  leerUsuarioSaas, normalizeAdminSettings, normalizeDateMs,
  normalizeSaasUser, resolverTicketSoporte,
} from "../services/saasService.js";
import { logAdminAction } from "../services/adminAuditService.js";
import { validateAdminSettings, validateExtraDays, validatePlanKey } from "../services/adminValidationService.js";
import { FREE_PLAN_LIMITS, getFreeUsageStatus } from "../services/usageLimitService.js";
import { formatMoney } from "../utils/format.js";

function Card({ children, className = "" }) {
  return <div className={`rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 shadow-xl ${className}`}>{children}</div>;
}
function SectionTitle({ children }) {
  return <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-4">{children}</p>;
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

export const PLAN_LABELS = {
  base: "Mensual",
  pro: "Trimestral",
  full: "Anual",
};

function getPlanLabel(planKey) {
  return PLAN_LABELS[planKey] || "Mensual";
}

function formatRequestedAction(item = {}) {
  if (item.cancelAtPeriodEnd || item.requestedAction === "cancel_plan") {
    return "Cancelar al vencer";
  }
  if (item.requestedAction === "change_plan") {
    return `Cambiar a ${getPlanLabel(item.requestedPlanKey)}`;
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
  recordatorios: "Próximo control",
  analytics: "Analítica de uso",
  multiusuario: "Multiusuario",
};

const ADMIN_TABS = [
  { id: "dashboard",      label: "Resumen" },
  { id: "planes",         label: "Planes" },
  { id: "usuarios",       label: "Usuarios" },
  { id: "cobros",         label: "Cobros" },
  { id: "consultas",      label: "Consultas" },
  { id: "calificaciones", label: "Calificac." },
];

async function cargarPanelAdminDesdeServidor() {
  const token = await auth.currentUser.getIdToken(true);
  const res = await fetch("/api/admin-dashboard", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
  });
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : { error: await res.text() };
  if (!res.ok) throw new Error(body?.error || "No se pudo cargar el panel administrador");
  return body;
}

function MoneyValue({ amount, className = "" }) {
  return (
    <p className={`text-xl sm:text-2xl font-black text-zinc-800 ${className}`}>{formatMoney(Number(amount || 0))}</p>
  );
}

function StatBox({ label, value, color = "text-zinc-800" }) {
  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
      <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{label}</p>
      <div className={`mt-1 text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}

function AdminPlanPriceBlock({ planKey, label, tone = "zinc", settings, setSettings }) {
  const fallbackDays = { base: 30, pro: 90, full: 365 };
  const price = Number(settings.precios?.[planKey] || 0);
  const days = Number(settings.planDurations?.[planKey] || settings.plans?.[planKey]?.billingDays || fallbackDays[planKey] || 30);
  const isDark = tone === "dark";
  const borderClass = isDark ? "border-zinc-700 bg-zinc-900 text-white" : tone === "orange" ? "border-orange-100 bg-orange-50" : "border-zinc-100 bg-zinc-50";
  const labelClass = isDark ? "text-zinc-300" : tone === "orange" ? "text-orange-600" : "text-zinc-500";
  const badgeClass = isDark ? "bg-zinc-700 text-zinc-200" : tone === "orange" ? "bg-orange-200 text-orange-800" : "bg-zinc-200 text-zinc-700";
  const inputClass = isDark ? "text-white" : "text-zinc-900";

  const updatePrice = (value) => {
    const next = Number(String(value).replace(/\D/g, "") || 0);
    setSettings((p) => ({ ...p, precios: { ...(p.precios || {}), [planKey]: next } }));
  };

  const updateDays = (value) => {
    const next = Number(String(value).replace(/\D/g, "") || fallbackDays[planKey] || 30);
    setSettings((p) => ({ ...p, planDurations: { ...(p.planDurations || {}), [planKey]: next } }));
  };

  return (
    <div className={`rounded-2xl border p-4 ${borderClass}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-widest ${labelClass}`}>{label}</p>
          <p className={`mt-1 text-[10px] font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Precio y duracion visibles en app y landing.</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${badgeClass}`}>{days} dias</span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_92px] gap-3">
        <label className="min-w-0 rounded-2xl border border-black/5 bg-white/70 px-3 py-3">
          <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">Precio ARS</span>
          <input
            type="text"
            inputMode="numeric"
            value={String(price)}
            onChange={(e) => updatePrice(e.target.value)}
            className={`mt-1 w-full min-w-0 bg-transparent text-2xl font-black outline-none ${inputClass}`}
            placeholder="0"
          />
        </label>
        <label className="rounded-2xl border border-black/5 bg-white/70 px-3 py-3">
          <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-400">Dias</span>
          <input
            type="text"
            inputMode="numeric"
            value={String(days)}
            onChange={(e) => updateDays(e.target.value)}
            className={`mt-1 w-full bg-transparent text-2xl font-black outline-none ${inputClass}`}
            placeholder="30"
          />
        </label>
      </div>

      <div className={`mt-3 rounded-2xl px-3 py-2 ${isDark ? "bg-black/20" : "bg-white/70"}`}>
        <p className={`text-[9px] font-black uppercase tracking-widest ${isDark ? "text-zinc-400" : "text-zinc-400"}`}>Vista publica</p>
        <p className={`mt-0.5 text-lg font-black leading-tight ${isDark ? "text-white" : "text-zinc-900"}`}>{formatMoney(price)}</p>
        <p className={`text-[10px] font-bold ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>ARS / {days} dias</p>
      </div>
    </div>
  );
}

function PantallaAdmin({ showToast, scrollRef }) {
  const [remoteBuild, setRemoteBuild] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(null);
  const [adminTab, setAdminTab] = React.useState("dashboard");
  const [account, setAccount] = React.useState(null);
  const [accounts, setAccounts] = React.useState([]);
  const [settings, setSettings] = React.useState(DEFAULT_ADMIN_SETTINGS);
  const [invoices, setInvoices] = React.useState([]);
  const [tickets, setTickets] = React.useState([]);
  const [filterEstado, setFilterEstado] = React.useState("todos");
  const [expandedUid, setExpandedUid] = React.useState(null);
  const [accionando, setAccionando] = React.useState(null);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [accionandoOther, setAccionandoOther] = React.useState(null);
  const [settingsConfirmOpen, setSettingsConfirmOpen] = React.useState(false);
  const [ratings, setRatings] = React.useState([]);
  const [filterRating, setFilterRating] = React.useState("pendiente_validacion");
  const [usageSnapshots, setUsageSnapshots] = React.useState([]);
  const [mpPaymentId, setMpPaymentId] = React.useState("");
  const [mpUidOverride, setMpUidOverride] = React.useState("");
  const [mpPaymentDiag, setMpPaymentDiag] = React.useState(null);
  const user = auth.currentUser;
  const isPlatformAdmin =
    PLATFORM_ADMIN_EMAILS.includes((user?.email || "").toLowerCase()) ||
    PLATFORM_ADMIN_UIDS.includes(user?.uid || "");

  const cargar = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setLoading(true);
    setLoadError(null);
    try {
      await auth.currentUser.getIdToken(true);

      const adminData = await cargarPanelAdminDesdeServidor();
      const normalizedAccounts = (adminData.accounts || []).map((item) =>
        normalizeSaasUser(item, { uid: item.uid || item.id, email: item.email || "" }),
      );
      const mine = normalizedAccounts.find((item) => item.uid === uid) || {
        id: uid,
        uid,
        email: auth.currentUser?.email || "",
        estado: "trial",
        rol: isPlatformAdmin ? "admin" : "user",
        isPlatformAdmin,
        activoHasta: null,
        lastSeenAt: null,
      };
      setAccount(mine);
      setAccounts(normalizedAccounts);
      setInvoices(sortByDateDesc(adminData.invoices || [], "paidAt", "fecha", "createdAt", "updatedAt"));
      setTickets(sortByDateDesc(adminData.tickets || [], "createdAt", "updatedAt"));
      setUsageSnapshots(adminData.usageSnapshots || []);
      setSettings(normalizeAdminSettings(adminData.settings || DEFAULT_ADMIN_SETTINGS));
      const ratingSnap = await getDocsFromServer(
        query(collection(db, "ratings"), orderBy("createdAt", "desc"), limit(200))
      ).catch(() => ({ docs: [] }));
      setRatings(ratingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      setLoadError(`No se pudo cargar el panel administrador: ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
    // Fetch remote version silently for system health display
    fetchRemoteVersion().then(v => setRemoteBuild(v)).catch(() => {});
  };

  React.useEffect(() => { cargar(); }, []);

  const reconciliarCobros = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken?.();
      if (!idToken) throw new Error("No hay sesión");
      const res = await fetch("/api/mp-reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ days: 120, limit: 300 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo reconciliar");
      showToast(`Reconciliación MP: +${data.created} facturas (skip ${data.skipped}).`);
      cargar();
    } catch (e) {
      showToast(`No se pudo reconciliar: ${e?.message || String(e)}`);
    }
  };

  const reconciliarCobrosDesdeMP = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken?.();
      if (!idToken) throw new Error("No hay sesión");
      const uids = [
        ...stats.billingAlerts.activoSinFactura.map((a) => a.uid),
        ...stats.billingAlerts.pagoSinActivacion.map((a) => a.uid),
        ...stats.billingAlerts.vencidoConPagoReciente.map((a) => a.uid),
      ].filter(Boolean);
      if (!uids.length) {
        showToast("No hay cuentas para reconciliar desde Mercado Pago.");
        return;
      }

      const res = await fetch("/api/mp-reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ source: "mp", uids, days: 180 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo reconciliar con MP");
      showToast(`MP: +${data.created} facturas (scan ${data.scanned}).`);
      cargar();
    } catch (e) {
      showToast(`No se pudo reconciliar con MP: ${e?.message || String(e)}`);
    }
  };

  const importarPagoPorOperacion = async () => {
    try {
      const pid = String(mpPaymentId || "").trim();
      if (!pid) { showToast("Ingresá el N° de operación de Mercado Pago."); return; }
      const uidOverride = String(mpUidOverride || "").trim();
      if (uidOverride && uidOverride.length < 10) { showToast("El UID parece incompleto."); return; }
      const idToken = await auth.currentUser?.getIdToken?.();
      if (!idToken) throw new Error("No hay sesión");

      const res = await fetch("/api/mp-reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ source: "payment_id", paymentId: pid, uidOverride: uidOverride || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo importar el pago");

      const first = Array.isArray(data?.imported) ? data.imported[0] : null;
      const reason = String(first?.reason || "").trim();
      const reasonLabel = reason
        ? ({
            missing_uid: "sin UID",
            duplicate: "ya estaba importado (duplicado)",
            not_approved: "no está aprobado",
            dry_run: "modo prueba (dry run)",
          }[reason] || reason)
        : "";

      showToast(
        data.created > 0
          ? "Pago importado y registrado."
          : `No se importó${reasonLabel ? `: ${reasonLabel}` : " (duplicado/no aprobado/sin uid)."}`
      );
      setMpPaymentId("");
      setMpUidOverride("");
      setMpPaymentDiag(null);
      cargar();
    } catch (e) {
      showToast(`No se pudo importar: ${e?.message || String(e)}`);
    }
  };

  const diagnosticarPagoPorOperacion = async () => {
    try {
      const pid = String(mpPaymentId || "").trim();
      if (!pid) { showToast("Ingresá el N° de operación de Mercado Pago."); return; }
      const uidOverride = String(mpUidOverride || "").trim();
      if (uidOverride && uidOverride.length < 10) { showToast("El UID parece incompleto."); return; }
      const idToken = await auth.currentUser?.getIdToken?.();
      if (!idToken) throw new Error("No hay sesión");

      setMpPaymentDiag({ loading: true });
      const res = await fetch("/api/mp-reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ source: "payment_id_diagnose", paymentId: pid, uidOverride: uidOverride || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo diagnosticar el pago");
      setMpPaymentDiag({ loading: false, data });

      // Resumen corto en toast para no llenar pantalla
      const short = [
        data?.isApproved ? "aprobado" : String(data?.status || "sin estado"),
        data?.hasUidInMP ? "con uid" : "sin uid",
        data?.existingInvoicesCount ? `ya existe (${data.existingInvoicesCount})` : "no existe",
      ].join(" · ");
      showToast(`Diagnóstico MP: ${short}`);
    } catch (e) {
      setMpPaymentDiag(null);
      showToast(`No se pudo diagnosticar: ${e?.message || String(e)}`);
    }
  };

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
    const planPro  = accounts.filter(a => (a.currentPlanKey || a.plan) === "pro"  && a.estado === "activo").length;
    const planFull = accounts.filter(a => (a.currentPlanKey || a.plan) === "full" && a.estado === "activo").length;

    const accountByUid = new Map(accounts.map(a => [a.uid || a.id, a]));
    const getMercadoPagoPaymentId = (inv) => String(inv.paymentId || inv.mpPaymentId || inv.externalPaymentId || "").trim();
    const isMercadoPagoAprobado = (inv) => {
      const paymentId = getMercadoPagoPaymentId(inv);
      const hasRealPaymentId = /^\d+$/.test(paymentId);
      const status = String(inv.status || inv.estado || inv.mpStatus || inv.paymentStatus || "").toLowerCase();
      if (["pending", "in_process", "error", "failed", "failure", "rejected", "cancelled", "canceled"].includes(status)) return false;
      if (inv.errorText || inv.errorMessage || inv.blocked_by) return false;
      const statusOk = !status || ["approved", "paid", "accredited", "success", "ok"].includes(status);
      const provider = String(inv.provider || inv.proveedor || inv.source || inv.origen || "").toLowerCase();
      const providerOk = !provider || provider.includes("mercadopago") || provider.includes("mp") || provider.includes("webhook");
      return statusOk && providerOk && hasRealPaymentId && Number(inv.monto || inv.amountPaid || inv.amount || 0) > 0;
    };

    // Cobros reales: solo facturas confirmadas por Mercado Pago/webhook.
    const pagosDesdeInvoices = invoices
      .filter(isMercadoPagoAprobado)
      .map(inv => {
        const account = accountByUid.get(inv.uid || "");
        const paymentId = getMercadoPagoPaymentId(inv);
        return {
          id: inv.id,
          uid: inv.uid || "",
          email: inv.email || account?.email || "",
          monto: Number(inv.monto || inv.amountPaid || inv.amount || 0),
          fecha: normalizeDateMs(inv.fecha || inv.paidAt || inv.createdAt || inv.updatedAt) || 0,
          paymentId,
          plan: inv.plan || inv.planKey || account?.currentPlanKey || account?.plan || "base",
          status: inv.status || inv.estado || inv.mpStatus || "approved",
          origen: "Mercado Pago",
        };
      });

    // Deduplicar por paymentId
    const seen = new Set();
    const todosPagos = [...pagosDesdeInvoices]
      .filter(p => { if (seen.has(p.paymentId || p.id)) return false; seen.add(p.paymentId || p.id); return true; })
      .sort((a, b) => b.fecha - a.fecha);

    const totalCobrado = todosPagos.reduce((s, p) => s + p.monto, 0);
    const cobradoMes = todosPagos.filter(p => p.fecha >= mesInicioMs).reduce((s, p) => s + p.monto, 0);
    const pagosEsteMes = todosPagos.filter(p => p.fecha >= mesInicioMs).length;

    // Tiempo promedio trial ? pago (en días)
    const tiemposConversion = todosPagos
      .map(p => {
        const account = accountByUid.get(p.uid || "");
        const createdAt = normalizeDateMs(account?.createdAt);
        return createdAt && p.fecha ? (p.fecha - createdAt) / (1000 * 60 * 60 * 24) : null;
      })
      .filter(d => Number.isFinite(d) && d >= 0);
    const promDias = tiemposConversion.length > 0
      ? Math.round(tiemposConversion.reduce((s, d) => s + d, 0) / tiemposConversion.length)
      : null;

    const trialsPorVencer = accounts.filter(a => {
      const fin = normalizeDateMs(a.activoHasta || a.trialEndsAt);
      return a.estado === "trial" && fin && fin >= now && fin <= now + 5 * 24 * 60 * 60 * 1000;
    }).length;

    const pedidosPendientes = accounts.filter(a => a.requestedAction || a.cancelAtPeriodEnd).length;
    const reclamosPendientes = tickets.filter(t => t.estado !== "resuelto").length;
    const conversionRate = total > 0 ? Math.round(activos / total * 100) : 0;

    const latestUsageByUid = new Map();
    for (const snapshot of usageSnapshots) {
      const uid = snapshot.uid || snapshot.accountId || "";
      if (!uid) continue;
      const t = normalizeDateMs(snapshot.updatedAt || snapshot.createdAt) || new Date(snapshot.fecha || 0).getTime() || 0;
      const prev = latestUsageByUid.get(uid);
      const prevT = prev ? (normalizeDateMs(prev.updatedAt || prev.createdAt) || new Date(prev.fecha || 0).getTime() || 0) : 0;
      if (!prev || t >= prevT) latestUsageByUid.set(uid, snapshot);
    }
    const latestUsage = [...latestUsageByUid.values()];
    const freeUsageAlerts = latestUsage
      .map((snapshot) => {
        const account = accountByUid.get(snapshot.uid || snapshot.accountId || "");
        return { account, snapshot, status: getFreeUsageStatus(account, snapshot) };
      })
      .filter((item) => item.status.blocked || item.status.warnings.length > 0)
      .sort((a, b) => b.status.maxPercent - a.status.maxPercent);
    const estimatedInitialReads = latestUsage.reduce((sum, snapshot) => sum + Number(snapshot.estimatedInitialReads || 0), 0);

    // Billing alerts — computed from existing data (no extra Firestore reads)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const pagoSinActivacion = accounts.filter(a => {
      if (isPlatformAdminUser(a)) return false;
      const lastPago = normalizeDateMs(a.ultimoPago?.fecha);
      return lastPago && lastPago >= sevenDaysAgo && a.estado !== "activo";
    });
    const vencidoConPagoReciente = accounts.filter(a => {
      const lastPago = normalizeDateMs(a.ultimoPago?.fecha);
      return lastPago && lastPago >= sevenDaysAgo && ["vencido", "suspendido"].includes(a.estado);
    });
    const activoSinFactura = invoices.length > 0 ? accounts.filter(a => {
      if (a.estado !== "activo" || isPlatformAdminUser(a)) return false;
      return !todosPagos.some(p => p.uid === a.uid);
    }) : [];
    const billingAlerts = { pagoSinActivacion, vencidoConPagoReciente, activoSinFactura };
    const totalBillingAlerts = pagoSinActivacion.length + vencidoConPagoReciente.length;

    // System health
    const lastPayment = todosPagos[0] || null;
    const lastTicket = tickets[0] || null;
    const lastUser = accounts.reduce((best, a) => {
      const t = normalizeDateMs(a.createdAt);
      if (!t) return best;
      return !best || t > normalizeDateMs(best.createdAt) ? a : best;
    }, null);

    return {
      total, trial, activos, vencidos, admins, planBase, planPro, planFull,
      todosPagos, totalCobrado, cobradoMes, pagosEsteMes,
      promDias, trialsPorVencer, pedidosPendientes, reclamosPendientes,
      conversionRate, billingAlerts, totalBillingAlerts,
      latestUsage, freeUsageAlerts, estimatedInitialReads,
      lastPayment, lastTicket, lastUser,
    };
  }, [accounts, invoices, tickets, usageSnapshots]);

  const guardarSettings = async () => {
    try {
      validateAdminSettings(settings);
    } catch (validErr) {
      showToast(validErr.message);
      return;
    }
    setSavingSettings(true);
    const settingsBefore = { precios: settings.precios, planDurations: settings.planDurations, duracionTrialDias: settings.duracionTrialDias, graceDaysDefault: settings.graceDaysDefault };
    try {
      await guardarAdminSettings(settings, { uid: user?.uid || "", email: user?.email || "" });
      await logAdminAction({ action: "update_admin_settings", actorUid: user?.uid || "", actorEmail: user?.email || "", before: settingsBefore, after: { precios: settings.precios, planDurations: settings.planDurations, duracionTrialDias: settings.duracionTrialDias, graceDaysDefault: settings.graceDaysDefault }, reason: "Cambio manual desde panel admin" });
      showToast("Configuración guardada.");
      setSettingsConfirmOpen(false);
      cargar();
    } catch (error) {
      showToast("No se pudo guardar la configuración.");
    } finally {
      setSavingSettings(false);
    }
  };

  const resolverPedidoCuenta = async (item, patch, message) => {
    setAccionandoOther(`pedido-${item.uid}`);
    const before = { estado: item.estado, plan: item.currentPlanKey || item.plan, requestedAction: item.requestedAction };
    try {
      await actualizarSuscripcionUsuario(item.uid, {
        ...patch,
        requestedAction: null,
        requestedPlanKey: null,
        cancelAtPeriodEnd: false,
      });
      await logAdminAction({ action: "resolve_account_request", targetUid: item.uid, targetEmail: item.email || "", actorUid: user?.uid || "", actorEmail: user?.email || "", before, after: patch, reason: message });
      showToast(message);
      cargar();
    } catch (error) {
      showToast("No se pudo resolver el pedido.");
    } finally {
      setAccionandoOther(null);
    }
  };

  const resolverTicket = async (ticketId, ticket) => {
    setAccionandoOther(`ticket-${ticketId}`);
    try {
      await resolverTicketSoporte(ticketId);
      await logAdminAction({ action: "resolve_ticket", targetUid: ticket?.uid || "", targetEmail: ticket?.email || "", actorUid: user?.uid || "", actorEmail: user?.email || "", before: { estado: ticket?.estado || "nuevo" }, after: { estado: "resuelto" }, reason: "Marcado resuelto desde panel admin" });
      showToast("Reclamo marcado como resuelto.");
      cargar();
    } catch (error) {
      showToast("No se pudo resolver el reclamo.");
    } finally {
      setAccionandoOther(null);
    }
  };

  const activarUsuario = async (item, planKey = "base", extraDias = 30) => {
    try {
      validatePlanKey(planKey);
      validateExtraDays(extraDias);
    } catch (validErr) {
      showToast(validErr.message);
      return;
    }
    setAccionando(item.uid);
    const before = { estado: item.estado, plan: item.currentPlanKey || item.plan, activoHasta: item.activoHasta };
    const activoHasta = Date.now() + extraDias * 24 * 60 * 60 * 1000;
    try {
      await actualizarSuscripcionUsuario(item.uid, {
        estado: "activo",
        plan: planKey,
        currentPlanKey: planKey,
        pagoEstado: "pagado",
        activoHasta,
        requestedAction: null,
        cancelAtPeriodEnd: false,
      });
      await logAdminAction({ action: "activate_user", targetUid: item.uid, targetEmail: item.email || "", actorUid: user?.uid || "", actorEmail: user?.email || "", before, after: { estado: "activo", plan: planKey, activoHasta }, reason: `Activación manual ${extraDias} días` });
      showToast(`${item.email || item.uid} activado por ${extraDias} días.`);
      setExpandedUid(null);
      cargar();
    } catch (error) {
      showToast(`No se pudo activar: ${error.message}`);
    } finally {
      setAccionando(null);
    }
  };

  const activarUsuarioConPlan = (item, planKey) => {
    const dias = Number(settings?.planDurations?.[planKey] || settings?.plans?.[planKey]?.billingDays || 30);
    return activarUsuario(item, planKey, dias);
  };

  const extenderUsuario = async (item, dias = 30) => {
    try {
      validateExtraDays(dias);
    } catch (validErr) {
      showToast(validErr.message);
      return;
    }
    setAccionando(item.uid);
    const base = Math.max(Number(normalizeDateMs(item.activoHasta) || 0), Date.now());
    const activoHasta = base + dias * 24 * 60 * 60 * 1000;
    const before = { estado: item.estado, activoHasta: item.activoHasta };
    try {
      await actualizarSuscripcionUsuario(item.uid, { estado: "activo", activoHasta });
      await logAdminAction({ action: "extend_user", targetUid: item.uid, targetEmail: item.email || "", actorUid: user?.uid || "", actorEmail: user?.email || "", before, after: { estado: "activo", activoHasta }, reason: `Extensión manual +${dias} días` });
      showToast(`${item.email || item.uid} extendido ${dias} días.`);
      setExpandedUid(null);
      cargar();
    } catch (error) {
      showToast(`No se pudo extender: ${error.message}`);
    } finally {
      setAccionando(null);
    }
  };

  const suspenderUsuario = async (item) => {
    setAccionando(item.uid);
    const before = { estado: item.estado };
    try {
      await actualizarSuscripcionUsuario(item.uid, { estado: "suspendido" });
      await logAdminAction({ action: "suspend_user", targetUid: item.uid, targetEmail: item.email || "", actorUid: user?.uid || "", actorEmail: user?.email || "", before, after: { estado: "suspendido" }, reason: "Suspensión manual desde panel admin" });
      showToast(`${item.email || item.uid} suspendido.`);
      setExpandedUid(null);
      cargar();
    } catch (error) {
      showToast(`No se pudo suspender: ${error.message}`);
    } finally {
      setAccionando(null);
    }
  };

  if (loading) {
    return <Card><p className="text-sm font-black text-zinc-500 text-center py-4">Cargando panel admin...</p></Card>;
  }

  if (!(isPlatformAdmin || account?.isPlatformAdmin)) {
    return <Card><p className="text-sm font-black text-zinc-700">Este panel es solo para el administrador.</p></Card>;
  }

  const cuentasConPedidos = accounts.filter(a => a.requestedAction || a.cancelAtPeriodEnd);

  const usuariosFiltrados = filterEstado === "todos" ? accounts
    : filterEstado === "activos" ? accounts.filter(a => a.estado === "activo")
    : filterEstado === "trial" ? accounts.filter(a => a.estado === "trial")
    : filterEstado === "vencidos" ? accounts.filter(a => ["vencido","suspendido"].includes(a.estado))
    : accounts;

  const switchAdminTab = (id) => {
    setAdminTab(id);
    scrollRef?.current?.scrollTo({ top: 0 });
  };

  return (
    <div>
      {/* Panel header */}
      <div className="mb-4 px-1">
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Panel administrador</p>
        <p className="text-[10px] font-bold text-zinc-600 mt-0.5">Control de usuarios, pagos, suscripciones, reclamos y operación de Moto Gestión.</p>
      </div>

      {/* Error de carga — muestra detalles y botón de reintento */}
      {loadError && (
        <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
          <p className="text-[9px] font-black text-red-600 uppercase tracking-widest">Error de carga</p>
          <p className="text-sm font-bold text-red-800 break-all">{loadError}</p>
          <button onClick={cargar} className="mt-1 rounded-2xl bg-red-600 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest active:scale-95">Reintentar</button>
        </div>
      )}

      {/* Sub-navegación — sticky */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 mb-4 bg-zinc-950/95 backdrop-blur-sm border-b border-white/5">
        <div className="flex gap-2 overflow-x-auto">
          {ADMIN_TABS.map(t => (
            <button key={t.id} onClick={() => switchAdminTab(t.id)}
              className={`shrink-0 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                adminTab === t.id ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400 active:scale-95"
              }`}
            >
              {t.label}
              {t.id === "consultas" && (stats.pedidosPendientes + stats.reclamosPendientes) > 0 && (
                <span className="ml-1.5 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[8px]">
                  {stats.pedidosPendientes + stats.reclamosPendientes}
                </span>
              )}
              {t.id === "cobros" && stats.totalBillingAlerts > 0 && (
                <span className="ml-1.5 bg-red-500 text-white rounded-full px-1.5 py-0.5 text-[8px]">
                  {stats.totalBillingAlerts}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* -- DASHBOARD -- */}
      {adminTab === "dashboard" && (
        <div className="space-y-4">
          {/* Estado comercial */}
          <Card>
            <SectionTitle>Estado comercial</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 col-span-2">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Cobrado este mes</p>
                <MoneyValue amount={stats.cobradoMes} />
                <p className="text-[10px] font-bold text-emerald-500 mt-1">{stats.pagosEsteMes} {stats.pagosEsteMes === 1 ? "pago" : "pagos"} recibidos</p>
                <button
                  type="button"
                  onClick={reconciliarCobros}
                  className="mt-3 w-full rounded-2xl bg-emerald-600 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
                >
                  Reconciliar cobros MP
                </button>
                <button
                  type="button"
                  onClick={reconciliarCobrosDesdeMP}
                  className="mt-2 w-full rounded-2xl bg-zinc-900 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
                >
                  Buscar pagos en MP (fallback)
                </button>
                <div className="mt-3 rounded-2xl border border-emerald-200 bg-white/80 p-3">
                  <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 mb-2">Importar por N° de operación</p>
                  <div className="flex gap-2">
                    <input
                      value={mpPaymentId}
                      onChange={(e) => setMpPaymentId(e.target.value)}
                      inputMode="numeric"
                      placeholder="Ej: 160809033407"
                      className="flex-1 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-bold text-zinc-900 outline-none focus:border-emerald-500"
                    />
                    <div className="shrink-0 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={importarPagoPorOperacion}
                        className="rounded-2xl bg-emerald-700 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
                      >
                        Importar
                      </button>
                      <button
                        type="button"
                        onClick={diagnosticarPagoPorOperacion}
                        className="rounded-2xl bg-zinc-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
                      >
                        Diagnosticar
                      </button>
                    </div>
                  </div>
                  <input
                    value={mpUidOverride}
                    onChange={(e) => setMpUidOverride(e.target.value)}
                    placeholder="UID (solo si MP no lo trae)"
                    className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-[11px] font-bold text-zinc-800 outline-none focus:border-emerald-500"
                  />

                  {mpPaymentDiag?.loading && (
                    <div className="mt-2 rounded-2xl border border-emerald-200 bg-white/80 p-3">
                      <p className="text-[10px] font-black text-emerald-800/80 uppercase tracking-widest">Diagnóstico</p>
                      <p className="mt-1 text-xs font-bold text-zinc-700">Consultando Mercado Pago...</p>
                    </div>
                  )}

                  {!mpPaymentDiag?.loading && mpPaymentDiag?.data && (
                    <div className="mt-2 rounded-2xl border border-emerald-200 bg-white/80 p-3 space-y-2">
                      <p className="text-[10px] font-black text-emerald-800/80 uppercase tracking-widest">Diagnóstico</p>
                      <div className="text-[11px] font-bold text-zinc-800 space-y-1">
                        <p>Estado MP: <span className="font-black">{mpPaymentDiag.data.status || "?"}</span>{mpPaymentDiag.data.statusDetail ? ` (${mpPaymentDiag.data.statusDetail})` : ""}</p>
                        <p>UID en MP: <span className="font-black">{mpPaymentDiag.data.hasUidInMP ? "sí" : "no"}</span></p>
                        <p>external_reference: <span className="font-mono">{mpPaymentDiag.data.mpExternalReference || "—"}</span></p>
                        <p>metadata.uid: <span className="font-mono">{mpPaymentDiag.data.mpUid || "—"}</span></p>
                        <p>UID candidato: <span className="font-mono">{mpPaymentDiag.data.candidateUid || "—"}</span></p>
                        <p>¿Ya existe en Firestore?: <span className="font-black">{mpPaymentDiag.data.existingInvoicesCount ? `sí (${mpPaymentDiag.data.existingInvoicesCount})` : "no"}</span></p>
                      </div>
                      {Array.isArray(mpPaymentDiag.data.existingInvoices) && mpPaymentDiag.data.existingInvoices.length > 0 && (
                        <div className="rounded-xl border border-zinc-200 bg-white p-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Coincidencias encontradas</p>
                          <div className="space-y-2">
                            {mpPaymentDiag.data.existingInvoices.map((inv, idx) => (
                              <div key={idx} className="text-[11px] font-bold text-zinc-800">
                                <p>UID: <span className="font-mono">{inv.uid || "?"}</span></p>
                                <p>Monto: <span className="font-black">ARS {new Intl.NumberFormat("es-AR").format(Number(inv.monto || 0))}</span> · Plan: <span className="font-black">{inv.plan || "?"}</span></p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setMpPaymentDiag(null)}
                        className="w-full rounded-2xl bg-zinc-100 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-700 active:scale-95 transition-all"
                      >
                        Cerrar diagnóstico
                      </button>
                    </div>
                  )}
                  <p className="mt-2 text-[10px] font-bold text-emerald-800/70">
                    Usalo cuando el pago fue aprobado pero no aparece en “Cobros”.
                  </p>
                </div>
              </div>
              <StatBox label="Total cobrado" value={<MoneyValue amount={stats.totalCobrado} />} />
              <StatBox label="Tiempo promedio a pagar" value={stats.promDias !== null ? `${stats.promDias} días` : "—"} />
              <StatBox label="Tasa de conversión" value={`${stats.conversionRate}%`} color="text-orange-600" />
              <StatBox label="Total de pagos" value={stats.todosPagos.length} />
            </div>
          </Card>

          {/* Usuarios */}
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
            <SectionTitle>Uso real y limites free</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Usuarios medidos" value={stats.latestUsage.length} />
              <StatBox label="Lecturas inicio est." value={stats.estimatedInitialReads} color="text-orange-600" />
              <StatBox label="Free en alerta" value={stats.freeUsageAlerts.length} color={stats.freeUsageAlerts.length ? "text-red-600" : "text-emerald-600"} />
              <StatBox label="Limite trabajos" value={FREE_PLAN_LIMITS.trabajosTotal} />
            </div>
            <p className="mt-3 text-[10px] font-bold leading-relaxed text-zinc-400">
              Estimacion basada en documentos reales del taller. Sirve para controlar Firestore antes de abrir mas usuarios.
            </p>
            {stats.freeUsageAlerts.length > 0 && (
              <div className="mt-3 space-y-2">
                {stats.freeUsageAlerts.slice(0, 5).map(({ account: usageAccount, snapshot, status }) => (
                  <div key={snapshot.id || snapshot.uid} className="rounded-2xl border border-amber-100 bg-amber-50 p-3">
                    <p className="text-xs font-black text-amber-900 truncate">{usageAccount?.email || snapshot.email || snapshot.uid}</p>
                    <p className="mt-1 text-[10px] font-bold text-amber-700">
                      {status.blocked ? "Bloqueado por limite free" : "Cerca del limite free"} · {status.maxPercent}%
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Alertas operativas */}
          <Card>
            <SectionTitle>Alertas operativas</SectionTitle>
            <div className="space-y-2">
              {stats.billingAlerts.pagoSinActivacion.length > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm font-black text-red-700">Pago reciente sin activación</p>
                  <p className="text-lg font-black text-red-700">{stats.billingAlerts.pagoSinActivacion.length}</p>
                </div>
              )}
              {stats.billingAlerts.vencidoConPagoReciente.length > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
                  <p className="text-sm font-black text-red-700">Vencido con pago reciente</p>
                  <p className="text-lg font-black text-red-700">{stats.billingAlerts.vencidoConPagoReciente.length}</p>
                </div>
              )}
              {stats.billingAlerts.activoSinFactura.length > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-sm font-black text-amber-700">Activo sin factura registrada</p>
                  <p className="text-lg font-black text-amber-700">{stats.billingAlerts.activoSinFactura.length}</p>
                </div>
              )}
              {stats.trialsPorVencer > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-100 px-4 py-3">
                  <p className="text-sm font-black text-amber-700">Trials por vencer en 5 días</p>
                  <p className="text-lg font-black text-amber-700">{stats.trialsPorVencer}</p>
                </div>
              )}
              {stats.pedidosPendientes > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-orange-50 border border-orange-100 px-4 py-3">
                  <p className="text-sm font-black text-orange-700">Pedidos pendientes</p>
                  <p className="text-lg font-black text-orange-700">{stats.pedidosPendientes}</p>
                </div>
              )}
              {stats.reclamosPendientes > 0 && (
                <div className="flex items-center justify-between rounded-2xl bg-red-50 border border-red-100 px-4 py-3">
                  <p className="text-sm font-black text-red-700">Reclamos sin resolver</p>
                  <p className="text-lg font-black text-red-700">{stats.reclamosPendientes}</p>
                </div>
              )}
              {stats.billingAlerts.pagoSinActivacion.length === 0 && stats.billingAlerts.vencidoConPagoReciente.length === 0 && stats.trialsPorVencer === 0 && stats.pedidosPendientes === 0 && stats.reclamosPendientes === 0 && (
                <p className="text-sm font-black text-zinc-500 text-center py-2">Sin alertas activas.</p>
              )}
            </div>
          </Card>

          {/* Estado del sistema */}
          <Card>
            <SectionTitle>Estado del sistema</SectionTitle>
            <div className="space-y-2">
              {[
                { label: "Último deploy detectado", value: remoteBuild?.buildTime ? new Date(remoteBuild.buildTime).toLocaleString("es-AR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Sin dato" },
                { label: "Último pago registrado", value: stats.lastPayment ? new Date(stats.lastPayment.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) + " — " + (stats.lastPayment.email || stats.lastPayment.uid || "?") : "Sin pagos" },
                { label: "Último usuario registrado", value: stats.lastUser ? (stats.lastUser.email || stats.lastUser.uid) : "Sin dato" },
                { label: "Último reclamo", value: stats.lastTicket ? (stats.lastTicket.email || stats.lastTicket.uid || "?") + " — " + (stats.lastTicket.estado || "nuevo") : "Sin reclamos" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start justify-between gap-4 py-2 border-b border-zinc-100 last:border-0">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest shrink-0">{label}</p>
                  <p className="text-[10px] font-bold text-zinc-700 text-right">{value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Distribución de planes */}
          <Card>
            <SectionTitle>Distribución de planes</SectionTitle>
            <div className="grid grid-cols-3 gap-3">
              <StatBox label="Base" value={stats.planBase} />
              <StatBox label="Pro" value={stats.planPro} color="text-orange-600" />
              <StatBox label="Full" value={stats.planFull} color="text-zinc-800" />
            </div>
          </Card>
        </div>
      )}

      {/* -- PLANES -- */}
      {adminTab === "planes" && (
        <div className="space-y-4">

          {/* Email de notificaciones */}
          <Card>
            <SectionTitle>Correo de notificaciones</SectionTitle>
            <p className="text-[11px] font-bold text-zinc-500 mb-3">Correo donde llegan los avisos del sistema (nuevos usuarios, pagos, alertas).</p>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Email del administrador</label>
            <input
              type="email"
              value={settings.notificationEmail || ""}
              onChange={e => setSettings(p => ({ ...p, notificationEmail: e.target.value }))}
              className="w-full border-2 border-zinc-100 rounded-2xl px-4 py-3 font-bold text-sm text-zinc-800 bg-zinc-50 outline-none focus:border-orange-500 transition-colors"
              placeholder="matias4604@gmail.com"
            />
          </Card>

          <Card>
            <SectionTitle>Precios y duracion</SectionTitle>
            <p className="text-[11px] font-bold text-zinc-500 mb-4">Los cambios aplican a nuevos pagos y se reflejan tambien en la landing.</p>
            <div className="space-y-3">
              <AdminPlanPriceBlock planKey="base" label="Mensual" tone="zinc" settings={settings} setSettings={setSettings} />
              <AdminPlanPriceBlock planKey="pro" label="Trimestral" tone="orange" settings={settings} setSettings={setSettings} />
              <AdminPlanPriceBlock planKey="full" label="Anual" tone="dark" settings={settings} setSettings={setSettings} />
            </div>
          </Card>

          <Card>
            <SectionTitle>Periodos</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Dias de prueba (trial)</p>
                <p className="text-[10px] font-bold text-zinc-500 mt-1">Acceso gratis al registrarse.</p>
                <input
                  type="text" inputMode="numeric"
                  value={String(settings.duracionTrialDias || 14)}
                  onChange={e => setSettings(p => ({ ...p, duracionTrialDias: Number(e.target.value.replace(/\D/g,"") || 14) }))}
                  className="mt-3 w-full bg-transparent text-2xl font-black text-zinc-800 outline-none"
                />
              </div>
              <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Dias de gracia</p>
                <p className="text-[10px] font-bold text-zinc-500 mt-1">Extra tras vencimiento antes de bloquear.</p>
                <input
                  type="text" inputMode="numeric"
                  value={String(settings.graceDaysDefault || 3)}
                  onChange={e => setSettings(p => ({ ...p, graceDaysDefault: Number(e.target.value.replace(/\D/g,"") || 3) }))}
                  className="mt-3 w-full bg-transparent text-2xl font-black text-zinc-800 outline-none"
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
                  className={`rounded-2xl border px-3 py-3 text-left transition-all ${value ? "border-orange-200 bg-orange-50 text-orange-700" : "border-zinc-200 bg-zinc-50 text-zinc-500"}`}
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
                <p className="text-sm font-black text-zinc-800">Solo cuentas nuevas</p>
                <p className="text-[10px] font-bold text-zinc-400 mt-0.5">Si esta apagado, afecta a todos al renovar.</p>
              </div>
              <button
                onClick={() => setSettings(p => ({ ...p, applyPricingToNewAccountsOnly: !p.applyPricingToNewAccountsOnly }))}
                className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest ${settings.applyPricingToNewAccountsOnly !== false ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-700"}`}
              >
                {settings.applyPricingToNewAccountsOnly !== false ? "Si" : "No"}
              </button>
            </div>
          </Card>

          {settingsConfirmOpen && (
            <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
              <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm space-y-4 shadow-2xl">
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Confirmar cambios</p>
                <p className="text-sm font-black text-zinc-900 leading-snug">Los cambios de precios y períodos afectarán a nuevas cuentas y futuros pagos. Los cambios de funciones se aplican de forma inmediata.</p>
                <p className="text-[10px] font-bold text-zinc-500">Verificá que los valores sean correctos antes de guardar.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setSettingsConfirmOpen(false)} className="bg-zinc-100 text-zinc-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95">Cancelar</button>
                  <button onClick={guardarSettings} disabled={savingSettings} className="bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 disabled:opacity-50">
                    {savingSettings ? "Guardando..." : "Confirmar"}
                  </button>
                </div>
              </div>
            </div>
          )}
          <button onClick={() => setSettingsConfirmOpen(true)} disabled={savingSettings} className="w-full rounded-2xl bg-orange-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50">
            {savingSettings ? "Guardando..." : "Guardar todos los cambios"}
          </button>
        </div>
      )}

      {/* -- USUARIOS -- */}
      {adminTab === "usuarios" && (
        <div className="space-y-4">
          {/* Filtros — sticky debajo de la sub-nav */}
          <div className="sticky top-[53px] z-[9] -mx-4 px-4 py-2 bg-zinc-950/95 backdrop-blur-sm border-b border-white/5 flex gap-2 overflow-x-auto">
            {[
              { id: "todos", label: `Todos (${stats.total})` },
              { id: "activos", label: `Activos (${stats.activos})` },
              { id: "trial", label: `Trial (${stats.trial})` },
              { id: "vencidos", label: `Vencidos (${stats.vencidos})` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilterEstado(f.id)}
                className={`shrink-0 px-3 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest ${filterEstado === f.id ? "bg-white text-zinc-900" : "bg-zinc-800 text-zinc-400"}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {usuariosFiltrados.length === 0 && (
              <Card>
                <p className="text-sm font-black text-zinc-500">
                  {loadError ? "No se pudieron cargar los usuarios. Ver error arriba." : "No hay usuarios en este filtro."}
                </p>
                {!loadError && <button onClick={cargar} className="mt-2 rounded-2xl bg-zinc-900 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest active:scale-95">Recargar</button>}
              </Card>
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
                <div key={item.uid || item.id} className="rounded-2xl border border-zinc-100 bg-white overflow-hidden">
                  <button
                    onClick={() => setExpandedUid(isExpanded ? null : (item.uid || item.id))}
                    className="w-full flex items-center gap-3 p-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-zinc-800 truncate">{item.email || item.uid}</p>
                      <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                        {item.currentPlanKey || item.plan || "base"} · hasta {vigenciaStr}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[9px] font-black uppercase tracking-widest border rounded-xl px-2 py-1 ${estadoColor}`}>
                      {item.estado || "trial"}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-100 p-4 bg-zinc-50 space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-zinc-500">
                        <div>UID: <span className="text-zinc-700 font-bold text-[9px] break-all">{item.uid || item.id}</span></div>
                        <div>Pago: <span className="text-zinc-700">{item.pagoEstado || "pendiente"}</span></div>
                        {item.ultimoPago?.fecha && (
                          <>
                            <div>Ultimo pago: <span className="text-zinc-700">{new Date(item.ultimoPago.fecha).toLocaleDateString("es-AR")}</span></div>
                            <div>Monto: <span className="text-emerald-700">{formatMoney(item.ultimoPago.monto || 0)}</span></div>
                            <div className="col-span-2">ID MP: <span className="text-zinc-700 font-bold text-[9px]">{item.ultimoPago.paymentId || "—"}</span></div>
                          </>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          disabled={accionando === item.uid}
                          onClick={() => activarUsuarioConPlan(item, "base")}
                          className="rounded-2xl bg-emerald-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                        >
                          {accionando === item.uid ? "..." : "Activar Mensual"}
                        </button>
                        <button
                          disabled={accionando === item.uid}
                          onClick={() => activarUsuarioConPlan(item, "pro")}
                          className="rounded-2xl bg-orange-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                        >
                          Activar Trimestral
                        </button>
                        <button
                          disabled={accionando === item.uid}
                          onClick={() => activarUsuarioConPlan(item, "full")}
                          className="rounded-2xl bg-zinc-800 py-3 text-[10px] font-black uppercase tracking-widest text-white col-span-2 disabled:opacity-50"
                        >
                          Activar Anual
                        </button>
                        <button
                          disabled={accionando === item.uid}
                          onClick={() => extenderUsuario(item, 30)}
                          className="rounded-2xl bg-zinc-900 py-3 text-[10px] font-black uppercase tracking-widest text-white col-span-2 disabled:opacity-50"
                        >
                          Extender +30 días
                        </button>
                        {item.estado !== "suspendido" && (
                          <button
                            disabled={accionando === item.uid}
                            onClick={() => suspenderUsuario(item)}
                            className="rounded-2xl border border-red-200 bg-red-50 py-3 text-[10px] font-black uppercase tracking-widest text-red-600 col-span-2 disabled:opacity-50"
                          >
                            Suspender usuario
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* -- COBROS -- */}
      {adminTab === "cobros" && (
        <div className="space-y-4">
          <Card>
            <SectionTitle>Resumen de ingresos</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 col-span-2">
                <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Total cobrado</p>
                <MoneyValue amount={stats.totalCobrado} />
              </div>
              <StatBox label="Cobrado este mes" value={<MoneyValue amount={stats.cobradoMes} />} color="text-emerald-600" />
              <StatBox label="Pagos este mes" value={stats.pagosEsteMes} />
              <StatBox label="Total de pagos" value={stats.todosPagos.length} />
              <StatBox label="Tiempo prom. a pagar" value={stats.promDias !== null ? `${stats.promDias}d` : "—"} />
            </div>
          </Card>

          <Card>
            <SectionTitle>Historial de pagos</SectionTitle>
            <p className="mb-3 text-[10px] font-bold leading-relaxed text-zinc-400">
              Solo se listan cobros aprobados por Mercado Pago con ID numerico real. Cambios manuales de plan, preferencias, intentos pendientes, rechazados o con error no se suman a la caja.
            </p>
            {stats.todosPagos.length === 0 && (
              <p className="text-sm font-black text-zinc-500">No hay pagos registrados todavía.</p>
            )}
            <div className="space-y-2">
              {stats.todosPagos.map(pago => (
                <div key={pago.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-zinc-800 truncate">{pago.email || pago.uid}</p>
                      <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                        {pago.fecha ? new Date(pago.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" }) : "Sin fecha"}
                        {" · "}Plan {pago.plan || "base"}{" · "}{pago.origen || "Mercado Pago"}
                      </p>
                      {pago.paymentId && (
                        <p className="text-[9px] font-bold text-zinc-400 mt-0.5 break-all">MP: {pago.paymentId}</p>
                      )}
                      <p className="text-[9px] font-bold text-zinc-400 mt-0.5 break-all">UID: {pago.uid}</p>
                    </div>
                    <p className="text-base font-black text-emerald-600 shrink-0">{formatMoney(pago.monto)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Alertas de facturación */}
          {(stats.billingAlerts.pagoSinActivacion.length > 0 || stats.billingAlerts.vencidoConPagoReciente.length > 0 || stats.billingAlerts.activoSinFactura.length > 0) && (
            <Card>
              <SectionTitle>Alertas de facturación</SectionTitle>
              <p className="text-[10px] font-bold text-zinc-400 mb-3">Inconsistencias detectadas en los últimos 7 días.</p>
              {stats.billingAlerts.pagoSinActivacion.map(a => (
                <div key={a.uid} className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-2">
                  <p className="text-[9px] font-black text-red-600 uppercase tracking-widest">Pago reciente sin activación</p>
                  <p className="text-sm font-black text-red-900 mt-1">{a.email || a.uid}</p>
                  <p className="text-[10px] font-bold text-red-700">Estado: {a.estado} · Pago: {formatMoney(a.ultimoPago?.monto || 0)}</p>
                  <button onClick={() => activarUsuarioConPlan(a, a.currentPlanKey || a.plan || "base")} disabled={accionando === a.uid} className="mt-2 w-full rounded-2xl bg-emerald-600 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50">
                    {accionando === a.uid ? "Procesando..." : "Activar manualmente"}
                  </button>
                </div>
              ))}
              {stats.billingAlerts.vencidoConPagoReciente.map(a => (
                <div key={a.uid} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 mb-2">
                  <p className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Vencido con pago reciente</p>
                  <p className="text-sm font-black text-amber-900 mt-1">{a.email || a.uid}</p>
                  <p className="text-[10px] font-bold text-amber-700">Estado: {a.estado} · Último pago: {formatMoney(a.ultimoPago?.monto || 0)}</p>
                  <button onClick={() => activarUsuarioConPlan(a, a.currentPlanKey || a.plan || "base")} disabled={accionando === a.uid} className="mt-2 w-full rounded-2xl bg-orange-600 py-2 text-[10px] font-black uppercase text-white disabled:opacity-50">
                    {accionando === a.uid ? "Procesando..." : "Reactivar usuario"}
                  </button>
                </div>
              ))}
              {stats.billingAlerts.activoSinFactura.map(a => (
                <div key={a.uid} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 mb-2">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Activo sin factura registrada</p>
                  <p className="text-sm font-black text-zinc-800 mt-1">{a.email || a.uid}</p>
                  <p className="text-[10px] font-bold text-zinc-500">Puede ser activación manual. Verificar con auditoría.</p>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* -- CONSULTAS -- */}
      {adminTab === "consultas" && (
        <div className="space-y-4">
          <Card>
            <SectionTitle>Pedidos de usuarios</SectionTitle>
            {cuentasConPedidos.length === 0 && (
              <p className="text-sm font-black text-zinc-500">No hay pedidos pendientes.</p>
            )}
            <div className="space-y-3">
              {cuentasConPedidos.map(item => (
                <div key={item.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-zinc-800">{item.email || item.uid}</p>
                      <p className="text-[10px] font-bold text-zinc-500 mt-0.5">UID: {item.uid}</p>
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-orange-600 shrink-0">{formatRequestedAction(item)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => resolverPedidoCuenta(item, { estado: "activo", currentPlanKey: item.requestedPlanKey || item.currentPlanKey || "base" }, "Pedido aprobado.")}
                      disabled={accionandoOther === `pedido-${item.uid}`}
                      className="rounded-2xl bg-emerald-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                    >
                      {accionandoOther === `pedido-${item.uid}` ? "..." : "Aprobar"}
                    </button>
                    <button
                      onClick={() => resolverPedidoCuenta(item, {}, "Pedido rechazado.")}
                      disabled={accionandoOther === `pedido-${item.uid}`}
                      className="rounded-2xl bg-zinc-900 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
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
            {tickets.length === 0 && <p className="text-sm font-black text-zinc-500">No hay reclamos.</p>}
            <div className="space-y-3">
              {tickets.map(ticket => (
                <div key={ticket.id} className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-zinc-800 truncate">{ticket.email || ticket.uid}</p>
                      <p className="text-[10px] font-bold text-zinc-500 mt-0.5">UID: {ticket.uid}</p>
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-widest border rounded-xl px-2 py-1 shrink-0 ${ticket.estado === "resuelto" ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-red-50 border-red-100 text-red-600"}`}>
                      {ticket.estado || "nuevo"}
                    </span>
                  </div>
                  <p className="text-xs font-bold leading-relaxed text-zinc-700">{ticket.mensaje || "Sin mensaje"}</p>
                  <p className="text-[9px] font-bold text-zinc-400">{formatAdminDate(ticket.createdAt, "Fecha desconocida")}</p>
                  <button
                    onClick={() => resolverTicket(ticket.id, ticket)}
                    disabled={ticket.estado === "resuelto" || accionandoOther === `ticket-${ticket.id}`}
                    className="w-full rounded-2xl bg-orange-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
                  >
                    {accionandoOther === `ticket-${ticket.id}` ? "Procesando..." : ticket.estado === "resuelto" ? "Ya resuelto" : "Marcar como resuelto"}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Calificaciones */}
      {adminTab === "calificaciones" && (() => {
        const FILTER_TABS = [
          { id: "pendiente_validacion", label: "Pendientes" },
          { id: "aprobado",             label: "Aprobadas" },
          { id: "rechazado",            label: "Rechazadas" },
          { id: "todas",                label: "Todas" },
        ];
        const shown = filterRating === "todas"
          ? ratings
          : ratings.filter(r => (r.status || "pendiente_validacion") === filterRating);

        const moderarRating = async (ratingId, decision) => {
          const key = `mod-${ratingId}`;
          setAccionandoOther(key);
          try {
            const token = await auth.currentUser.getIdToken(true);
            const res = await fetch("/api/moderate-rating", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ ratingId, decision }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al moderar");
            setRatings(prev => prev.map(r => r.id === ratingId ? { ...r, status: data.status, reputationWeight: data.reputationWeight } : r));
            showToast(decision === "aprobar" ? "Calificacion aprobada" : "Calificacion rechazada");
          } catch (err) {
            showToast(err.message || "No se pudo moderar");
          } finally {
            setAccionandoOther(null);
          }
        };

        return (
          <div className="space-y-3">
            <Card>
              <SectionTitle>Moderar calificaciones</SectionTitle>
              <div className="flex gap-2 flex-wrap">
                {FILTER_TABS.map(ft => (
                  <button
                    key={ft.id}
                    onClick={() => setFilterRating(ft.id)}
                    className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${filterRating === ft.id ? "bg-orange-600 text-white" : "bg-zinc-100 text-zinc-500"}`}
                  >
                    {ft.label}
                    {ft.id !== "todas" && (
                      <span className="ml-1 opacity-60">
                        ({ratings.filter(r => (r.status || "pendiente_validacion") === ft.id).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </Card>
            {shown.length === 0 && (
              <div className="text-center text-xs font-bold text-zinc-400 py-8">Sin calificaciones en esta categoria</div>
            )}
            {shown.map(r => {
              const score = [r.scoreAtencion, r.scoreClaridad, r.scoreTrabajo, r.scoreCumplimiento].filter(Boolean);
              const avg = score.length ? (score.reduce((a, b) => a + b, 0) / score.length).toFixed(1) : null;
              const statusColor = r.status === "aprobado" ? "text-green-600 bg-green-50" : r.status === "rechazado" ? "text-red-500 bg-red-50" : "text-orange-600 bg-orange-50";
              const isMod = accionandoOther === `mod-${r.id}`;
              return (
                <Card key={r.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-xl ${statusColor}`}>
                      {r.status || "pendiente_validacion"}
                    </span>
                    {avg && <span className="text-xs font-black text-orange-600">{avg} / 5</span>}
                  </div>
                  <p className="text-[10px] font-bold text-zinc-500 mb-1">
                    Taller: {r.uidTaller?.slice(0, 8)}... · {r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-AR") : "?"}
                  </p>
                  {r.comentario && (
                    <p className="text-xs font-bold text-zinc-700 italic mb-2 leading-relaxed">"{r.comentario}"</p>
                  )}
                  <div className="flex gap-2 text-[9px] font-black text-zinc-400 mb-3">
                    {r.scoreAtencion && <span>Aten: {r.scoreAtencion}</span>}
                    {r.scoreClaridad && <span>Clar: {r.scoreClaridad}</span>}
                    {r.scoreTrabajo && <span>Trab: {r.scoreTrabajo}</span>}
                    {r.scoreCumplimiento && <span>Plazo: {r.scoreCumplimiento}</span>}
                    {r.recomienda !== undefined && <span>{r.recomienda ? "Recomienda" : "No recomienda"}</span>}
                  </div>
                  {(r.status || "pendiente_validacion") === "pendiente_validacion" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => moderarRating(r.id, "aprobar")}
                        disabled={isMod}
                        className="flex-1 rounded-2xl bg-green-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
                      >
                        {isMod ? "..." : "Aprobar"}
                      </button>
                      <button
                        onClick={() => moderarRating(r.id, "rechazar")}
                        disabled={isMod}
                        className="flex-1 rounded-2xl bg-red-600 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-40"
                      >
                        {isMod ? "..." : "Rechazar"}
                      </button>
                    </div>
                  )}
                  {r.moderationReason && (
                    <p className="text-[9px] font-bold text-zinc-400 mt-2">Motivo: {r.moderationReason}</p>
                  )}
                </Card>
              );
            })}
          </div>
        );
      })()}

      {/* Botón actualizar */}
      <button onClick={cargar} className="w-full mt-2 rounded-2xl bg-zinc-100 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 active:scale-95">
        Actualizar datos
      </button>
    </div>
  );
}

// PANTALLA: Resumen

export { PantallaAdmin };
