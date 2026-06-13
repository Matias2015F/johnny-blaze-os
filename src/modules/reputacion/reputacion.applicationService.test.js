import { describe, expect, it } from "vitest";
import {
  prepararDecisionAplicacionBeneficio,
  prepararDecisionPublicacionCalificacion,
  prepararEstadoBeneficioParaVista,
} from "./reputacion.applicationService.js";

describe("reputacion.applicationService", () => {
  const legacyOrden = {
    id: "o1",
    taller: { id: "t1" },
    cliente: { id: "c1" },
    moto: { id: "m1" },
    estado: "ENTREGADO",
  };

  const legacyBenefit = {
    id: "b1",
    tallerId: "t1",
    clienteId: "c1",
    motoId: "m1",
    ordenId: "o1",
    descuento: 15,
    estado: "DISPONIBLE",
    fechaVencimiento: "2099-01-01T00:00:00.000Z",
  };

  it("devuelve beneficio no aplicable si esta vencido", () => {
    const decision = prepararDecisionAplicacionBeneficio(
      { ...legacyBenefit, fechaVencimiento: "2000-01-01T00:00:00.000Z" },
      legacyOrden,
    );
    expect(decision.permitido).toBe(false);
    expect(decision.source).toBe("reputacion.applicationService");
  });

  it("devuelve beneficio aplicable cuando corresponde", () => {
    const decision = prepararDecisionAplicacionBeneficio(legacyBenefit, legacyOrden);
    expect(decision).toMatchObject({
      permitido: true,
      codigo: "BENEFICIO_APLICABLE",
      source: "reputacion.applicationService",
    });
  });

  it("devuelve calificacion bloqueada sin token valido", () => {
    const decision = prepararDecisionPublicacionCalificacion({
      tallerId: "t1",
      clienteId: "c1",
      motoId: "m1",
      ordenId: "o1",
      rating: 5,
      estadoPublicacion: "PENDIENTE",
    });
    expect(decision).toMatchObject({
      permitido: false,
      codigo: "CALIFICACION_BLOQUEADA_TOKEN_INVALIDO",
      source: "reputacion.applicationService",
    });
  });

  it("no muta el objeto original", () => {
    const original = {
      ...legacyBenefit,
      taller: { id: "t1" },
      cliente: { id: "c1" },
      moto: { id: "m1" },
    };
    const copia = JSON.parse(JSON.stringify(original));
    prepararEstadoBeneficioParaVista(original, legacyOrden);
    expect(original).toEqual(copia);
  });
});

