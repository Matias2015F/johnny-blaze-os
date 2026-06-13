import { describe, expect, it } from "vitest";
import {
  evaluarCasoShadowDifferential,
  generarInventarioShadowDifferentialOrden,
  generarReporteShadowDifferentialOrden,
} from "./orden.shadowDifferential.js";
import { ORDEN_BUSINESS_DECISIONS } from "./orden.businessDecisions.js";
import { ORDEN_SHADOW_DIFFERENTIAL_CORPUS } from "./fixtures/ordenShadowDifferentialCorpus.js";
import { ORDEN_SHADOW_PENDING_RULES } from "./orden.shadowPendingRules.js";

function hasSensitiveText(value) {
  const text = JSON.stringify(value || {});
  return /@|https?:\/\/|\.com|\.ar|\b\d{7,}\b/i.test(text);
}

describe("orden.shadowDifferential", () => {
  it("expone un inventario determinista de 15 casos", () => {
    const inventory = generarInventarioShadowDifferentialOrden();
    expect(inventory).toHaveLength(15);
    expect(inventory.map((item) => item.key)).toEqual(ORDEN_SHADOW_DIFFERENTIAL_CORPUS.map((item) => item.key));
  });

  it("mantiene fixtures sanitizados", () => {
    ORDEN_SHADOW_DIFFERENTIAL_CORPUS.forEach((caseDefinition) => {
      expect(hasSensitiveText(caseDefinition.legacyOrden)).toBe(false);
    });
  });

  it("clasifica una orden recien ingresada como fixture invalido", () => {
    const result = evaluarCasoShadowDifferential(ORDEN_SHADOW_DIFFERENTIAL_CORPUS[0]);
    expect(result.legacyDecisionDisponible).toBe(false);
    expect(result.classification).toBe("invalid_fixture");
    expect(result.divergencias).toHaveLength(0);
  });

  it("clasifica estados previos a entrega como regla ambigua", () => {
    const result = evaluarCasoShadowDifferential(ORDEN_SHADOW_DIFFERENTIAL_CORPUS[1]);
    expect(result.legacyDecisionDisponible).toBe(true);
    expect(result.classification).toBe("undefined_business_rule");
    expect(result.shadowResult.decisionPdf.permitido).toBe(false);
  });

  it("produce reporte sin divergencias criticas y con recomendacion de activacion controlada", () => {
    const report = generarReporteShadowDifferentialOrden();
    expect(report.corpusSize).toBe(15);
    expect(report.criticalDivergenceCount).toBe(0);
    expect(report.nonComparableCases).toEqual(["recienIngresada", "legacyIncompleta", "referenciasFaltantes"]);
    expect(report.alignedCases).toHaveLength(12);
    expect(report.alignedCases).toEqual(expect.arrayContaining([
      "presupuestoPendiente",
      "presupuestoAprobado",
      "presupuestoRechazado",
      "adicionalPendiente",
      "adicionalAutorizado",
      "trabajoEnProgreso",
      "bloqueoPresupuestario",
      "finalizadaPendienteCobro",
      "cobradaPendienteRetiro",
      "retirada",
      "cancelada",
      "estadoInconsistente",
    ]));
    expect(report.classificationCounts).toMatchObject({
      aligned: 4,
      undefined_business_rule: 8,
      invalid_fixture: 3,
      expected_difference: 0,
      legacy_bug: 0,
      shadow_bug: 0,
    });
    expect(report.pendingRules).toHaveLength(8);
    expect(report.pendingRules.map((rule) => rule.ruleId)).toEqual(ORDEN_SHADOW_PENDING_RULES.map((rule) => rule.ruleId));
    expect(report.approvedDecisions).toHaveLength(8);
    expect(report.approvedDecisions.map((rule) => rule.ruleId)).toEqual(ORDEN_BUSINESS_DECISIONS.map((rule) => rule.ruleId));
    expect(report.approvedDecisions.every((decision) => decision.decisionState === "DECIDED" && decision.operationallyEnforced === false)).toBe(true);
    expect(report.knownStates).toEqual(expect.arrayContaining([
      "ESPERANDO_APROBACION_ADICIONAL",
      "BLOQUEADA_POR_LIMITE_PRESUPUESTARIO",
    ]));
    expect(report.recommendation.readyForControlledActivation).toBe(true);
    expect(report.recommendation.readyForGeneralProduction).toBe(false);
    expect(report.recommendation.note).toContain("VITE");
  });

  it("es determinista entre ejecuciones", () => {
    const first = generarReporteShadowDifferentialOrden();
    const second = generarReporteShadowDifferentialOrden();
    expect(first).toEqual(second);
  });
});
