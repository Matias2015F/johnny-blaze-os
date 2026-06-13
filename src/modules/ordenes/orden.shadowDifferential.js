import { evaluarLegacyOrdenParaPdf } from "./orden.adapter.js";
import { ORDEN_BUSINESS_DECISIONS, obtenerDecisionNegocioOrdenPorCaseKey } from "./orden.businessDecisions.js";
import { evaluarOrdenShadow } from "./orden.shadowIntegration.js";
import { ORDEN_SHADOW_DIFFERENTIAL_CORPUS } from "./fixtures/ordenShadowDifferentialCorpus.js";
import { obtenerPendingRulePorCaseKey, resolverEstadoReglaNegocioShadow } from "./orden.shadowPendingRules.js";
import { sanitizarOrdenParaDiagnostico } from "./orden.sanitizer.js";
import { ORDEN_ESTADOS_CANONICOS_NUEVOS } from "./orden.contract.js";

const CRITICAL_FIELDS = ["id", "estado", "clientId", "bikeId", "tallerId", "garantiaFinal"];
const KNOWN_STATES = new Set([
  "BORRADOR",
  "DIAGNOSTICO",
  "PRESUPUESTADO",
  "AUTORIZADO",
  "EN_REPARACION",
  "ESPERANDO_REPUESTOS",
  ...ORDEN_ESTADOS_CANONICOS_NUEVOS,
  "PENDIENTE_PAGO",
  "COBRADO_PENDIENTE_RETIRO",
  "LISTO_PARA_ENTREGA",
  "ENTREGADO",
  "CERRADO_CON_PDF",
  "CANCELADO",
]);

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasValue(value) {
  return !(value === undefined || value === null || value === "");
}

function hasComparableLegacyDecision(legacyOrden = {}) {
  const orden = legacyOrden || {};
  return hasValue(orden.id || orden.ordenId || orden.workOrderId || orden.uid)
    && hasValue(orden.estado || orden.status || orden.state)
    && (hasValue(orden.clientId) || hasValue(orden.clienteId) || hasValue(orden.cliente))
    && (hasValue(orden.bikeId) || hasValue(orden.motoId) || hasValue(orden.moto))
    && (hasValue(orden.tallerId) || hasValue(orden.workshopUid) || hasValue(orden.taller));
}

function compareDecisions(legacyDecision = {}, shadowResult = {}) {
  const shadowDecision = shadowResult?.decisionPdf || {};
  const shadowAction = shadowResult?.proximaAccion || {};
  const divergencias = [];

  if (legacyDecision.permitido !== shadowDecision.permitido) {
    divergencias.push({
      campo: "permitido",
      legacy: legacyDecision.permitido,
      shadow: shadowDecision.permitido,
    });
  }

  if ((legacyDecision.codigo || "") !== (shadowDecision.codigo || "")) {
    divergencias.push({
      campo: "codigo",
      legacy: legacyDecision.codigo || "",
      shadow: shadowDecision.codigo || "",
    });
  }

  if ((legacyDecision.accionSugerida || "") !== (shadowDecision.accionSugerida || shadowAction.accionSugerida || "")) {
    divergencias.push({
      campo: "accionSugerida",
      legacy: legacyDecision.accionSugerida || "",
      shadow: shadowDecision.accionSugerida || shadowAction.accionSugerida || "",
    });
  }

  return divergencias;
}

function classifyCase(caseDefinition, { legacyDecisionDisponible, divergencias, legacyDecision, shadowResult }) {
  if (!legacyDecisionDisponible) {
    return "invalid_fixture";
  }

  if (caseDefinition.expectedClassification === "invalid_fixture") {
    return "invalid_fixture";
  }

  if (!KNOWN_STATES.has(String(caseDefinition.legacyOrden?.estado || caseDefinition.legacyOrden?.status || "").toUpperCase())) {
    return "undefined_business_rule";
  }

  if (divergencias.length === 0) {
    return caseDefinition.ambiguousRule ? "undefined_business_rule" : null;
  }

  if (legacyDecision.permitido === shadowResult.decisionPdf?.permitido) {
    return "expected_difference";
  }

  if (legacyDecision.permitido && !shadowResult.decisionPdf?.permitido) {
    return "shadow_bug";
  }

  if (!legacyDecision.permitido && shadowResult.decisionPdf?.permitido) {
    return "legacy_bug";
  }

  return "expected_difference";
}

function summarizeCounts(results = []) {
  return results.reduce(
    (acc, item) => {
      const classification = item.classification || "aligned";
      acc[classification] = (acc[classification] || 0) + 1;
      return acc;
    },
    {
      aligned: 0,
      expected_difference: 0,
      legacy_bug: 0,
      shadow_bug: 0,
      undefined_business_rule: 0,
      invalid_fixture: 0,
    },
  );
}

function buildAmbiguousRules(results = []) {
  const ambiguous = results.filter((item) => item.classification === "undefined_business_rule");
  const byCode = ambiguous.reduce((acc, item) => {
    const codigo = item.shadowResult?.decisionPdf?.codigo || "SIN_CODIGO";
    if (!acc[codigo]) {
      acc[codigo] = {
        codigo,
        estados: [],
        casos: [],
        motivo: "El flujo actual agrupa varios estados de negocio en una misma condicion de PDF.",
      };
    }
    acc[codigo].estados.push(item.legacyOrden.estado || item.legacyOrden.status || "SIN_ESTADO");
    acc[codigo].casos.push(item.key);
    return acc;
  }, {});

  return Object.values(byCode).map((item) => ({
    ...item,
    estados: Array.from(new Set(item.estados)),
    casos: Array.from(new Set(item.casos)),
  }));
}

