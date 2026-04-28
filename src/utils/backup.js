// Wrapper de backup.js (en inglés) para compatibilidad con ConfigView.jsx
// Este archivo actúa como capa de traducción entre los nombres en español
// que usa la UI y las funciones reales en inglés de ../lib/backup.js

import {
  exportBackup,
  importBackup,
  getMeta,
  setMeta,
  shouldAutoBackup
} from "../lib/backup.js";

/**
 * Formatea un timestamp ISO en texto relativo (ej: "hace 2 días")
 */
export function tiempoDesde(timestamp) {
  if (!timestamp) return null;
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diff = now - then;

  const minutos = Math.floor(diff / 60000);
  const horas = Math.floor(diff / 3600000);
  const dias = Math.floor(diff / 86400000);

  if (minutos < 1) return "ahora mismo";
  if (minutos < 60) return `hace ${minutos} min`;
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${dias} d`;
}

/**
 * Obtiene el estado actual de los backups
 * @returns {object} Estado con ultimoManual, ultimoAuto, autoHabilitado
 */
export function estadoBackup() {
  const meta = getMeta();
  return {
    ultimoManual: meta.lastBackup || null,
    ultimoAuto: meta.lastAutoBackup || null,
    autoHabilitado: meta.autoBackupEnabled || false,
    frecuenciaAuto: meta.autoBackupDays || 1
  };
}

/**
 * Descarga una copia de seguridad (wrapper de exportBackup)
 */
export function descargarBackup() {
  exportBackup();
}

/**
 * Restaura desde un string JSON
 * @param {string} texto - Contenido JSON del backup
 * @returns {object} Resultado con ok, fecha, errores
 */
export function restaurarDesdeTexto(texto) {
  return new Promise((resolve) => {
    try {
      const parsed = JSON.parse(texto);
      const data = parsed.data || parsed;
      const cols = ["clientes", "motos", "ordenes", "config", "caja", "serviciosCatalogo"];
      
      cols.forEach((col) => {
        if (Array.isArray(data[col])) {
          data[col].forEach((item) => {
            if (item.id) {
              const storage = window.localStorage;
              const key = `j bos_${col}_${item.id}`;
              storage.setItem(key, JSON.stringify(item));
            }
          });
        }
      });

      resolve({
        ok: true,
        fecha: parsed.fecha || "desconocida",
        items: cols.reduce((sum, col) => sum + (data[col]?.length || 0), 0)
      });
    } catch (err) {
      resolve({
        ok: false,
        error: err.message
      });
    }
  });
}

/**
 * Restaura desde el auto backup guardado
 * @returns {object} Resultado con ok, fecha, errores
 */
export function restaurarAutoBackup() {
  return new Promise((resolve) => {
    try {
      const autoKey = "jbos_auto_backup";
      const storage = window.localStorage;
      const autoData = storage.getItem(autoKey);

      if (!autoData) {
        resolve({
          ok: false,
          error: "No hay auto backup disponible"
        });
        return;
      }

      const parsed = JSON.parse(autoData);
      const data = parsed.data || parsed;
      const cols = ["clientes", "motos", "ordenes", "config", "caja", "serviciosCatalogo"];

      cols.forEach((col) => {
        if (Array.isArray(data[col])) {
          data[col].forEach((item) => {
            if (item.id) {
              const key = `j bos_${col}_${item.id}`;
              storage.setItem(key, JSON.stringify(item));
            }
          });
        }
      });

      setMeta({ lastAutoBackup: new Date().toISOString() });

      resolve({
        ok: true,
        fecha: parsed.fecha || "desconocida",
        items: cols.reduce((sum, col) => sum + (data[col]?.length || 0), 0)
      });
    } catch (err) {
      resolve({
        ok: false,
        error: err.message
      });
    }
  });
}

/**
 * Verifica si se debe hacer un auto backup
 */
export function debeAutoBackup() {
  return shouldAutoBackup();
}
