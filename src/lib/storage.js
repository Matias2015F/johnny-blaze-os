import { useState, useEffect } from "react";
import { auth, db } from "../firebase.js";
import {
  collection, doc, getDocs,
  setDoc as fsSetDoc, deleteDoc as fsDeleteDoc,
  onSnapshot, writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// In-memory cache — updated by onSnapshot listeners
const _cache = {};

export const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const getUid  = () => auth.currentUser?.uid ?? null;
const userCol = (col) => collection(db, "users", getUid(), col);
const userDoc = (col, id) => doc(db, "users", getUid(), col, id);

// ── Sync status ───────────────────────────────────────────────────────────────
let _pending = 0;
let _syncError = false;
const _syncListeners = new Set();

function notifySync() {
  const status = _pending > 0 ? "syncing" : _syncError ? "error" : "synced";
  _syncListeners.forEach((fn) => fn(status));
}

export function onSyncStatus(fn) {
  _syncListeners.add(fn);
  return () => _syncListeners.delete(fn);
}

export function getSyncStatus() {
  return _pending > 0 ? "syncing" : _syncError ? "error" : "synced";
}

// Escribe a Firestore con 3 reintentos — falla visible si persiste
async function fsWrite(op) {
  const uid = getUid();
  if (!uid) return;
  _pending++;
  _syncError = false;
  notifySync();
  let lastErr;
  for (let i = 0; i < 3; i++) {
    try {
      await op();
      lastErr = null;
      break;
    } catch (e) {
      lastErr = e;
      if (i < 2) await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  _pending--;
  if (lastErr) {
    _syncError = true;
    console.error("[FS write failed]", lastErr);
  }
  notifySync();
}

// ── LS API ────────────────────────────────────────────────────────────────────
export const LS = {
  getAll: (col) => _cache[col] ?? [],

  getDoc: (col, id) => (_cache[col] ?? []).find((d) => d.id === id) ?? null,

  setDoc: (col, id, data) => {
    const entry = { id, ...data };
    _cache[col] = [...(_cache[col] ?? []).filter((d) => d.id !== id), entry];
    fsWrite(() => fsSetDoc(userDoc(col, id), entry));
    return { id };
  },

  addDoc: (col, data) => {
    const id = generateId();
    const entry = { id, ...data };
    _cache[col] = [...(_cache[col] ?? []), entry];
    fsWrite(() => fsSetDoc(userDoc(col, id), entry));
    return { id };
  },

  updateDoc: (col, id, patch) => {
    _cache[col] = (_cache[col] ?? []).map((d) => (d.id === id ? { ...d, ...patch } : d));
    fsWrite(() => fsSetDoc(userDoc(col, id), patch, { merge: true }));
  },

  deleteDoc: (col, id) => {
    _cache[col] = (_cache[col] ?? []).filter((d) => d.id !== id);
    fsWrite(() => fsDeleteDoc(userDoc(col, id)));
  },
};

// ── useCollection ─────────────────────────────────────────────────────────────
export function useCollection(col) {
  const [data, setData] = useState(() => _cache[col] ?? []);

  useEffect(() => {
    let unsub = null;
    let retryTimer = null;
    let retries = 0;
    let cancelled = false;

    const subscribe = () => {
      if (cancelled) return;
      unsub = onSnapshot(
        userCol(col),
        (snap) => {
          if (cancelled) return;
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          _cache[col] = docs;
          setData(docs);
          retries = 0;
        },
        (err) => {
          console.error("[FS snapshot]", col, err);
          if (cancelled) return;
          const delay = Math.min(2000 * 2 ** retries, 30000);
          retries++;
          retryTimer = setTimeout(subscribe, delay);
        },
      );
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsub) { unsub(); unsub = null; }
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      retries = 0;
      if (user) {
        subscribe();
      } else {
        _cache[col] = [];
        setData([]);
      }
    });

    return () => {
      cancelled = true;
      if (unsub) unsub();
      if (retryTimer) clearTimeout(retryTimer);
      unsubAuth();
    };
  }, [col]);

  return data;
}

// ── Hook sync status ──────────────────────────────────────────────────────────
export function useSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus);
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}

