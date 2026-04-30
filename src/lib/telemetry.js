import { auth, db } from "../firebase.js";
import { LS, generateId } from "./storage.js";
import { APP_BUILD } from "../generated/appVersion.js";
import {
  doc,
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

function getSessionId() {
  const key = "jbos_session_id";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = generateId();
    sessionStorage.setItem(key, value);
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

export async function ensureAccountProfile() {
  const user = auth.currentUser;
  if (!user) return;

  const ref = doc(db, "accounts", user.uid);
  await setDoc(ref, {
    uid: user.uid,
    email: user.email || "",
    nombreTaller: (LS.getDoc("config", "global") || {}).nombreTaller || "Johnny Blaze OS",
    plan: "trial",
    pagoEstado: "pendiente",
    trialStartsAt: Date.now(),
    trialEndsAt: Date.now() + 14 * 24 * 60 * 60 * 1000,
    graceEndsAt: null,
    adminUid: user.uid,
    features: DEFAULT_FEATURES,
    lastSeenAt: serverTimestamp(),
    appVersion: APP_BUILD.version,
    updatedAt: serverTimestamp(),
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
