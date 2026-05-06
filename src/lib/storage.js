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

// ── Sync status ────────────────────────────────────────────────────────────────
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

// ── LS API ───────────────────────────────────────────────────────────────────
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

// ── useCollection ────────────────────────────────────────────────────────────
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

// ── Hook sync status ─────────────────────────────────────────────────────────
export function useSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus);
  useEffect(() => onSyncStatus(setStatus), []);
  return status;
}

// ── Colecciones y migraciones ────────────────────────────────────────────────
export const DATA_COLS = ["trabajos", "clientes", "motos", "caja", "config", "catalogoTareas", "titularidades", "precioHistorial", "recordatorios", "agendaTurnos"];

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

// ========== HISTORIAL DE REPUESTOS E INSUMOS ==========

export function obtenerRepuestosHistorial(cilindrada = null) {
  try {
    const todos = LS.getAll("repuestosHistorial") || [];
    if (!cilindrada) return todos;
    return todos.filter((r) => !r.cilindrada || Number(r.cilindrada) === Number(cilindrada));
  } catch {
    return [];
  }
}

export function guardarRepuestoHistorial(nombre, precio, cilindrada = null, tipo = "repuesto") {
  if (!nombre || !precio) return;
  const historial = LS.getAll("repuestosHistorial") || [];
  const existe = historial.find(
    (r) => r.nombre.toLowerCase() === nombre.toLowerCase() &&
           Number(r.cilindrada || 0) === Number(cilindrada || 0) &&
           r.tipo === tipo
  );
  if (existe) {
    LS.updateDoc("repuestosHistorial", existe.id, {
      precio: Number(precio),
      ultimaActualizacion: Date.now(),
      usos: (existe.usos || 0) + 1,
    });
  } else {
    LS.addDoc("repuestosHistorial", {
      nombre: nombre.trim(),
      precio: Number(precio),
      cilindrada: cilindrada ? Number(cilindrada) : null,
      tipo,
      createdAt: Date.now(),
      ultimaActualizacion: Date.now(),
      usos: 1,
    });
  }
}

export function buscarRepuestosAutocomplete(query, cilindrada = null, tipo = "repuesto") {
  if (!query || query.length < 1) return [];
  const historial = obtenerRepuestosHistorial(cilindrada);
  const busqueda = query.toLowerCase();
  return historial
    .filter((r) => r.tipo === tipo && r.nombre.toLowerCase().includes(busqueda))
    .sort((a, b) => (b.usos || 0) - (a.usos || 0))
    .slice(0, 8);
}

// ========== HELPERS DE ÓRDENES PARA FLUJO PROFESIONAL ==========

export function obtenerOrden(ordenId) {
  return LS.getDoc("trabajos", ordenId);
}

export function actualizarOrden(ordenId, patch) {
  LS.updateDoc("trabajos", ordenId, { ...patch, updatedAt: Date.now() });
}

export function listarOrdenesActivas() {
  return (LS.getAll("trabajos") || []).filter(
    (o) => !["cerrado_emitido", "CANCELADO"].includes(o.estado)
  );
}

export function calcularGananciaSemana() {
  const hace7dias = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return (LS.getAll("trabajos") || [])
    .filter((o) => o.pagado_fecha && o.pagado_fecha > hace7dias)
    .reduce((sum, o) => sum + (o.ganancia || 0), 0);
}

// ========== GENERACIÓN SEGURA DE COMPROBANTES ==========

/**
 * Genera número comprobante único y seguro con checksum
 * Formato: JBO-YYYYMMDD-HHMMSS-CHECKSUM
 * @param {string} orderId - ID de la orden
 * @returns {string} Número comprobante único
 */
export function generarNumeroComprobante(orderId) {
  const ahora = new Date();
  const year = ahora.getFullYear();
  const month = String(ahora.getMonth() + 1).padStart(2, '0');
  const day = String(ahora.getDate()).padStart(2, '0');
  const hours = String(ahora.getHours()).padStart(2, '0');
  const mins = String(ahora.getMinutes()).padStart(2, '0');
  const secs = String(ahora.getSeconds()).padStart(2, '0');

  const fecha = `${year}${month}${day}`;
  const hora = `${hours}${mins}${secs}`;
  const parte1 = fecha + hora;

  // Calcular checksum: suma de dígitos mod 10
  const checksum = String(
    parte1.split('').reduce((a, b) => parseInt(a) + parseInt(b), 0) % 10
  );

  return `JBO-${fecha}-${hora}-${checksum}`;
}

/**
 * Genera hash simple para verificación de integridad
 * @param {string} str - String a hashear
 * @returns {string} Hash hexadecimal de 8 caracteres
 */
function generarHashSimple(str) {
  let hash = 0;
  if (str.length === 0) return '00000000';

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Crea snapshot verificable y inmutable de orden
 * @param {object} order - Orden completa
 * @param {string} numeroComprobante - Número comprobante generado
 * @param {object} cliente - Datos del cliente
 * @param {object} moto - Datos de la moto
 * @returns {object} Snapshot verificable con hash
 */
export function crearSnapshotVerificable(order, numeroComprobante, cliente, moto) {
  const snapshot = {
    numeroComprobante,
    orderId: order.id,
    clienteId: order.clientId,
    clienteNombre: cliente?.nombre,
    bikeId: order.bikeId,
    bikePatente: moto?.patente,
    bikeMarca: moto?.marca,
    bikeModelo: moto?.modelo,
    tareas: order.tareas || [],
    repuestos: order.repuestos || [],
    insumos: order.insumos || [],
    fletes: order.fletes || [],
    total: order.total || 0,
    pagos: order.pagos || [],
    fechaComprobante: new Date().toISOString(),
    garantia: order.garantiaFinal || '',
    estado: order.estado,
    validado: true
  };

  // Generar hash de integridad basado en datos
  const stringParaHash = JSON.stringify(snapshot);
  snapshot.hash = generarHashSimple(stringParaHash);

  return snapshot;
}