// ── Colecciones y migraciones ─────────────────────────────────────────────────
export const DATA_COLS = ["trabajos", "clientes", "motos", "caja", "config", "catalogoTareas", "titularidades", "precioHistorial", "recordatorios"];

const LS_PREFIX     = "jbos_johnny-blaze-os_";
const MIGRATION_KEY = "jbos_fs_migrated_v1";
const RENAME_KEY    = "jbos_collections_renamed_v1";

// Mapa clave localStorage → colección Firestore (para migración desde LS)
const LS_LEGACY_MAP = [
  ["ordenes",           "trabajos"],
  ["clientes",          "clientes"],
  ["motos",             "motos"],
  ["caja",              "caja"],
  ["config",            "config"],
  ["serviciosCatalogo", "catalogoTareas"],
];

export async function migrateFromLocalStorage(uid) {
  if (localStorage.getItem(MIGRATION_KEY)) return 0;
  let count = 0;
  for (const [lsKey, fsCol] of LS_LEGACY_MAP) {
    const raw = localStorage.getItem(LS_PREFIX + lsKey);
    if (!raw) continue;
    let items;
    try { items = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(items) || !items.length) continue;
    const snap = await getDocs(collection(db, "users", uid, fsCol));
    if (!snap.empty) continue;
    const batch = writeBatch(db);
    for (const item of items) {
      if (!item.id) continue;
      batch.set(doc(db, "users", uid, fsCol, item.id), item);
    }
    await batch.commit();
    count += items.length;
  }
  localStorage.setItem(MIGRATION_KEY, "1");
  return count;
}

// Renombra colecciones en Firestore: ordenes→trabajos, serviciosCatalogo→catalogoTareas
export async function migrateRenamedCollections(uid) {
  if (localStorage.getItem(RENAME_KEY)) return 0;
  const renames = [
    ["ordenes",           "trabajos"],
    ["serviciosCatalogo", "catalogoTareas"],
  ];
  let count = 0;
  for (const [from, to] of renames) {
    const src = await getDocs(collection(db, "users", uid, from));
    if (src.empty) continue;
    const dst = await getDocs(collection(db, "users", uid, to));
    if (!dst.empty) continue;
    const batch = writeBatch(db);
    src.docs.forEach(d => batch.set(doc(db, "users", uid, to, d.id), d.data()));
    await batch.commit();
    count += src.docs.length;
  }
  localStorage.setItem(RENAME_KEY, "1");
  return count;
}

export async function migrateFromRootCollections(uid) {
  let count = 0;
  for (const col of DATA_COLS) {
    const rootSnap = await getDocs(collection(db, col));
    if (rootSnap.empty) continue;
    const destSnap = await getDocs(collection(db, "users", uid, col));
    if (!destSnap.empty) continue;
    const batch = writeBatch(db);
    rootSnap.docs.forEach((d) => batch.set(doc(db, "users", uid, col, d.id), d.data()));
    await batch.commit();
    count += rootSnap.docs.length;
  }
  return count;
}

export async function forceSyncCacheToFirestore(uid) {
  let count = 0;
  for (const col of DATA_COLS) {
    const items = _cache[col];
    if (!items?.length) continue;
    const batch = writeBatch(db);
    items.forEach((item) => {
      if (!item.id) return;
      batch.set(doc(db, "users", uid, col, item.id), item);
    });
    await batch.commit();
    count += items.length;
  }
  return count;
}

export async function clearFirestoreData(uid) {
  for (const col of DATA_COLS) {
    const snap = await getDocs(collection(db, "users", uid, col));
    if (snap.empty) continue;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  DATA_COLS.forEach((col) => { delete _cache[col]; });
}
