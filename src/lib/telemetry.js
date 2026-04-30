import { auth, db } from "../firebase.js";
import { LS, generateId } from "./storage.js";
import { APP_BUILD } from "../generated/appVersion.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  increment,
} from "firebase/firestore";

const DEFAULT_FEATURES = {
  pdf: true,
  recordatorios: true,
  analytics: true,
  multiusuario: false,
};

export const PLATFORM_ADMIN_EMAILS = ["fefe@gmail.com"];
export const PLATFORM_ADMIN_UIDS = ["123456789"];
export const DEFAULT_PLAN_DEFINITIONS = {
  base: {
    label: "Plan Base",
    price: 5000,
    currency: "ARS",
    billingDays: 30,
    features: {
      pdf: true,
      recordatorios: true,
      analytics: false,
      multiusuario: false,
    },
  },
  pro: {
    label: "Plan Pro",
    price: 12000,
    currency: "ARS",
    billingDays: 30,
    features: {
      pdf: true,
      recordatorios: true,
      analytics: true,
      multiusuario: true,
    },
  },
};
export const DEFAULT_ADMIN_SETTINGS = {
  trialDaysDefault: 14,
  subscriptionPrice: 0,
  subscriptionCurrency: "ARS",
  applyPricingToNewAccountsOnly: true,
  graceDaysDefault: 3,
  plans: DEFAULT_PLAN_DEFINITIONS,
  featureFlags: {
    pdf: true,
    recordatorios: true,
    analytics: true,
    multiusuario: false,
  },
  updatedAt: null,
};

function getSessionId() {
  const key = "jbos_session_id";
  if (typeof window === "undefined") return generateId();
  let value = window.sessionStorage.getItem(key);
  if (!value) {
    value = generateId();
    window.sessionStorage.setItem(key, value);
  }
  return value;
}

function getDeviceType() {
  const ua = navigator.userAgent || "";
  if (/ipad|tablet/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}

function getPlatform() {
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/windows/i.test(ua)) return "windows";
  if (/mac os/i.test(ua)) return "mac";
  return "web";
}

function analyticsEnabled() {
  const cfg = LS.getDoc("config", "global") || {};
  return cfg.analyticsEnabled !== false;
}

function mergeFeatureFlags(settings = {}) {
  return {
    ...DEFAULT_FEATURES,
    ...(settings.featureFlags || {}),
  };
}

function pickSignupPlan(settings = {}) {
  const plans = settings.plans || DEFAULT_PLAN_DEFINITIONS;
  const planKey = plans.base ? "base" : Object.keys(plans)[0];
  const selected = plans[planKey] || DEFAULT_PLAN_DEFINITIONS.base;
  return {
    key: planKey,
    ...selected,
  };
}

export async function ensureAccountProfile() {
  const user = auth.currentUser;
  if (!user) return;

  const ref = doc(db, "accounts", user.uid);
  const [existingSnap, settingsSnap] = await Promise.all([
    getDoc(ref),
    getDoc(doc(db, "adminSettings", "global")),
  ]);

  const existing = existingSnap.exists() ? existingSnap.data() : null;
  const settings = settingsSnap.exists()
    ? { ...DEFAULT_ADMIN_SETTINGS, ...settingsSnap.data() }
    : DEFAULT_ADMIN_SETTINGS;
  const trialDays = Number(settings.trialDaysDefault || DEFAULT_ADMIN_SETTINGS.trialDaysDefault);
  const graceDays = Number(settings.graceDaysDefault || DEFAULT_ADMIN_SETTINGS.graceDaysDefault);
  const signupPlan = pickSignupPlan(settings);
  const featureFlags = mergeFeatureFlags(settings);
  const now = Date.now();
  const isPlatformAdmin =
    PLATFORM_ADMIN_EMAILS.includes((user.email || "").toLowerCase()) ||
    PLATFORM_ADMIN_UIDS.includes(user.uid || "");

  const basePayload = {
    uid: user.uid,
    email: user.email || "",
    nombreTaller: (LS.getDoc("config", "global") || {}).nombreTaller || existing?.nombreTaller || "Johnny Blaze OS",
    lastSeenAt: serverTimestamp(),
      appVersion: APP_BUILD.version,
      updatedAt: serverTimestamp(),
      isPlatformAdmin: existing?.isPlatformAdmin ?? isPlatformAdmin,
      featureFlags,
    };

  if (existing) {
    await setDoc(ref, basePayload, { merge: true });
    return;
  }

  await setDoc(ref, {
    ...basePayload,
    plan: "trial",
    pagoEstado: "pendiente",
    trialStartsAt: now,
    trialEndsAt: now + trialDays * 24 * 60 * 60 * 1000,
    graceEndsAt: now + (trialDays + graceDays) * 24 * 60 * 60 * 1000,
    adminUid: user.uid,
    features: {
      ...(signupPlan.features || DEFAULT_FEATURES),
      ...featureFlags,
    },
    featureFlags,
    currentPlanKey: signupPlan.key,
    nextBillingAt: now + trialDays * 24 * 60 * 60 * 1000,
    billingCadenceDays: Number(signupPlan.billingDays || 30),
    subscriptionPriceAtSignup: Number((signupPlan.price ?? settings.subscriptionPrice) || 0),
    subscriptionCurrencyAtSignup: signupPlan.currency || settings.subscriptionCurrency || "ARS",
    pricingVersionAppliedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
  }, { merge: true });
}

export async function trackEvent(action, payload = {}) {
  const user = auth.currentUser;
  if (!user || !analyticsEnabled()) return;

  const eventId = generateId();
  const sessionId = getSessionId();
  const fecha = new Date().toLocaleDateString("sv-SE");
  const eventRef = doc(db, "telemetryEvents", eventId);
  const snapshotRef = doc(db, "usageSnapshots", `${user.uid}_${fecha}`);

  const event = {
    id: eventId,
    uid: user.uid,
    accountId: user.uid,
    action,
    screen: payload.screen || "",
    entityType: payload.entityType || "",
    entityId: payload.entityId || "",
    sessionId,
    deviceType: getDeviceType(),
    platform: getPlatform(),
    appVersion: APP_BUILD.version,
    metadata: payload.metadata || {},
    createdAt: serverTimestamp(),
  };

  await Promise.all([
    setDoc(eventRef, event),
    setDoc(snapshotRef, {
      accountId: user.uid,
      fecha,
      uid: user.uid,
      appVersion: APP_BUILD.version,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      [`topScreens.${payload.screen || "unknown"}`]: increment(1),
      [`topActions.${action}`]: increment(1),
      [`metrics.${action}`]: increment(1),
    }, { merge: true }),
    setDoc(doc(db, "accounts", user.uid), {
      lastSeenAt: serverTimestamp(),
      appVersion: APP_BUILD.version,
      updatedAt: serverTimestamp(),
    }, { merge: true }),
  ]);
}
