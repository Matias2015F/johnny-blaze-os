import { db } from "../firebase.js";
import { addDoc, collection, doc, getDoc, getDocFromServer, setDoc, serverTimestamp } from "firebase/firestore";

export const SAAS_COLLECTIONS = {
  usuarios: "usuarios",
  adminSettings: "admin_settings",
  soporteTickets: "soporteTickets",
};

export const PLATFORM_ADMIN_EMAILS = ["matias4604@gmail.com"];
export const PLATFORM_ADMIN_UIDS = ["TNwwuKJsIXN29zJg8HWfORawdFm1"];

export const DEFAULT_SAAS_FEATURES = {
  pdf: true,
  recordatorios: true,
  analytics: true,
  multiusuario: false,
};

export const PLAN_BILLING_DAYS = {
  base: 30,
  pro:  90,
  full: 365,
};

export const DEFAULT_SAAS_ADMIN_SETTINGS = {
  precios: {
    base: 125000,
    pro:  300000,
    full: 900000,
    currency: "ARS",
  },
  duracionTrialDias: 14,
  graceDaysDefault: 3,
  applyPricingToNewAccountsOnly: true,
  notificationEmail: "matias4604@gmail.com",
  features: {
    ...DEFAULT_SAAS_FEATURES,
  },
  planDurations: {
    base: PLAN_BILLING_DAYS.base,
    pro: PLAN_BILLING_DAYS.pro,
    full: PLAN_BILLING_DAYS.full,
  },
};

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

export function isPlatformAdminUser(userLike = {}) {
  const email = String(userLike.email || "").toLowerCase();
  const uid = String(userLike.uid || "");
  return PLATFORM_ADMIN_EMAILS.includes(email) || PLATFORM_ADMIN_UIDS.includes(uid);
}

export function normalizeAdminSettings(raw = {}) {
  const precios = raw.precios || {};
  const basePrice = Number(precios.base ?? DEFAULT_SAAS_ADMIN_SETTINGS.precios.base);
  const proPrice  = Number(precios.pro  ?? DEFAULT_SAAS_ADMIN_SETTINGS.precios.pro);
  const fullPrice = Number(precios.full ?? DEFAULT_SAAS_ADMIN_SETTINGS.precios.full);
  const currency  = precios.currency || DEFAULT_SAAS_ADMIN_SETTINGS.precios.currency;
  const planDurationsRaw = raw.planDurations || {};
  const baseDays = Number(planDurationsRaw.base ?? DEFAULT_SAAS_ADMIN_SETTINGS.planDurations.base);
  const proDays = Number(planDurationsRaw.pro ?? DEFAULT_SAAS_ADMIN_SETTINGS.planDurations.pro);
  const fullDays = Number(planDurationsRaw.full ?? DEFAULT_SAAS_ADMIN_SETTINGS.planDurations.full);
  const duracionTrialDias = Number(raw.duracionTrialDias ?? DEFAULT_SAAS_ADMIN_SETTINGS.duracionTrialDias);
  const features = { ...DEFAULT_SAAS_FEATURES, ...(raw.features || {}) };
  const planDurations = {
    base: Number.isFinite(baseDays) && baseDays > 0 ? baseDays : DEFAULT_SAAS_ADMIN_SETTINGS.planDurations.base,
    pro: Number.isFinite(proDays) && proDays > 0 ? proDays : DEFAULT_SAAS_ADMIN_SETTINGS.planDurations.pro,
    full: Number.isFinite(fullDays) && fullDays > 0 ? fullDays : DEFAULT_SAAS_ADMIN_SETTINGS.planDurations.full,
  };

  return {
    precios: { base: basePrice, pro: proPrice, full: fullPrice, currency },
    duracionTrialDias,
    graceDaysDefault: Number(raw.graceDaysDefault ?? DEFAULT_SAAS_ADMIN_SETTINGS.graceDaysDefault),
    applyPricingToNewAccountsOnly: raw.applyPricingToNewAccountsOnly !== false,
    notificationEmail: raw.notificationEmail || DEFAULT_SAAS_ADMIN_SETTINGS.notificationEmail,
    subscriptionCurrency: currency,
    features,
    planDurations,
    plans: {
      base: {
        label: "Mensual",
        description: "Suscripción mensual · se renueva cada 30 días",
        price: basePrice,
        currency,
        billingDays: planDurations.base,
        active: true,
        features: { pdf: true, recordatorios: true, analytics: false, multiusuario: false, ...features },
      },
      pro: {
        label: "Trimestral",
        description: "Suscripción trimestral · se renueva cada 90 días",
        price: proPrice,
        currency,
        billingDays: planDurations.pro,
        active: true,
        features: { ...features, multiusuario: true },
      },
      full: {
        label: "Anual",
        description: "Suscripción anual · se renueva cada 365 días",
        price: fullPrice,
        currency,
        billingDays: planDurations.full,
        active: true,
        features: { ...features, multiusuario: true },
      },
    },
  };
}

