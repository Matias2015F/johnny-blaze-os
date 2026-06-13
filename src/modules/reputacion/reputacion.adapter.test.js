import { describe, expect, it } from "vitest";
import {
  evaluarLegacyBeneficioParaOrden,
  mapLegacyBenefitToDomainBeneficio,
  mapLegacyRatingToDomainCalificacion,
} from "./reputacion.adapter.js";

describe("reputacion.adapter", () => {
  const legacyOrden = {
    id: "o1",
    taller: { id: "t1" },
    cliente: { id: "c1" },
    moto: { id: "m1" },
    estado: "ENTREGADO",
  };

  const legacyBenefitBase = {
    id: "b1",
    tallerId: "t1",
    clienteId: "c1",
    motoId: "m1",
    ordenId: "o1",
    descuento: 15,
    estado: "DISPONIBLE",
    fechaVencimiento: "2099-01-01T00:00:00.000Z",
  };

  it("traduce rating legacy a calificacion de dominio", () => {
    const mapped = mapLegacyRatingToDomainCalificacion({
      rating: 5,
      comentario: "Excelente",
      token: { tallerId: "t1", clienteId: "c1", motoId: "m1", ordenId: "o1", token: "abc" },
    });
    expect(mapped).toMatchObject({
      rating: 5,
      comentario: "Excelente",
      estadoPublicacion: "PENDIENTE",
    });
  });

  it("traduce beneficio legacy a beneficio de dominio", () => {
    const mapped = mapLegacyBenefitToDomainBeneficio(legacyBenefitBase);
    expect(mapped).toMatchObject({
      beneficioId: "b1",
      tallerId: "t1",
      clienteId: "c1",
      motoId: "m1",
      ordenOrigenId: "o1",
      porcentaje: 15,
      estado: "DISPONIBLE",
    });
  });

  it("bloquea beneficio vencido", () => {
    const decision = evaluarLegacyBeneficioParaOrden(
      { ...legacyBenefitBase, fechaVencimiento: "2000-01-01T00:00:00.000Z" },
      legacyOrden,
    );
    expect(decision.permitido).toBe(false);
    expect(decision.codigo).toBe("BENEFICIO_NO_APLICABLE");
  });

  it("permite beneficio correcto para la misma orden", () => {
    const decision = evaluarLegacyBeneficioParaOrden(legacyBenefitBase, legacyOrden);
    expect(decision.permitido).toBe(true);
    expect(decision.codigo).toBe("BENEFICIO_APLICABLE");
  });

  it("no muta el beneficio original", () => {
    const original = {
      ...legacyBenefitBase,
    };
    const copia = JSON.parse(JSON.stringify(original));
    mapLegacyBenefitToDomainBeneficio(original);
    expect(original).toEqual(copia);
  });
});

