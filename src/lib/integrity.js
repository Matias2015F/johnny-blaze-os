import { DATA_COLS } from "./storage.js";

const OT_RE = /^OT-(\d+)$/i;
const PRE_RE = /^PRE-(\d+)$/i;

export function emptyDataSet() {
  return DATA_COLS.reduce((acc, col) => {
    acc[col] = [];
    return acc;
  }, {});
}

export function normalizeBackupData(input = {}) {
  const source = input?.data && typeof input.data === "object" ? input.data : input;
  const data = emptyDataSet();

  DATA_COLS.forEach((col) => {
    data[col] = Array.isArray(source?.[col]) ? source[col] : [];
  });

  // Compatibilidad con backups viejos.
  if (!data.trabajos.length && Array.isArray(source?.ordenes)) data.trabajos = source.ordenes;
  if (!data.catalogoTareas.length && Array.isArray(source?.serviciosCatalogo)) data.catalogoTareas = source.serviciosCatalogo;

  return data;
}

export function countItems(data = {}) {
  return DATA_COLS.reduce((acc, col) => acc + (Array.isArray(data[col]) ? data[col].length : 0), 0);
}

function addDuplicateWarnings(items, field, label, warnings) {
  const seen = new Map();
  items.forEach((item) => {
    const value = item?.[field];
    if (!value) return;
    if (seen.has(value)) warnings.push(`${label} duplicado: ${value}`);
    else seen.set(value, item.id);
  });
}

function asIdSet(items = []) {
  return new Set(items.map((item) => item?.id).filter(Boolean));
}

export function buildDataIntegrityReport(rawData = {}) {
  const data = normalizeBackupData(rawData);
  const counts = DATA_COLS.reduce((acc, col) => {
    acc[col] = Array.isArray(data[col]) ? data[col].length : 0;
    return acc;
  }, {});

  const errors = [];
  const warnings = [];

  DATA_COLS.forEach((col) => {
    if (!Array.isArray(data[col])) errors.push(`Coleccion invalida: ${col}`);
    const ids = new Set();
    data[col].forEach((item, index) => {
      if (!item || typeof item !== "object") {
        errors.push(`${col}[${index}] no es un objeto valido`);
        return;
      }
      if (!item.id) {
        warnings.push(`${col}[${index}] no tiene id y no se puede restaurar`);
        return;
      }
      if (ids.has(item.id)) warnings.push(`${col} tiene id duplicado: ${item.id}`);
      ids.add(item.id);
    });
  });

  const clientIds = asIdSet(data.clientes);
  const bikeIds = asIdSet(data.motos);

  data.trabajos.forEach((trabajo) => {
    if (trabajo.clientId && !clientIds.has(trabajo.clientId)) warnings.push(`Trabajo ${trabajo.numeroTrabajo || trabajo.id} referencia cliente inexistente`);
    if (trabajo.bikeId && !bikeIds.has(trabajo.bikeId)) warnings.push(`Trabajo ${trabajo.numeroTrabajo || trabajo.id} referencia moto inexistente`);
  });

  data.presupuestos.forEach((pres) => {
    if (pres.clientId && !clientIds.has(pres.clientId)) warnings.push(`Presupuesto ${pres.numeroPresupuesto || pres.id} referencia cliente inexistente`);
    if (pres.bikeId && !bikeIds.has(pres.bikeId)) warnings.push(`Presupuesto ${pres.numeroPresupuesto || pres.id} referencia moto inexistente`);
  });

  data.motos.forEach((moto) => {
    if (moto.clienteId && !clientIds.has(moto.clienteId)) warnings.push(`Moto ${moto.patente || moto.id} referencia cliente inexistente`);
  });

  data.titularidades.forEach((tit) => {
    if (tit.clienteId && !clientIds.has(tit.clienteId)) warnings.push(`Titularidad ${tit.id} referencia cliente inexistente`);
    if (tit.motoId && !bikeIds.has(tit.motoId)) warnings.push(`Titularidad ${tit.id} referencia moto inexistente`);
  });

  addDuplicateWarnings(data.trabajos, "numeroTrabajo", "Numero de OT", warnings);
  addDuplicateWarnings(data.presupuestos, "numeroPresupuesto", "Numero de presupuesto", warnings);

  return {
    ok: errors.length === 0,
    checkedAt: Date.now(),
    total: countItems(data),
    counts,
    errors,
    warnings,
  };
}

export function assertRestorableData(rawData = {}) {
  const data = normalizeBackupData(rawData);
  const report = buildDataIntegrityReport(data);
  if (!report.ok) {
    throw new Error(`Backup invalido: ${report.errors.join("; ")}`);
  }
  return { data, report };
}

function maxNumber(items = [], field, pattern) {
  return items.reduce((max, item) => {
    const match = String(item?.[field] || "").match(pattern);
    if (!match) return max;
    const n = Number(match[1] || 0);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
}

export function countersFromData(rawData = {}) {
  const data = normalizeBackupData(rawData);
  return {
    trabajos: maxNumber(data.trabajos, "numeroTrabajo", OT_RE),
    presupuestos: maxNumber(data.presupuestos, "numeroPresupuesto", PRE_RE),
  };
}

export function buildBackupEnvelope(data, extra = {}) {
  const normalized = normalizeBackupData(data);
  const integrity = buildDataIntegrityReport(normalized);
  return {
    v: 3,
    schema: "motogestion-backup",
    fecha: new Date().toISOString(),
    total: integrity.total,
    integrity,
    data: normalized,
    ...extra,
  };
}