export function normalizeSaasUser(raw = {}, fallback = {}) {
  const estadoLegacy = String(raw.estado || "").toLowerCase();
  const plan = String(raw.plan || "").toLowerCase();
  const pagoEstado = String(raw.pagoEstado || "").toLowerCase();
  const activoHasta = normalizeDateMs(raw.activoHasta)
    || normalizeDateMs(raw.trialEndsAt)
    || normalizeDateMs(raw.nextBillingAt);
  const rol = raw.rol || (raw.isPlatformAdmin ? "admin" : "user");

  let estado = raw.estado;
  if (!estado) {
    if (plan === "trial") estado = "trial";
    else if (plan === "suspendido") estado = "vencido";
    else if (pagoEstado === "pagado" || plan === "activo" || plan === "base" || plan === "pro" || plan === "full") estado = "activo";
    else estado = "trial";
  }

  return {
    uid: raw.uid || fallback.uid || "",
    email: raw.email || fallback.email || "",
    estado: String(estado || "trial").toLowerCase(),
    activoHasta,
    rol,
    plan: raw.plan || (estadoLegacy === "activo" ? "base" : "trial"),
    pagoEstado: raw.pagoEstado || (estadoLegacy === "activo" ? "pagado" : "pendiente"),
    isPlatformAdmin: Boolean(raw.isPlatformAdmin || rol === "admin"),
    trialEndsAt: normalizeDateMs(raw.trialEndsAt),
    graceEndsAt: normalizeDateMs(raw.graceEndsAt),
    nextBillingAt: normalizeDateMs(raw.nextBillingAt),
    currentPlanKey: raw.currentPlanKey || raw.plan || "base",
    features: {
      ...DEFAULT_SAAS_FEATURES,
      ...(raw.features || {}),
    },
    featureFlags: {
      ...DEFAULT_SAAS_FEATURES,
      ...(raw.featureFlags || raw.features || {}),
    },
    nombreTaller: raw.nombreTaller || fallback.nombreTaller || "Moto Gestión",
    lastSeenAt: raw.lastSeenAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
  };
}

export function resolveSaasAccess(usuario) {
  if (!usuario) return { acceso: false, motivo: "sin_usuario" };

  const now = Date.now();
  const activoHasta = normalizeDateMs(usuario.activoHasta);
  const graceEndsAt = normalizeDateMs(usuario.graceEndsAt);

  if (usuario.rol === "admin" || usuario.isPlatformAdmin) {
    return { acceso: true, motivo: "admin", estado: usuario.estado, activoHasta, graceEndsAt };
  }

  if (usuario.estado === "trial" && activoHasta && activoHasta > now) {
    return { acceso: true, motivo: "trial", estado: usuario.estado, activoHasta, graceEndsAt };
  }

  if (usuario.estado === "activo" && activoHasta && activoHasta > now) {
    return { acceso: true, motivo: "activo", estado: usuario.estado, activoHasta, graceEndsAt };
  }

  if (graceEndsAt && graceEndsAt > now) {
    return { acceso: true, motivo: "gracia", estado: usuario.estado, activoHasta, graceEndsAt };
  }

  return { acceso: "lectura", motivo: "vencido", estado: usuario.estado, activoHasta, graceEndsAt };
}

export async function leerAdminSettings() {
  const newRef = doc(db, SAAS_COLLECTIONS.adminSettings, "global");
  const newSnap = await getDoc(newRef);
  if (newSnap.exists()) return normalizeAdminSettings(newSnap.data());

  return normalizeAdminSettings(DEFAULT_SAAS_ADMIN_SETTINGS);
}

export async function guardarAdminSettings(settings, actor = {}) {
  const normalized = normalizeAdminSettings(settings);
  const payload = {
    precios: normalized.precios,
    duracionTrialDias: normalized.duracionTrialDias,
    graceDaysDefault: normalized.graceDaysDefault,
    applyPricingToNewAccountsOnly: normalized.applyPricingToNewAccountsOnly,
    features: normalized.features,
    planDurations: normalized.planDurations,
    updatedAt: serverTimestamp(),
    updatedByUid: actor.uid || "",
    updatedByEmail: actor.email || "",
  };

  await setDoc(doc(db, SAAS_COLLECTIONS.adminSettings, "global"), payload, { merge: true });
}

