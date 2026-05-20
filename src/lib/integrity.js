import { DATA_COLS } from "./storage.js";

const LEGACY_MAP = { ordenes: "trabajos", serviciosCatalogo: "catalogoTareas" };

export function emptyDataSet() {
  return Object.fromEntries(DATA_COLS.map((col) => [col, []]));
}

export function normalizeBackupData(input) {
  if (!input || typeof input !== "object") return emptyDataSet();
  // Support { data: {...} } envelope and flat { col: [...] } formats
  const src =
    input.data && typeof input.data === "object" && !Array.isArray(input.data)
      ? input.data
      : input;
  const result = emptyDataSet();
  for (const col of DATA_COLS) {
    if (Array.isArray(src[col])) result[col] = [...src[col]];
  }
  // Legacy col names (ordenes → trabajos, serviciosCatalogo → catalogoTareas)
  for (const [oldCol, newCol] of Object.entries(LEGACY_MAP)) {
    if (Array.isArray(src[oldCol]) && result[newCol].length === 0) {
      result[newCol] = [...src[oldCol]];
    }
  }
  return result;
}

export function countItems(data) {
  return DATA_COLS.reduce(
    (sum, col) => sum + (Array.isArray(data[col]) ? data[col].length : 0),
    0
  );
}

export function buildDataIntegrityReport(data) {
  const errors = [];
  const warnings = [];
  const counts = Object.fromEntries(DATA_COLS.map((col) => [col, 0]));

  if (!data || typeof data !== "object") {
    errors.push("Estructura de datos invalida");
    return { ok: false, checkedAt: Date.now(), total: 0, counts, errors, warnings };
  }

  // Per-collection: item type + duplicate id
  for (const col of DATA_COLS) {
    const items = Array.isArray(data[col]) ? data[col] : [];
    counts[col] = items.length;
    const seenIds = new Set();
    for (const item of items) {
      if (!item || typeof item !== "object") {
        errors.push(`${col}: registro no es objeto`);
        continue;
      }
      if (!item.id) {
        warnings.push(`${col}: registro sin id`);
      } else if (seenIds.has(item.id)) {
        warnings.push(`${col}: id duplicado "${item.id}"`);
      } else {
        seenIds.add(item.id);
      }
    }
  }

  // Lookup sets for referential checks
  const clientIds = new Set(
    (data.clientes || []).filter((c) => c?.id).map((c) => c.id)
  );
  const bikeIds = new Set(
    (data.motos || []).filter((m) => m?.id).map((m) => m.id)
  );

  // Duplicate OT numbers
  const seenOTs = new Set();
  for (const t of data.trabajos || []) {
    if (!t?.id) continue;
    if (!t.numeroTrabajo) {
      warnings.push(`trabajos ${t.id}: OT sin numeroTrabajo`);
    } else if (seenOTs.has(t.numeroTrabajo)) {
      warnings.push(`trabajos: numeroTrabajo duplicado "${t.numeroTrabajo}"`);
    } else {
      seenOTs.add(t.numeroTrabajo);
    }
  }

  // Duplicate PRE numbers
  const seenPREs = new Set();
  for (const p of data.presupuestos || []) {
    if (!p?.id) continue;
    if (!p.numeroPresupuesto) {
      warnings.push(`presupuestos ${p.id}: PRE sin numeroPresupuesto`);
    } else if (seenPREs.has(p.numeroPresupuesto)) {
      warnings.push(`presupuestos: numeroPresupuesto duplicado "${p.numeroPresupuesto}"`);
    } else {
      seenPREs.add(p.numeroPresupuesto);
    }
  }

  // Referential: trabajos
  for (const t of data.trabajos || []) {
    if (!t?.id) continue;
    if (t.clientId && !clientIds.has(t.clientId))
      warnings.push(`trabajos ${t.id}: clientId inexistente`);
    if (t.bikeId && !bikeIds.has(t.bikeId))
      warnings.push(`trabajos ${t.id}: bikeId inexistente`);
  }

  // Referential: presupuestos
  for (const p of data.presupuestos || []) {
    if (!p?.id) continue;
    if (p.clientId && !clientIds.has(p.clientId))
      warnings.push(`presupuestos ${p.id}: clientId inexistente`);
    if (p.bikeId && !bikeIds.has(p.bikeId))
      warnings.push(`presupuestos ${p.id}: bikeId inexistente`);
  }

  // Referential: motos
  for (const m of data.motos || []) {
    if (!m?.id) continue;
    if (m.clienteId && !clientIds.has(m.clienteId))
      warnings.push(`motos ${m.id}: clienteId inexistente`);
  }

  // Referential: titularidades
  for (const t of data.titularidades || []) {
    if (!t?.id) continue;
    if (t.titularActual && (!t.motoId || !t.clienteId))
      warnings.push(`titularidades ${t.id}: titularActual sin motoId o clienteId`);
    if (t.clienteId && !clientIds.has(t.clienteId))
      warnings.push(`titularidades ${t.id}: clienteId inexistente`);
    if (t.motoId && !bikeIds.has(t.motoId))
      warnings.push(`titularidades ${t.id}: motoId inexistente`);
  }

  const total = countItems(data);
  return { ok: errors.length === 0, checkedAt: Date.now(), total, counts, errors, warnings };
}

export function assertRestorableData(rawData) {
  const data = normalizeBackupData(rawData);
  const report = buildDataIntegrityReport(data);
  if (!report.ok) throw new Error(`Backup invalido: ${report.errors.join("; ")}`);
  return { data, report };
}

export function countersFromData(data) {
  let maxOT = 0;
  for (const t of data.trabajos || []) {
    const m = String(t?.numeroTrabajo || "").match(/^OT-(\d+)$/);
    if (m) maxOT = Math.max(maxOT, parseInt(m[1], 10));
  }
  let maxPRE = 0;
  for (const p of data.presupuestos || []) {
    const m = String(p?.numeroPresupuesto || "").match(/^PRE-(\d+)$/);
    if (m) maxPRE = Math.max(maxPRE, parseInt(m[1], 10));
  }
  return { trabajos: maxOT, presupuestos: maxPRE };
}

export function buildBackupEnvelope(data, extra = {}) {
  const normalizedData = normalizeBackupData(data);
  const integrity = buildDataIntegrityReport(normalizedData);
  return {
    v: 3,
    schema: "motogestion-backup",
    fecha: new Date().toISOString(),
    total: integrity.total,
    integrity,
    data: normalizedData,
    ...extra,
  };
}
