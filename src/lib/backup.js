import { LS } from "./storage.js";

const COLS = ["trabajos", "clientes", "motos", "caja", "config", "catalogoTareas"];
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
  COLS.forEach(col => { data[col] = LS.getAll(col); });
  const payload = JSON.stringify({ v: 1, fecha: new Date().toISOString(), data }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jbos-backup-${new Date().toLocaleDateString("sv-SE")}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  setMeta({ lastBackup: new Date().toISOString() });
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        const data = parsed.data || parsed;
        // Importar con nombres actuales
        COLS.forEach((col) => {
          if (Array.isArray(data[col])) {
            data[col].forEach((item) => { if (item.id) LS.setDoc(col, item.id, item); });
          }
        });
        // Compatibilidad con backups viejos (ordenes, serviciosCatalogo)
        Object.entries(LEGACY_MAP).forEach(([oldCol, newCol]) => {
          if (Array.isArray(data[oldCol]) && !data[newCol]) {
            data[oldCol].forEach((item) => { if (item.id) LS.setDoc(newCol, item.id, item); });
          }
        });
        resolve(parsed.fecha || "desconocida");
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
