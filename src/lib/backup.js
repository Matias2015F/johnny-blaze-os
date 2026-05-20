import { LS, DATA_COLS } from "./storage.js";
import { buildBackupEnvelope, assertRestorableData } from "./integrity.js";

// Mapa para leer backups antiguos (ordenes→trabajos, etc.)
const LEGACY_MAP = { ordenes: "trabajos", serviciosCatalogo: "catalogoTareas" };
const META_KEY = "jbos_backup_meta";

export function getMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY) || "{}"); }
  catch { return {}; }
}

export function setMeta(patch) {
  localStorage.setItem(META_KEY, JSON.stringify({ ...getMeta(), ...patch }));
}

export function exportBackup() {
  const data = {};
  DATA_COLS.forEach((col) => { data[col] = LS.getAll(col); });
  const envelope = buildBackupEnvelope(data, { source: "local" });
  const payload = JSON.stringify(envelope, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `motogestion-backup-${new Date().toLocaleDateString("sv-SE")}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  setMeta({
    lastBackup: new Date().toISOString(),
    lastBackupTotal: envelope.total,
    lastBackupWarnings: envelope.integrity.warnings.length,
  });
  return envelope.integrity;
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        let data, report;
        try {
          ({ data, report } = assertRestorableData(parsed));
        } catch (err) {
          return reject(err);
        }
        // Merge/sobrescritura por id — no borra datos existentes
        DATA_COLS.forEach((col) => {
          if (Array.isArray(data[col])) {
            data[col].forEach((item) => { if (item.id) LS.setDoc(col, item.id, item); });
          }
        });
        // Compatibilidad con backups viejos no capturados por normalizeBackupData
        Object.entries(LEGACY_MAP).forEach(([oldCol, newCol]) => {
          const src = parsed.data?.[oldCol] ?? parsed[oldCol];
          if (Array.isArray(src) && data[newCol].length === 0) {
            src.forEach((item) => { if (item.id) LS.setDoc(newCol, item.id, item); });
          }
        });
        setMeta({
          lastImport: new Date().toISOString(),
          lastImportTotal: report.total,
          lastImportWarnings: report.warnings.length,
        });
        resolve({ fecha: parsed.fecha || "desconocida", report });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

export function shouldAutoBackup() {
  const meta = getMeta();
  if (!meta.autoBackupEnabled) return false;
  if (!meta.lastBackup) return true;
  const days = meta.autoBackupDays || 1;
  const diff = (Date.now() - new Date(meta.lastBackup).getTime()) / 86400000;
  return diff >= days;
}