export async function leerUsuarioSaas(uid) {
  const newRef = doc(db, SAAS_COLLECTIONS.usuarios, uid);
  const newSnap = await getDoc(newRef);
  if (newSnap.exists()) return normalizeSaasUser(newSnap.data(), { uid });

  return null;
}

export async function leerUsuarioSaasRawDesdeServidor(uid) {
  if (!uid) return null;
  const ref = doc(db, SAAS_COLLECTIONS.usuarios, uid);
  const snap = await getDocFromServer(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function leerUsuarioSaasDesdeServidor(uid) {
  const raw = await leerUsuarioSaasRawDesdeServidor(uid);
  return raw ? normalizeSaasUser(raw, { uid }) : null;
}

export async function ensureSaasUserProfile(authUser, extras = {}) {
  if (!authUser) return null;

  const existing = await leerUsuarioSaas(authUser.uid);
  const isAdmin = isPlatformAdminUser(authUser);

  // Usuario existente: solo actualizamos campos no sensibles.
  // Los campos de suscripción (estado, plan, activoHasta, etc.) los gestiona
  // exclusivamente el webhook desde el servidor (Admin SDK).
  if (existing) {
    const safePayload = {
      email: authUser.email || existing.email || "",
      lastSeenAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (extras.nombreTaller) safePayload.nombreTaller = extras.nombreTaller;
    if (extras.appVersion)   safePayload.appVersion   = extras.appVersion;
    // Solo para el admin de plataforma: sincronizar rol (sin riesgo de escalada)
    if (isAdmin) {
      safePayload.rol            = "admin";
      safePayload.isPlatformAdmin = true;
    }
    await setDoc(doc(db, SAAS_COLLECTIONS.usuarios, authUser.uid), safePayload, { merge: true });
    return normalizeSaasUser({ ...existing, ...safePayload }, { uid: authUser.uid });
  }

  // Usuario nuevo: crear perfil completo (estado trial = el más restrictivo)
  const settings = await leerAdminSettings();
  const now = Date.now();
  const trialDays    = Number(settings.duracionTrialDias || DEFAULT_SAAS_ADMIN_SETTINGS.duracionTrialDias);
  const defaultPrecio = Number(settings.precios?.base || DEFAULT_SAAS_ADMIN_SETTINGS.precios.base);
  const currency      = settings.precios?.currency || DEFAULT_SAAS_ADMIN_SETTINGS.precios.currency;
  const baseNombreTaller = extras.nombreTaller || "Moto Gestión";

  const canonicalPayload = {
    uid:            authUser.uid,
    email:          authUser.email || "",
    estado:         isAdmin ? "activo" : "trial",
    activoHasta:    now + (isAdmin ? 365 : trialDays) * 24 * 60 * 60 * 1000,
    rol:            isAdmin ? "admin" : "user",
    plan:           isAdmin ? "pro" : "trial",
    pagoEstado:     isAdmin ? "pagado" : "pendiente",
    currentPlanKey: isAdmin ? "pro" : "base",
    isPlatformAdmin: isAdmin,
    graceEndsAt:    null,
    trialEndsAt:    isAdmin ? null : now + trialDays * 24 * 60 * 60 * 1000,
    nextBillingAt:  null,
    featureFlags:   settings.features,
    features:       settings.features,
    nombreTaller:   baseNombreTaller,
    subscriptionPriceAtSignup:    defaultPrecio,
    subscriptionCurrencyAtSignup: currency,
    appVersion:     extras.appVersion || null,
    lastSeenAt:     serverTimestamp(),
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
  };

  await setDoc(doc(db, SAAS_COLLECTIONS.usuarios, authUser.uid), canonicalPayload);

  // Email de bienvenida (fire-and-forget)
  authUser.getIdToken().then(idToken => {
    fetch("/api/send-welcome", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ uid: authUser.uid }),
    }).catch(() => {});
  }).catch(() => {});

  return normalizeSaasUser(canonicalPayload, { uid: authUser.uid });
}

export async function actualizarSuscripcionUsuario(uid, patch = {}) {
  if (!uid) throw new Error("Falta uid");
  await setDoc(
    doc(db, SAAS_COLLECTIONS.usuarios, uid),
    {
      ...patch,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function crearTicketSoporte(payload = {}) {
  if (!payload.uid) throw new Error("Falta uid");
  const docRef = await addDoc(collection(db, SAAS_COLLECTIONS.soporteTickets), {
    uid: payload.uid,
    email: payload.email || "",
    tipo: payload.tipo || "general",
    estado: "nuevo",
    mensaje: payload.mensaje || "",
    currentPlanKey: payload.currentPlanKey || "",
    requestedPlanKey: payload.requestedPlanKey || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}
