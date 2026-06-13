const BUSINESS_DECISION_STATE = "DECIDED";
const BUSINESS_DECISION_VERSION = 1;
const APPROVED_BY = "PRODUCT_OWNER";

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach((item) => freeze(item));
  return value;
}

function createDecision(decision) {
  return freeze({
    operationallyEnforced: false,
    approvedBy: APPROVED_BY,
    decisionVersion: BUSINESS_DECISION_VERSION,
    decisionState: BUSINESS_DECISION_STATE,
    ...decision,
  });
}

export const ORDEN_ESTADOS_CANONICOS_NUEVOS = freeze([
  "ESPERANDO_APROBACION_ADICIONAL",
  "BLOQUEADA_POR_LIMITE_PRESUPUESTARIO",
]);

export const ORDEN_BUSINESS_DECISION_RULE_IDS = freeze([
  "ORDER_PRESUPUESTO_PENDIENTE_NEXT_ACTION",
  "ORDER_PRESUPUESTO_APROBADO_NEXT_ACTION",
  "ORDER_ADDITIONAL_PENDING_NEXT_ACTION",
  "ORDER_ADDITIONAL_AUTHORIZED_NEXT_ACTION",
  "ORDER_WORK_IN_PROGRESS_NEXT_ACTION",
  "ORDER_BUDGET_LIMIT_BLOCK",
  "ORDER_READY_FOR_PAYMENT_PENDING_COLLECTION",
  "ORDER_UNKNOWN_INCONSISTENT_STATE",
]);

export const ORDEN_BUSINESS_DECISIONS = freeze([
  createDecision({
    ruleId: "ORDER_PRESUPUESTO_PENDIENTE_NEXT_ACTION",
    caseKey: "presupuestoPendiente",
    canonicalState: "PRESUPUESTADO",
    nextAction: "ENVIAR_O_REENVIAR_PRESUPUESTO",
    pdfPolicy: "BLOCKED_PRE_APPROVAL",
    requiresManualReview: false,
    auditRequirements: [
      "registrar presupuesto vigente",
      "registrar respuesta del cliente",
      "no iniciar trabajos no autorizados",
    ],
  }),
  createDecision({
    ruleId: "ORDER_PRESUPUESTO_APROBADO_NEXT_ACTION",
    caseKey: "presupuestoAprobado",
    canonicalState: "AUTORIZADO",
    nextAction: "INICIAR_TRABAJO",
    pdfPolicy: "BLOCKED_IN_REPAIR",
    requiresManualReview: false,
    auditRequirements: [
      "congelar la version aprobada",
      "registrar el inicio de trabajo",
      "conservar trazabilidad de la aprobacion",
    ],
  }),
  createDecision({
    ruleId: "ORDER_ADDITIONAL_PENDING_NEXT_ACTION",
    caseKey: "adicionalPendiente",
    canonicalState: "ESPERANDO_APROBACION_ADICIONAL",
    nextAction: "SOLICITAR_AUTORIZACION_ADICIONAL",
    pdfPolicy: "BLOCKED_ADDITIONAL_PENDING",
    requiresManualReview: false,
    auditRequirements: [
      "bloquear tareas y costos dependientes",
      "permitir solo trabajo separable y seguro",
      "registrar alcance adicional pendiente",
    ],
  }),
  createDecision({
    ruleId: "ORDER_ADDITIONAL_AUTHORIZED_NEXT_ACTION",
    caseKey: "adicionalAutorizado",
    canonicalState: "EN_REPARACION",
    nextAction: "EJECUTAR_ADICIONAL_AUTORIZADO",
    pdfPolicy: "BLOCKED_ADDITIONAL_AUTHORIZED",
    requiresManualReview: false,
    auditRequirements: [
      "quien autorizo",
      "fecha y hora",
      "canal",
      "importe",
      "nueva version de presupuesto",
      "conservacion de la version anterior",
    ],
  }),
  createDecision({
    ruleId: "ORDER_WORK_IN_PROGRESS_NEXT_ACTION",
    caseKey: "trabajoEnProgreso",
    canonicalState: "EN_REPARACION",
    nextAction: "REGISTRAR_AVANCE_O_COMPLETAR_TAREAS",
    pdfPolicy: "BLOCKED_WORK_IN_PROGRESS",
    requiresManualReview: false,
    auditRequirements: [
      "registrar avances del trabajo",
      "no permitir cierre documental",
      "no permitir PDF final",
    ],
  }),
  createDecision({
    ruleId: "ORDER_BUDGET_LIMIT_BLOCK",
    caseKey: "bloqueoPresupuestario",
    canonicalState: "BLOQUEADA_POR_LIMITE_PRESUPUESTARIO",
    nextAction: "CREAR_ADICIONAL_Y_SOLICITAR_AUTORIZACION",
    pdfPolicy: "BLOCKED_BUDGET_LIMIT",
    requiresManualReview: false,
    auditRequirements: [
      "bloquear nuevas tareas que aumenten el costo",
      "permitir revision diagnostica",
      "permitir preparacion de adicional auditable",
    ],
  }),
  createDecision({
    ruleId: "ORDER_READY_FOR_PAYMENT_PENDING_COLLECTION",
    caseKey: "finalizadaPendienteCobro",
    canonicalState: "PENDIENTE_PAGO",
    nextAction: "REGISTRAR_PAGO",
    pdfPolicy: "BLOCKED_PAYMENT_PENDING",
    requiresManualReview: false,
    auditRequirements: [
      "confirmar pago total antes de entregar",
      "no emitir PDF final sin cobro completo",
      "registrar medio y monto del pago",
    ],
  }),
  createDecision({
    ruleId: "ORDER_UNKNOWN_INCONSISTENT_STATE",
    caseKey: "estadoInconsistente",
    canonicalState: null,
    nextAction: "REVISAR_Y_REPARAR_DATOS",
    pdfPolicy: "MANUAL_REVIEW_REQUIRED",
    requiresManualReview: true,
    reason: "INCONSISTENT_LEGACY_STATE",
    auditRequirements: [
      "conservar valores legacy originales",
      "bloquear transiciones criticas",
      "revisar y reparar datos antes de transicionar",
    ],
  }),
]);

export const ORDEN_BUSINESS_DECISIONS_BY_RULE_ID = freeze(
  Object.fromEntries(ORDEN_BUSINESS_DECISIONS.map((decision) => [decision.ruleId, decision])),
);

export const ORDEN_BUSINESS_DECISIONS_BY_CASE_KEY = freeze(
  Object.fromEntries(ORDEN_BUSINESS_DECISIONS.map((decision) => [decision.caseKey, decision])),
);

export function obtenerDecisionNegocioOrdenPorRuleId(ruleId = "") {
  return ORDEN_BUSINESS_DECISIONS_BY_RULE_ID[ruleId] || null;
}

export function obtenerDecisionNegocioOrdenPorCaseKey(caseKey = "") {
  return ORDEN_BUSINESS_DECISIONS_BY_CASE_KEY[caseKey] || null;
}

export function resolverDecisionNegocioOrden({ ruleId = "", caseKey = "" } = {}) {
  return obtenerDecisionNegocioOrdenPorRuleId(ruleId) || obtenerDecisionNegocioOrdenPorCaseKey(caseKey) || null;
}

