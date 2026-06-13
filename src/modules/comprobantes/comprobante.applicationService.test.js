import { describe, expect, it } from "vitest";
import {
  prepararDecisionPublicacionComprobante,
  prepararDecisionVerificacionComprobante,
  prepararEstadoComprobanteParaVista,
} from "./comprobante.applicationService.js";

describe("comprobante.applicationService", () => {
  const legacyBase = {
    id: "comp_1",
    comprobanteId: "comp_1",
    pdfUrl: "https://example.com/pdf",
    taller: { id: "t1" },
    cliente: { id: "c1" },
    moto: { id: "m1" },
    orderId: "o1",
    fechaCierre: "2026-06-12T00:00:00.000Z",
    estado: "verificado",
  };

  it("devuelve decision bloqueada sin trazabilidad", () => {
    const decision = prepararDecisionVerificacionComprobante({ ...legacyBase, fechaCierre: "" });
    expect(decision).toMatchObject({
      permitido: false,
      codigo: "COMPROBANTE_BLOQUEADO_SIN_TRAZABILIDAD",
      source: "comprobante.applicationService",
    });
  });

  it("devuelve decision verificable para comprobante completo", () => {
    const decision = prepararDecisionVerificacionComprobante(legacyBase);
    expect(decision).toMatchObject({
      permitido: true,
      codigo: "COMPROBANTE_LISTO",
      source: "comprobante.applicationService",
    });
  });

  it("devuelve decision de publicacion consistente", () => {
    const decision = prepararDecisionPublicacionComprobante(legacyBase);
    expect(decision.permitido).toBe(true);
    expect(decision.source).toBe("comprobante.applicationService");
  });

  it("no muta el objeto original", () => {
    const original = {
      ...legacyBase,
      taller: { ...legacyBase.taller },
      cliente: { ...legacyBase.cliente },
      moto: { ...legacyBase.moto },
    };
    const copia = JSON.parse(JSON.stringify(original));
    prepararEstadoComprobanteParaVista(original);
    expect(original).toEqual(copia);
  });
});

