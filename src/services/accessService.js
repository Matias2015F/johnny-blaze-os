import { db } from "../firebase.js";
import { doc, getDoc } from "firebase/firestore";
import { DEFAULT_ADMIN_SETTINGS } from "../lib/telemetry.js";

export function normalizeDateMs(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
  }
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

export function resolveAccountAccess(account) {
  if (!account) return { acceso: false, motivo: "sin_cuenta" };

  const ahora = Date.now();
  const plan = String(account.plan || "trial").toLowerCase();
  const pagoEstado = String(account.pagoEstado || "pendiente").toLowerCase();
  const trialEndsAt = normalizeDateMs(account.trialEndsAt);
  const graceEndsAt = normalizeDateMs(account.graceEndsAt);
  const nextBillingAt = normalizeDateMs(account.nextBillingAt);

  if (account.isPlatformAdmin) {
    return { acceso: true, motivo: "admin", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
  }

  if (plan === "suspendido") {
    return { acceso: false, motivo: "suspendido", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
  }

  if (plan === "trial") {
    if (trialEndsAt && trialEndsAt > ahora) {
      return { acceso: true, motivo: "trial", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
    }
    if (graceEndsAt && graceEndsAt > ahora) {
      return { acceso: true, motivo: "gracia", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
    }
    return { acceso: false, motivo: "trial_vencido", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
  }

  if (plan === "activo" || plan === "base" || plan === "pro") {
    if (pagoEstado === "pagado") {
      return { acceso: true, motivo: "activo", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
    }
    if (nextBillingAt && nextBillingAt > ahora) {
      return { acceso: true, motivo: "vigente", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
    }
    if (graceEndsAt && graceEndsAt > ahora) {
      return { acceso: true, motivo: "gracia_pago", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
    }
    return { acceso: false, motivo: "plan_vencido", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
  }

  return { acceso: false, motivo: "sin_permisos", plan, pagoEstado, trialEndsAt, graceEndsAt, nextBillingAt };
}

export async function validarAcceso(uid) {
  const snap = await getDoc(doc(db, "accounts", uid));
  if (!snap.exists()) return { acceso: false, motivo: "sin_cuenta" };
  return resolveAccountAccess(snap.data());
}

export async function leerAdminSettings() {
  const snap = await getDoc(doc(db, "adminSettings", "global"));
  return snap.exists()
    ? { ...DEFAULT_ADMIN_SETTINGS, ...snap.data() }
    : DEFAULT_ADMIN_SETTINGS;
}
