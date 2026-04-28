import { useState, useEffect } from "react";
import { auth, db } from "../firebase.js";
import {
  collection, doc, getDocs,
  setDoc as fsSetDoc, deleteDoc as fsDeleteDoc,
  onSnapshot, writeBatch,
} from "firebase/firestore";

// In-memory cache — updated by onSnapshot listeners
const _cache = {};

export const generateId = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 9);

const getUid  = () => auth.currentUser?.uid ?? null;
const userCol = (col) => collection(db, "users", getUid(), col);
const userDoc = (col, id) => doc(db, "users", getUid(), col, id);

function fsWrite(op) {
  op().catch((e) => console.error("[FS write]", e));
}

// ── LS API — misma firma que antes, optimistic writes a Firestore ────────────
export const LS = {
  getAll: (col) => _cache[col] ?? [],

  getDoc: (col, id) => (_cache[col] ?? []).find((d) => d.id === id) ?? null,

  setDoc: (col, id, data) => {
    const entry = { id, ...data };
    _cache[col] = [...(_cache[col] ?? []).filter((d) => d.id !== id), entry];
    if (getUid()) fsWrite(() => fsSetDoc(userDoc(col, id), entry));
    return { id };
  },

  addDoc: (col, data) => {
    const id = generateId();
    const entry = { id, ...data };
    _cache[col] = [...(_cache[col] ?? []), entry];
    if (getUid()) fsWrite(() => fsSetDoc(userDoc(col, id), entry));
    return { id };
  },

  updateDoc: (col, id, patch) => {
    _cache[col] = (_cache[col] ?? []).map((d) => (d.id === id ? { ...d, ...patch } : d));
    if (getUid()) fsWrite(() => fsSetDoc(userDoc(col, id), patch, { merge: true }));
  },

  deleteDoc: (col, id) => {
    _cache[col] = (_cache[col] ?? []).filter((d) => d.id !== id);
    if (getUid()) fsWrite(() => fsDeleteDoc(userDoc(col, id)));
  },
};

// ── useCollection — tiempo real via onSnapshot ───────────────────────────────
export function useCollection(col) {
  const [data, setData] = useState(() => _cache[col] ?? []);

  useEffect(() => {
    const uid = getUid();
    if (!uid) return;
    return onSnapshot(
      userCol(col),
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        _cache[col] = docs;
        setData(docs);
      },
      (err) => console.error("[FS snapshot]", col, err),
    );
  }, [col]);

  return data;
}

// ── Migración única: localStorage → Firestore ────────────────────────────────
const LS_PREFIX     = "jbos_johnny-blaze-os_";
const MIGRATION_KEY = "jbos_fs_migrated_v1";
const DATA_COLS     = ["ordenes", "clientes", "motos", "caja", "config", "serviciosCatalogo"];

export async function migrateFromLocalStorage(uid) {
  if (localStorage.getItem(MIGRATION_KEY)) return 0;

  let count = 0;
  for (const col of DATA_COLS) {
    const raw = localStorage.getItem(LS_PREFIX + col);
    if (!raw) continue;
    let items;
    try { items = JSON.parse(raw); } catch { continue; }
    if (!Array.isArray(items) || !items.length) continue;

    // No sobrescribir si ya hay datos en Firestore
    const snap = await getDocs(collection(db, "users", uid, col));
    if (!snap.empty) continue;

    const batch = writeBatch(db);
    for (const item of items) {
      if (!item.id) continue;
      batch.set(doc(db, "users", uid, col, item.id), item);
    }
    await batch.commit();
    count += items.length;
  }

  localStorage.setItem(MIGRATION_KEY, "1");
  return count;
}

// Borra todas las colecciones del usuario en Firestore
export async function clearFirestoreData(uid) {
  for (const col of DATA_COLS) {
    const snap = await getDocs(collection(db, "users", uid, col));
    if (snap.empty) continue;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  // Limpiar cache local también
  DATA_COLS.forEach((col) => { delete _cache[col]; });
}
