import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ORDEN_SHADOW_DIFFERENTIAL_CORPUS } from "./fixtures/ordenShadowDifferentialCorpus.js";
import { ORDEN_SHADOW_PENDING_RULES, obtenerPendingRulePorCaseKey, resolverEstadoReglaNegocioShadow } from "./orden.shadowPendingRules.js";

const EXPECTED_RULE_IDS = [
  "ORDER_PRESUPUESTO_PENDIENTE_NEXT_ACTION",
  "ORDER_PRESUPUESTO_APROBADO_NEXT_ACTION",
  "ORDER_ADDITIONAL_PENDING_NEXT_ACTION",
  "ORDER_ADDITIONAL_AUTHORIZED_NEXT_ACTION",
  "ORDER_WORK_IN_PROGRESS_NEXT_ACTION",
  "ORDER_BUDGET_LIMIT_BLOCK",
  "ORDER_READY_FOR_PAYMENT_PENDING_COLLECTION",
  "ORDER_UNKNOWN_INCONSISTENT_STATE",
];

const PENDING_CASE_KEYS = ORDEN_SHADOW_DIFFERENTIAL_CORPUS
  .filter((item) => item.expectedClassification === "undefined_business_rule")
  .map((item) => item.key);

const INVALID_CASE_KEYS = ORDEN_SHADOW_DIFFERENTIAL_CORPUS
  .filter((item) => item.expectedClassification === "invalid_fixture")
  .map((item) => item.key);

const PENDING_DOC_PATH = new URL("../../../docs/business-rules/orden-shadow-pending-rules.md", import.meta.url);
const MATRIX_DOC_PATH = new URL("../../../docs/business-rules/orden-shadow-decision-matrix.md", import.meta.url);
const INVALID_DOC_PATH = new URL("../../../docs/business-rules/orden-shadow-invalid-fixtures.md", import.meta.url);

function assertPendingRuleShape(rule) {
  if (!rule.ruleId) throw new Error("ruleId requerido");
  if (rule.status !== "undefined") throw new Error("status invalido");
  if (rule.fallback !== "indeterminate") throw new Error("fallback invalido");
  if (!Array.isArray(rule.affectedCases) || rule.affectedCases.length === 0) {
    throw new Error("affectedCases invalido");
  }
}

describe("orden.shadowPendingRules", () => {
  it("expone ocho reglas unicas y con orden estable", () => {
    expect(ORDEN_SHADOW_PENDING_RULES).toHaveLength(8);
    expect(ORDEN_SHADOW_PENDING_RULES.map((rule) => rule.ruleId)).toEqual(EXPECTED_RULE_IDS);
  });

  it("mantiene reglas con fallback indeterminate y casos unicos", () => {
    const ruleIds = new Set();
    const caseKeys = new Set();

    ORDEN_SHADOW_PENDING_RULES.forEach((rule) => {
      assertPendingRuleShape(rule);
      expect(ruleIds.has(rule.ruleId)).toBe(false);
      ruleIds.add(rule.ruleId);
      rule.affectedCases.forEach((caseKey) => {
        expect(caseKeys.has(caseKey)).toBe(false);
        caseKeys.add(caseKey);
      });
    });
  });

  it("las reglas indeterminadas siempre devuelven indeterminate y no una decision operativa", () => {
    PENDING_CASE_KEYS.forEach((caseKey) => {
      const state = resolverEstadoReglaNegocioShadow({
        classification: "undefined_business_rule",
        caseKey,
      });

      expect(state.status).toBe("indeterminate");
      expect(state.reason).toBe("UNDEFINED_BUSINESS_RULE");
      expect(state.fallback).toBe("indeterminate");
      expect(["approved", "blocked", "continue"]).not.toContain(state.status);
      expect(obtenerPendingRulePorCaseKey(caseKey)?.ruleId).toBeTruthy();
    });
  });

  it("los fixtures invalidos no se registran como reglas pendientes", () => {
    INVALID_CASE_KEYS.forEach((caseKey) => {
      expect(obtenerPendingRulePorCaseKey(caseKey)).toBeNull();
    });
  });

  it("una regla sin ruleId falla la validacion", () => {
    expect(() => assertPendingRuleShape({
      ...ORDEN_SHADOW_PENDING_RULES[0],
      ruleId: "",
    })).toThrow("ruleId");
  });

  it("la documentacion contiene las reglas y el estado UNRESOLVED", () => {
    const pendingDoc = readFileSync(PENDING_DOC_PATH, "utf8");
    const matrixDoc = readFileSync(MATRIX_DOC_PATH, "utf8");
    const invalidDoc = readFileSync(INVALID_DOC_PATH, "utf8");

    EXPECTED_RULE_IDS.forEach((ruleId) => {
      expect(pendingDoc).toContain(ruleId);
      expect(matrixDoc).toContain(ruleId);
    });

    PENDING_CASE_KEYS.forEach((caseKey) => {
      expect(pendingDoc).toContain(caseKey);
      expect(matrixDoc).toContain(caseKey);
    });

    INVALID_CASE_KEYS.forEach((caseKey) => {
      expect(invalidDoc).toContain(caseKey);
    });

    expect(pendingDoc).toContain("PENDIENTE");
    expect(pendingDoc).toContain("UNRESOLVED");
    expect(matrixDoc).toContain("PENDIENTE");
    expect(matrixDoc).toContain("UNRESOLVED");
  });
});
