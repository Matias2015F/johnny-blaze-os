import { mapLegacyOrdenToDomainOrden } from "./orden.adapter.js";
import { prepararDecisionPdfOrden, prepararEstadoOrdenParaVista } from "./orden.applicationService.js";
import { crearResumenShadowOrden } from "./orden.shadowIntegration.js";
import { sanitizarOrdenParaDiagnostico } from "./orden.sanitizer.js";

const KNOWN_FIELDS = new Set([
  "id",
  "ordenId",
  "workOrderId",
  "uid",
  "key",
  "estado",
  "status",
  "state",
  "clientId",
  "clienteId",
  "cliente",
  "bikeId",
  "motoId",
  "moto",
  "tallerId",
  "workshopUid",
  "taller",
  "pagado",
  "cobrado",
  "retirado",
  "motoRetirada",
  "entregado",
  "cobradaPendienteRetiro",
  "garantia",
  "garantiaFinal",
  "garantiaTexto",
  "excepciones",
  "observaciones",
  "recomendaciones",
  "trabajos",
  "trabajosRealizados",
  "repuestos",
  "pagos",
  "cierreRechazo",
  "garantiaFinal",
  "garantiaTexto",
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value || value === 0 || value === false);
}

function collectFields(value, prefix = "", output = new Set()) {
  if (!value || typeof value !== "object") return output;
  Object.keys(value).forEach((key) => {
    const path = prefix ? `${prefix}.${key}` : key;
    output.add(path);
    collectFields(value[key], path, output);
  });
  return output;
}

function collectTopLevelKnownFields(orden = {}) {
  return Object.keys(orden || {}).filter((key) => KNOWN_FIELDS.has(key));
}

export function detectarCamposLegacyNoReconocidos(legacyOrden = {}) {
  const fields = Object.keys(legacyOrden || {});
  return fields.filter((field) => !KNOWN_FIELDS.has(field));
}

export function detectarCamposCriticosAusentes(legacyOrden = {}) {
  const orden = legacyOrden || {};
  const ausentes = [];
  if (!hasValue(orden.estado) && !hasValue(orden.status)) ausentes.push("estado");
  if (!hasValue(orden.clientId) && !hasValue(orden.clienteId) && !hasValue(orden.cliente)) ausentes.push("cliente");
  if (!hasValue(orden.bikeId) && !hasValue(orden.motoId) && !hasValue(orden.moto)) ausentes.push("moto");
  if (!hasValue(orden.tallerId) && !hasValue(orden.workshopUid) && !hasValue(orden.taller)) ausentes.push("taller");
  return ausentes;
}

export function crearReporteCompatibilidadOrden(legacyOrden = {}) {
  const sanitized = sanitizarOrdenParaDiagnostico(legacyOrden);
  const domainOrden = mapLegacyOrdenToDomainOrden(sanitized);
  const decisionPdf = prepararDecisionPdfOrden(sanitized);
  const estado = prepararEstadoOrdenParaVista(sanitized);
  const shadow = crearResumenShadowOrden(sanitized);
  const camposNoReconocidos = detectarCamposLegacyNoReconocidos(legacyOrden);
  const camposCriticosAusentes = detectarCamposCriticosAusentes(legacyOrden);
  const fieldsSeen = Array.from(collectFields(legacyOrden));
  const camposReconocidos = collectTopLevelKnownFields(legacyOrden);

  const incompatible = camposCriticosAusentes.length > 0 || !hasValue(domainOrden.estado);
  const compatible = camposCriticosAusentes.length === 0 && !incompatible;
  const nivel = incompatible ? "INCOMPATIBLE" : camposNoReconocidos.length > 0 || !decisionPdf.permitido ? "WARNING" : "OK";

  return {
    compatible,
    nivel,
    camposReconocidos,
    camposNoReconocidos,
    camposCriticosAusentes,
    decisionPdf,
    proximaAccion: estado.proximaAccion,
    warnings: [...new Set([...(shadow.warnings || []), ...(decisionPdf.permitido ? [] : ["PDF_BLOQUEADO"])])],
    snapshotSanitizado: clone(sanitized),
    fieldsSeen,
    shadow,
  };
}

export function auditarCompatibilidadOrdenLegacy(legacyOrden = {}) {
  return crearReporteCompatibilidadOrden(legacyOrden);
}
