import { LS, DATA_COLS } from "../lib/storage.js";
import { exportBackup, getMeta, setMeta, shouldAutoBackup } from "../lib/backup.js";
import { assertRestorableData } from "../lib/integrity.js";

export function tiempoDesde(timestamp) {
  if (!timestamp) return null;
  const diff = Date.now() - new Date(timestamp).getTime();
  const min = Math.floor(diff / 60000);
  const hs  = Math.floor(diff / 3600000);
  const dias = Math.floor(diff / 86400000);
  if (min < 1)  return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  if (hs  < 24) return `hace ${hs} h`;
  return `hace ${dias} d`;
}

export function estadoBackup() {
  const meta = getMeta();
  return {
    ultimoManual:  meta.lastBackup      || null,
    ultimoAuto:    meta.lastAutoBackup  || null,
    tieneAuto:     !!meta.lastAutoBackup,
    autoHabilitado: meta.autoBackupEnabled || false,
    frecuenciaAuto: meta.autoBackupDays   || 1,
  };
}

export function descargarBackup() {
  exportBackup();
  setMeta({ lastBackup: new Date().toISOString() });
}

// Sincrónico — restaura desde un string JSON al cache + Firestore via LS
export function restaurarDesdeTexto(texto) {
  try {
    const parsed = JSON.parse(texto);
    const { data } = assertRestorableData(parsed);
    let restaurados = 0;
    DATA_COLS.forEach((col) => {
      if (Array.isArray(data[col]) && data[col].length) {
        data[col].forEach((item) => { if (item.id) LS.setDoc(col, item.id, item); });
        restaurados++;
      }
    });
    return { ok: true, fecha: parsed.fecha || "desconocida", restaurados };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Sincrónico — restaura desde el auto backup en localStorage
export function restaurarAutoBackup() {
  try {
    const raw = localStorage.getItem("jbos_auto_backup");
    if (!raw) return { ok: false, error: "No hay auto backup disponible" };

    const result = restaurarDesdeTexto(raw);
    if (result.ok) setMeta({ lastAutoBackup: new Date().toISOString() });
    return result;
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export function debeAutoBackup() {
  return shouldAutoBackup();
}