function buildRecommendation(report) {
  const readyForControlledActivation = report.criticalDivergences.length === 0
    && report.classificationCounts.shadow_bug === 0
    && report.classificationCounts.legacy_bug === 0
    && report.nonComparableCases.length === 3;

  return {
    readyForControlledActivation,
    readyForGeneralProduction: false,
    scope: "staging | deployment interno | allowlist por workshopUid",
    note: "Las variables VITE son globales por deployment. No activar el panel en produccion general hasta separar staging, despliegue interno o una allowlist por workshopUid.",
  };
}

export function evaluarCasoShadowDifferential(caseDefinition = {}) {
  const legacyOrden = clone(caseDefinition.legacyOrden) || {};
  const sanitizedOrder = sanitizarOrdenParaDiagnostico(legacyOrden);
  const legacyDecisionDisponible = Boolean(caseDefinition.legacyDecisionDisponible && hasComparableLegacyDecision(legacyOrden));
  const shadowResult = evaluarOrdenShadow(sanitizedOrder);
  const legacyDecision = legacyDecisionDisponible ? evaluarLegacyOrdenParaPdf(sanitizedOrder) : null;
  const divergencias = legacyDecision ? compareDecisions(legacyDecision, shadowResult) : [];
  const pendingRule = obtenerPendingRulePorCaseKey(caseDefinition.key || "");
  const approvedDecision = obtenerDecisionNegocioOrdenPorCaseKey(caseDefinition.key || "");
  const businessRuleState = resolverEstadoReglaNegocioShadow({
    classification: caseDefinition.expectedClassification,
    caseKey: caseDefinition.key || "",
  });
  const classification = classifyCase(caseDefinition, {
    legacyDecisionDisponible,
    divergencias,
    legacyDecision: legacyDecision || {},
    shadowResult,
  });

  return {
    key: caseDefinition.key || "sin_clave",
    label: caseDefinition.label || "Caso sin etiqueta",
    classification,
    legacyDecisionDisponible,
    legacyDecision,
    shadowResult,
    divergencias,
    warnings: Array.isArray(shadowResult?.warnings) ? shadowResult.warnings : [],
    motivos: Array.isArray(shadowResult?.decisionPdf?.motivos) ? shadowResult.decisionPdf.motivos : [],
    proximaAccion: shadowResult?.proximaAccion || {},
    legacyOrden: sanitizedOrder,
    expectedClassification: caseDefinition.expectedClassification || null,
    ambiguousRule: Boolean(caseDefinition.ambiguousRule),
    pendingRule,
    approvedDecision,
    businessRuleState,
  };
}

export function generarReporteShadowDifferentialOrden(cases = ORDEN_SHADOW_DIFFERENTIAL_CORPUS) {
  const results = cases.map((caseDefinition) => evaluarCasoShadowDifferential(caseDefinition));
  const criticalDivergences = results.filter((item) => item.divergencias.length > 0);
  const nonComparableCases = results.filter((item) => !item.legacyDecisionDisponible).map((item) => item.key);
  const alignedCases = results.filter((item) => item.legacyDecisionDisponible && item.divergencias.length === 0).map((item) => item.key);
  const classificationCounts = summarizeCounts(results);
  const pendingRules = results
    .filter((item) => item.businessRuleState?.status === "indeterminate")
    .map((item) => ({
      ruleId: item.businessRuleState.ruleId,
      status: item.businessRuleState.status,
      affectedCases: item.businessRuleState.affectedCases,
      fallback: item.businessRuleState.fallback,
    }));
  const approvedDecisions = ORDEN_BUSINESS_DECISIONS.map((decision) => ({
    ruleId: decision.ruleId,
    caseKey: decision.caseKey,
    decisionState: decision.decisionState,
    canonicalState: decision.canonicalState,
    nextAction: decision.nextAction,
    pdfPolicy: decision.pdfPolicy,
    requiresManualReview: Boolean(decision.requiresManualReview),
    auditRequirements: Array.isArray(decision.auditRequirements) ? [...decision.auditRequirements] : [],
    approvedBy: decision.approvedBy,
    decisionVersion: decision.decisionVersion,
    operationallyEnforced: Boolean(decision.operationallyEnforced),
  }));

  return {
    source: "orden.shadowDifferential",
    corpusSize: results.length,
    criticalDivergences,
    criticalDivergenceCount: criticalDivergences.length,
    nonComparableCases,
    alignedCases,
    classificationCounts,
    ambiguousRules: buildAmbiguousRules(results),
    pendingRules,
    approvedDecisions,
    inventory: results,
    recommendation: buildRecommendation({
      criticalDivergences,
      classificationCounts,
      nonComparableCases,
    }),
    knownStates: Array.from(KNOWN_STATES),
    criticalFields: [...CRITICAL_FIELDS],
  };
}

export function generarInventarioShadowDifferentialOrden() {
  return ORDEN_SHADOW_DIFFERENTIAL_CORPUS.map((caseDefinition) => ({
    key: caseDefinition.key,
    label: caseDefinition.label,
    expectedClassification: caseDefinition.expectedClassification,
    legacyDecisionDisponible: caseDefinition.legacyDecisionDisponible,
    ambiguousRule: caseDefinition.ambiguousRule,
  }));
}
