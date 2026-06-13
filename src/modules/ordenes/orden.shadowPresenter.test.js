import { describe, expect, it } from "vitest";
import {
  getShadowDecisionSeverity,
  getShadowDecisionTitle,
  presentarDecisionShadowOrden,
} from "./orden.shadowPresenter.js";

describe("orden.shadowPresenter", () => {
  it("devuelve severidad warning/error para PDF bloqueado por moto no retirada", () => {
    const shadow = {
      decisionPdf: { codigo: "PDF_BLOQUEADO_MOTO_NO_RETIRADA", permitido: false },
    };
    expect(getShadowDecisionSeverity(shadow)).toBe("warning");
    expect(getShadowDecisionTitle(shadow)).toContain("moto no retirada");
  });

  it("devuelve severidad ok para orden completa", () => {
    const shadow = { decisionPdf: { codigo: "PDF_LISTO", permitido: true } };
    expect(getShadowDecisionSeverity(shadow)).toBe("ok");
  });

  it("devuelve severidad bloqueada para orden cancelada", () => {
    const shadow = { decisionPdf: { codigo: "PDF_BLOQUEADO_CANCELADO", permitido: false } };
    expect(getShadowDecisionSeverity(shadow)).toBe("blocked");
  });

  it("no rompe con resultado incompleto", () => {
    const viewModel = presentarDecisionShadowOrden({});
    expect(viewModel).toMatchObject({
      source: "orden.shadowIntegration",
      title: "Decision sombra",
      severity: "info",
    });
  });
});
