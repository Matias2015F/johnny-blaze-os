import { describe, expect, it } from "vitest";
import {
  ORDEN_BUSINESS_DECISIONS,
  ORDEN_ESTADOS_CANONICOS_NUEVOS,
  obtenerDecisionNegocioOrdenPorCaseKey,
  resolverDecisionNegocioOrden,
} from "./orden.businessDecisions.js";

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

describe("orden.businessDecisions", () => {
  it("expone exactamente ocho decisiones aprobadas", () => {
    expect(ORDEN_BUSINESS_DECISIONS).toHaveLength(8);
    expect(ORDEN_BUSINESS_DECISIONS.map((decision) => decision.ruleId)).toEqual(EXPECTED_RULE_IDS);
  });

  it("mantiene ruleId unicos, decisionState DECIDED y enforcement inactivo", () => {
    const ruleIds = new Set();

    ORDEN_BUSINESS_DECISIONS.forEach((decision) => {
      expect(ruleIds.has(decision.ruleId)).toBe(false);
      ruleIds.add(decision.ruleId);
      expect(decision.decisionState).toBe("DECIDED");
      expect(decision.operationallyEnforced).toBe(false);
      expect(decision.approvedBy).toBe("PRODUCT_OWNER");
      expect(decision.decisionVersion).toBe(1);
      expect(Object.isFrozen(decision)).toBe(true);
    });

    expect(ORDEN_BUSINESS_DECISIONS.filter((decision) => decision.requiresManualReview)).toHaveLength(1);
    expect(ORDEN_BUSINESS_DECISIONS.find((decision) => decision.requiresManualReview)?.ruleId).toBe("ORDER_UNKNOWN_INCONSISTENT_STATE");
  });

  it("registra las acciones y auditorias aprobadas", () => {
    const adicional = obtenerDecisionNegocioOrdenPorCaseKey("adicionalAutorizado");
    expect(adicional).toMatchObject({
      canonicalState: "EN_REPARACION",
      nextAction: "EJECUTAR_ADICIONAL_AUTORIZADO",
      decisionState: "DECIDED",
      operationallyEnforced: false,
    });
    expect(adicional.auditRequirements).toEqual([
      "quien autorizo",
      "fecha y hora",
      "canal",
      "importe",
      "nueva version de presupuesto",
      "conservacion de la version anterior",
    ]);

    const inconsistente = resolverDecisionNegocioOrden({ ruleId: "ORDER_UNKNOWN_INCONSISTENT_STATE" });
    expect(inconsistente).toMatchObject({
      canonicalState: null,
      nextAction: "REVISAR_Y_REPARAR_DATOS",
      requiresManualReview: true,
      reason: "INCONSISTENT_LEGACY_STATE",
    });
  });

  it("reconoce los nuevos estados canonicos aprobados", () => {
    expect(ORDEN_ESTADOS_CANONICOS_NUEVOS).toEqual([
      "ESPERANDO_APROBACION_ADICIONAL",
      "BLOQUEADA_POR_LIMITE_PRESUPUESTARIO",
    ]);
  });
});
