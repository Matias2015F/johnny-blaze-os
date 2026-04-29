import { db } from "../firebase.js";
import {
  collection, doc, getDocs, setDoc, deleteDoc, query, orderBy, limit,
} from "firebase/firestore";
import { DATA_COLS } from "./storage.js";

const BACKUP_KEY = "jbos_last_cloud_backup";
const MAX_BACKUPS = 7;

// Crea un snapshot de todos los datos en users/{uid}/snapshots/{id}
export async function createCloudBackup(uid) {
  const data = {};
  for (const col of DATA_COLS) {
    const snap = await getDocs(collection(db, "users", uid, col));
    data[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const total = Object.values(data).reduce((s, a) => s + a.length, 0);
  if (total === 0) return null;

  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const ref = doc(db, "users", uid, "snapshots", id);
  await setDoc(ref, {
    fecha: Date.now(),
    total,
    data: JSON.stringify(data),
  });

  localStorage.setItem(BACKUP_KEY, Date.now().toString());
  await pruneOldBackups(uid);
  return { id, total };
}

// Backup automático — máximo una vez por día
export async function autoCloudBackup(uid) {
  const last = Number(localStorage.getItem(BACKUP_KEY) || 0);
  if (Date.now() - last < 86400000) return null; // menos de 24h
  return createCloudBackup(uid);
}

// Lista los últimos MAX_BACKUPS backups
export async function listCloudBackups(uid) {
  const snap = await getDocs(
    query(collection(db, "users", uid, "snapshots"), orderBy("fecha", "desc"), limit(MAX_BACKUPS))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data(), data: undefined }));
}

// Restaura un backup: sobreescribe todas las colecciones del usuario
export async function restoreCloudBackup(uid, backupId) {
  const snap = await getDocs(collection(db, "users", uid, "snapshots"));
  const backupDoc = snap.docs.find((d) => d.id === backupId);
  if (!backupDoc) throw new Error("Backup no encontrado");

  const data = JSON.parse(backupDoc.data().data);
  let count = 0;

  for (const col of DATA_COLS) {
    const items = data[col];
    if (!Array.isArray(items)) continue;
    // Borrar colección actual
    const cur = await getDocs(collection(db, "users", uid, col));
    if (!cur.empty) {
      const del = [];
      cur.docs.forEach((d) => del.push(deleteDoc(d.ref)));
      await Promise.all(del);
    }
    // Restaurar desde backup
    const batch = [];
    items.forEach((item) => {
      if (!item.id) return;
      batch.push(setDoc(doc(db, "users", uid, col, item.id), item));
    });
    await Promise.all(batch);
    count += items.length;
  }
  return count;
}

async function pruneOldBackups(uid) {
  const snap = await getDocs(
    query(collection(db, "users", uid, "snapshots"), orderBy("fecha", "asc"))
  );
  const excess = snap.docs.length - MAX_BACKUPS;
  if (excess > 0) {
    await Promise.all(snap.docs.slice(0, excess).map((d) => deleteDoc(d.ref)));
  }
}
