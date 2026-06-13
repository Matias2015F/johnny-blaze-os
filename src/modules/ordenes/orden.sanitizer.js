function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

const SENSITIVE_KEY_PATTERNS = [
  /nombre/i,
  /apellido/i,
  /displayName/i,
  /razonSocial/i,
  /titular/i,
  /telefono/i,
  /celular/i,
  /email/i,
  /mail/i,
  /documento/i,
  /dni/i,
  /direccion/i,
  /domicilio/i,
  /dominio/i,
  /patente/i,
  /motor/i,
  /chasis/i,
  /token/i,
  /secret/i,
  /link/i,
  /url/i,
  /website/i,
  /sitio/i,
];

function looksLikePhone(value) {
  const text = String(value || "");
  return /\b(?:\+?\d[\d\s-]{6,}\d)\b/.test(text);
}

function looksLikeEmail(value) {
  return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(String(value || ""));
}

function looksLikePatente(value) {
  const text = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(text) || /^[A-Z]{3}\d{3}$/.test(text);
}

function looksLikeUrlOrDomain(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return false;
  return /^(https?:\/\/|ftp:\/\/)/.test(text) || /^[a-z0-9.-]+\.[a-z]{2,}(?:\/.*)?$/.test(text);
}

function sanitizeScalar(key, value) {
  if (value == null) return value;
  if (typeof value === "string") {
    if (looksLikeEmail(value)) return "[email oculto]";
    if (looksLikePhone(value)) return "[telefono oculto]";
    if (looksLikePatente(value)) return "AA000AA";
    if (looksLikeUrlOrDomain(value)) return "[link oculto]";
    if (String(key || "").match(/token|secret|link|url/i)) return "[dato oculto]";
    if (String(key || "").match(/motor|chasis|dominio/i)) return "[identificador oculto]";
  }
  return value;
}

function sanitizeValue(key, value) {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(key, item));
  }
  if (!value || typeof value !== "object") {
    return sanitizeScalar(key, value);
  }
  const output = {};
  Object.entries(value).forEach(([childKey, childValue]) => {
    if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(childKey))) {
      output[childKey] = sanitizeSensitiveByKey(childKey, childValue);
      return;
    }
    output[childKey] = sanitizeValue(childKey, childValue);
  });
  return output;
}

function sanitizeSensitiveByKey(key, value) {
  if (Array.isArray(value)) return value.map(() => "[dato oculto]");
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).map((childKey) => [childKey, "[dato oculto]"]));
  }
  if (String(key || "").match(/patente/i)) return "AA000AA";
  if (String(key || "").match(/motor|chasis/i)) return "[identificador oculto]";
  if (String(key || "").match(/dominio|website|sitio|link|url/i)) return "[link oculto]";
  if (String(key || "").match(/email/i)) return "[email oculto]";
  if (String(key || "").match(/telefono|celular/i)) return "[telefono oculto]";
  return "[dato oculto]";
}

export function eliminarDatosSensiblesOrden(legacyOrden = {}) {
  const orden = clone(legacyOrden) || {};
  return sanitizeValue("", orden);
}

export function sanitizarOrdenParaDiagnostico(legacyOrden = {}) {
  const sanitized = eliminarDatosSensiblesOrden(legacyOrden) || {};
  const base = clone(sanitized) || {};
  return {
    ...base,
    id: base.id || base.ordenId || base.workOrderId || "",
    clientId: base.clientId || base.clienteId || base.cliente?.id || base.cliente?.uid || "",
    clienteId: base.clienteId || base.clientId || base.cliente?.id || base.cliente?.uid || "",
    bikeId: base.bikeId || base.motoId || base.moto?.id || base.moto?.uid || "",
    motoId: base.motoId || base.bikeId || base.moto?.id || base.moto?.uid || "",
    tallerId: base.tallerId || base.workshopUid || base.taller?.id || base.taller?.uid || "",
  };
}

export function crearSnapshotDiagnosticoOrden(legacyOrden = {}) {
  const snapshot = sanitizarOrdenParaDiagnostico(legacyOrden);
  return Object.freeze({
    snapshot,
    metadata: {
      hasState: Boolean(snapshot.estado || snapshot.status),
      flags: {
        pagado: Boolean(snapshot.pagado || snapshot.cobrado),
        retirado: Boolean(snapshot.retirado || snapshot.motoRetirada),
      },
      counts: {
        tareas: Array.isArray(snapshot.trabajos) ? snapshot.trabajos.length : Array.isArray(snapshot.trabajosRealizados) ? snapshot.trabajosRealizados.length : 0,
        repuestos: Array.isArray(snapshot.repuestos) ? snapshot.repuestos.length : 0,
        pagos: Array.isArray(snapshot.pagos) ? snapshot.pagos.length : 0,
      },
    },
  });
}
