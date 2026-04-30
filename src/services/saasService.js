import { db } from "../firebase.js";
import { addDoc, collection, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export const SAAS_COLLECTIONS = {
  usuarios: "usuarios",
  adminSettings: "admin_settings",
  soporteTickets: "soporteTickets",
};

export const PLATFORM_ADMIN_EMAILS = ["fefe@gmail.com"];
export const PLATFORM_ADMIN_UIDS = ["123456789"];

export const DEFAULT_SAAS_FEATURES = {
  pdf: true,
  recordatorios: true,
  analytics: true,
  multiusuario: false,
};

export const DEFAULT_SAAS_ADMIN_SETTINGS = {
  precios: {
    base: 5000,
    pro: 12000,
    currency: "ARS",
  },
  duracionTrialDias: 14,
  graceDaysDefault: 3,
  applyPricingToNewAccountsOnly: true,
  features: {
    ...DEFAULT_SAAS_FEATURES,
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
  const proPrice = Number(precios.pro ?? DEFAULT_SAAS_ADMIN_SETTINGS.precios.pro);
  const currency = precios.currency || DEFAULT_SAAS_ADMIN_SETTINGS.precios.currency;
  const duracionTrialDias = Number(raw.duracionTrialDias ?? DEFAULT_SAAS_ADMIN_SETTINGS.duracionTrialDias);
  const features = {
    ...DEFAULT_SAAS_FEATURES,
    ...(raw.features || {}),
  };

  return {
    precios: {
      base: basePrice,
      pro: proPrice,
      currency,
    },
    duracionTrialDias,
    graceDaysDefault: Number(raw.graceDaysDefault ?? DEFAULT_SAAS_ADMIN_SETTINGS.graceDaysDefault),
    applyPricingToNewAccountsOnly: raw.applyPricingToNewAccountsOnly !== false,
    features,
    plans: {
      base: {
        label: "Plan Base",
        price: basePrice,
        currency,
        billingDays: 30,
        features: {
          pdf: true,
          recordatorios: true,
          analytics: false,
          multiusuario: false,
          ...features,
        },
      },
      pro: {
        label: "Plan Pro",
        price: proPrice,
        currency,
        billingDays: 30,
        features: {
          ...features,
          multiusuario: true,
        },
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
    else if (pagoEstado === "pagado" || plan === "activo" || plan === "base" || plan === "pro") estado = "activo";
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
    nombreTaller: raw.nombreTaller || fallback.nombreTaller || "Johnny Blaze OS",
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

  return { acceso: false, motivo: "vencido", estado: usuario.estado, activoHasta, graceEndsAt };
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

export async function ensureSaasUserProfile(authUser, extras = {}) {
  if (!authUser) return null;

  const settings = await leerAdminSettings();
  const existing = await leerUsuarioSaas(authUser.uid);
  const now = Date.now();
  const isAdmin = isPlatformAdminUser(authUser);
  const trialDays = Number(settings.duracionTrialDias || DEFAULT_SAAS_ADMIN_SETTINGS.duracionTrialDias);
  const defaultPrecio = Number(settings.precios?.base || DEFAULT_SAAS_ADMIN_SETTINGS.precios.base);
  const currency = settings.precios?.currency || DEFAULT_SAAS_ADMIN_SETTINGS.precios.currency;
  const baseNombreTaller = extras.nombreTaller || existing?.nombreTaller || "Johnny Blaze OS";

  const canonical = existing || {
    uid: authUser.uid,
    email: authUser.email || "",
    estado: isAdmin ? "activo" : "trial",
    activoHasta: now + trialDays * 24 * 60 * 60 * 1000,
    rol: isAdmin ? "admin" : "user",
    plan: isAdmin ? "pro" : "trial",
    pagoEstado: isAdmin ? "pagado" : "pendiente",
    currentPlanKey: isAdmin ? "pro" : "base",
    featureFlags: settings.features,
    features: settings.features,
    nombreTaller: baseNombreTaller,
  };

  const merged = normalizeSaasUser({
    ...canonical,
    uid: authUser.uid,
    email: authUser.email || canonical.email || "",
    rol: isAdmin ? "admin" : canonical.rol,
    isPlatformAdmin: isAdmin || canonical.isPlatformAdmin,
    nombreTaller: baseNombreTaller,
    featureFlags: {
      ...settings.features,
      ...(canonical.featureFlags || {}),
    },
    features: {
      ...settings.features,
      ...(canonical.features || {}),
    },
  }, { uid: authUser.uid, email: authUser.email || "" });

  const canonicalPayload = {
    uid: merged.uid,
    email: merged.email,
    estado: merged.estado,
    activoHasta: merged.activoHasta || now + trialDays * 24 * 60 * 60 * 1000,
    rol: merged.rol,
    plan: merged.plan,
    pagoEstado: merged.pagoEstado,
    currentPlanKey: merged.currentPlanKey,
    isPlatformAdmin: merged.isPlatformAdmin,
    graceEndsAt: merged.graceEndsAt || null,
    trialEndsAt: merged.trialEndsAt || null,
    nextBillingAt: merged.nextBillingAt || null,
    featureFlags: merged.featureFlags,
    features: merged.features,
    nombreTaller: merged.nombreTaller,
    lastSeenAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!existing) {
    canonicalPayload.createdAt = serverTimestamp();
  }

  await setDoc(doc(db, SAAS_COLLECTIONS.usuarios, authUser.uid), canonicalPayload, { merge: true });

  return normalizeSaasUser({
    ...canonicalPayload,
    subscriptionPriceAtSignup: existing?.subscriptionPriceAtSignup ?? defaultPrecio,
    subscriptionCurrencyAtSignup: existing?.subscriptionCurrencyAtSignup ?? currency,
    appVersion: extras.appVersion || existing?.appVersion || null,
  }, { uid: authUser.uid });
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
