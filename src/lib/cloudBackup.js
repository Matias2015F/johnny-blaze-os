import { db } from "../firebase.js";
import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, orderBy, limit, writeBatch,
} from "firebase/firestore";
import { DATA_COLS } from "./storage.js";
import { buildBackupEnvelope, assertRestorableData, countersFromData } from "./integrity.js";

const BACKUP_KEY = "jbos_last_cloud_backup";
const MAX_BACKUPS = 7;
const BATCH_SIZE = 400;

// ── Helpers de batch ─────────────────────────────────────────────────────────

async function deleteCollectionBatched(uid, col) {
  const snap = await getDocs(collection(db, "users", uid, col));
  if (snap.empty) return;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

async function writeCollectionBatched(uid, col, items) {
  const valid = (items || []).filter((item) => item?.id);
  let count = 0;
  for (let i = 0; i < valid.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    valid.slice(i, i + BATCH_SIZE).forEach((item) => {
      batch.set(doc(db, "users", uid, col, item.id), item);
      count++;
    });
    await batch.commit();
  }
  return count;
}

async function restoreCountersFromData(uid, data) {
  const { trabajos: maxOT, presupuestos: maxPRE } = countersFromData(data);
  const now = Date.now();
  await setDoc(doc(db, "users", uid, "counters", "trabajos"), { ultimo: maxOT, updatedAt: now });
  await setDoc(doc(db, "users", uid, "counters", "presupuestos"), { ultimo: maxPRE, updatedAt: now });
}

async function pruneOldBackups(uid, excludeId = null) {
  const snap = await getDocs(
    query(collection(db, "users", uid, "snapshots"), orderBy("fecha", "asc"))
  );
  const candidates = excludeId
    ? snap.docs.filter((d) => d.id !== excludeId)
    : snap.docs;
  const excess = snap.docs.length - MAX_BACKUPS;
  if (excess > 0) {
    await Promise.all(candidates.slice(0, excess).map((d) => deleteDoc(d.ref)));
  }
}

// ── API pública ───────────────────────────────────────────────────────────────

export async function createCloudBackup(uid, { pruneProtect = null } = {}) {
  const data = {};
  for (const col of DATA_COLS) {
    const snap = await getDocs(collection(db, "users", uid, col));
    data[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const envelope = buildBackupEnvelope(data, { source: "cloud" });
  if (envelope.total === 0) return null;

  const id = new Date().toISOString().replace(/[:.]/g, "-");
  await setDoc(doc(db, "users", uid, "snapshots", id), {
    fecha: Date.now(),
    total: envelope.total,
    counts: envelope.integrity.counts,
    integrity: envelope.integrity,
    schema: "motogestion-backup",
    v: 3,
    data: JSON.stringify(envelope.data),
    createdAt: Date.now(),
  });

  localStorage.setItem(BACKUP_KEY, Date.now().toString());
  await pruneOldBackups(uid, pruneProtect);
  return { id, total: envelope.total };
}

export async function autoCloudBackup(uid) {
  const last = Number(localStorage.getItem(BACKUP_KEY) || 0);
  if (Date.now() - last < 86400000) return null;
  return createCloudBackup(uid);
}

export async function listCloudBackups(uid) {
  const snap = await getDocs(
    query(collection(db, "users", uid, "snapshots"), orderBy("fecha", "desc"), limit(MAX_BACKUPS))
  );
  // Excluir el campo data (JSON pesado) de la lista
  return snap.docs.map((d) => {
    const { data: _data, ...rest } = d.data();
    return { id: d.id, ...rest };
  });
}

export async function restoreCloudBackup(uid, backupId) {
  let report = null;
  const startedAt = Date.now();
  const restoreRef = doc(db, "users", uid, "restoreState", "current");

  // 1. Leer backup por doc directo
  const backupSnap = await getDoc(doc(db, "users", uid, "snapshots", backupId));
  if (!backupSnap.exists()) throw new Error("Backup no encontrado");

  // 2. Parsear y validar antes de tocar datos actuales
  const raw = JSON.parse(backupSnap.data().data);
  let data;
  try {
    ({ data, report } = assertRestorableData(raw));
  } catch (err) {
    await setDoc(restoreRef, {
      status: "failed",
      backupId,
      failedAt: Date.now(),
      error: err.message,
      report: null,
    }, { merge: true });
    throw err;
  }

  // 3. Guardar estado "running"
  await setDoc(restoreRef, {
    status: "running",
    backupId,
    startedAt,
    report,
    restoredCount: 0,
  });

  try {
    // 4. Backup de seguridad antes de borrar (protege el backupId original)
    await createCloudBackup(uid, { pruneProtect: backupId });

    // 5. Borrar colecciones actuales en batches
    for (const col of DATA_COLS) {
      await deleteCollectionBatched(uid, col);
    }

    // 6. Restaurar desde backup en batches
    let restoredCount = 0;
    for (const col of DATA_COLS) {
      restoredCount += await writeCollectionBatched(uid, col, data[col]);
    }

    // 7. Reconstruir contadores OT/PRE
    await restoreCountersFromData(uid, data);

    // 8. Marcar como completado
    await setDoc(restoreRef, {
      status: "completed",
      backupId,
      startedAt,
      completedAt: Date.now(),
      restoredCount,
      report,
    });

    return restoredCount;
  } catch (err) {
    await setDoc(restoreRef, {
      status: "failed",
      backupId,
      startedAt,
      failedAt: Date.now(),
      error: err.message || String(err),
      report,
    }, { merge: true });
    throw err;
  }
}
