import { getOrdenShadowBusinessRuleState } from "../../shared/policies/ordenShadowActivationPolicy.js";

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach((item) => freeze(item));
  return value;
}

export const ORDEN_SHADOW_PENDING_RULES = freeze([
  freeze({
    ruleId: "ORDER_PRESUPUESTO_PENDIENTE_NEXT_ACTION",
    status: "undefined",
    affectedCases: ["presupuestoPendiente"],
    fallback: "indeterminate",
  }),
  freeze({
    ruleId: "ORDER_PRESUPUESTO_APROBADO_NEXT_ACTION",
    status: "undefined",
    affectedCases: ["presupuestoAprobado"],
    fallback: "indeterminate",
  }),
  freeze({
    ruleId: "ORDER_ADDITIONAL_PENDING_NEXT_ACTION",
    status: "undefined",
    affectedCases: ["adicionalPendiente"],
    fallback: "indeterminate",
  }),
  freeze({
    ruleId: "ORDER_ADDITIONAL_AUTHORIZED_NEXT_ACTION",
    status: "undefined",
    affectedCases: ["adicionalAutorizado"],
    fallback: "indeterminate",
  }),
  freeze({
    ruleId: "ORDER_WORK_IN_PROGRESS_NEXT_ACTION",
    status: "undefined",
    affectedCases: ["trabajoEnProgreso"],
    fallback: "indeterminate",
  }),
  freeze({
    ruleId: "ORDER_BUDGET_LIMIT_BLOCK",
    status: "undefined",
    affectedCases: ["bloqueoPresupuestario"],
    fallback: "indeterminate",
  }),
  freeze({
    ruleId: "ORDER_READY_FOR_PAYMENT_PENDING_COLLECTION",
    status: "undefined",
    affectedCases: ["finalizadaPendienteCobro"],
    fallback: "indeterminate",
  }),
  freeze({
    ruleId: "ORDER_UNKNOWN_INCONSISTENT_STATE",
    status: "undefined",
    affectedCases: ["estadoInconsistente"],
    fallback: "indeterminate",
  }),
]);

export function obtenerPendingRulePorCaseKey(caseKey = "") {
  return ORDEN_SHADOW_PENDING_RULES.find((rule) => rule.affectedCases.includes(caseKey)) || null;
}

export function resolverEstadoReglaNegocioShadow({
  classification,
  caseKey,
} = {}) {
  const rule = obtenerPendingRulePorCaseKey(caseKey);
  return getOrdenShadowBusinessRuleState({
    classification,
    caseKey,
    ruleId: rule?.ruleId || "",
    affectedCases: rule?.affectedCases || [],
  });
}

