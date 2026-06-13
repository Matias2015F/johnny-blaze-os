import { describe, expect, it } from "vitest";
import { evaluarBeneficio, evaluarCalificacion, isBeneficioAplicableEnOrden } from "./reputacion.rules.js";

describe("reputacion.rules", () => {
  const beneficioBase = {
    beneficioId: "b1",
    tallerId: "t1",
    clienteId: "c1",
    motoId: "m1",
    ordenOrigenId: "o0",
    porcentaje: 15,
    estado: "DISPONIBLE",
    fechaCreacion: "2026-06-12T00:00:00.000Z",
    fechaVencimiento: "2026-06-30T00:00:00.000Z",
  };

  const ordenBase = {
    id: "o1",
    tallerId: "t1",
    clientId: "c1",
    bikeId: "m1",
  };

  it("marca como no aplicable un beneficio vencido", () => {
    const beneficio = { ...beneficioBase, fechaVencimiento: "2020-01-01T00:00:00.000Z" };
    expect(evaluarBeneficio(beneficio, { tallerId: "t1", clienteId: "c1", motoId: "m1" }).aplicable).toBe(false);
  });

  it("marca como no aplicable un beneficio usado", () => {
    const beneficio = { ...beneficioBase, usado: true };
    expect(evaluarBeneficio(beneficio, { tallerId: "t1", clienteId: "c1", motoId: "m1" }).aplicable).toBe(false);
  });

  it("marca como no aplicable un beneficio de otra moto", () => {
    const beneficio = { ...beneficioBase, motoId: "otra" };
    expect(evaluarBeneficio(beneficio, { tallerId: "t1", clienteId: "c1", motoId: "m1" }).aplicable).toBe(false);
  });

  it("marca como no aplicable un beneficio de otro taller", () => {
    const beneficio = { ...beneficioBase, tallerId: "otro" };
    expect(evaluarBeneficio(beneficio, { tallerId: "t1", clienteId: "c1", motoId: "m1" }).aplicable).toBe(false);
  });

  it("marca como no aplicable un beneficio de otro cliente", () => {
    const beneficio = { ...beneficioBase, clienteId: "otro" };
    expect(evaluarBeneficio(beneficio, { tallerId: "t1", clienteId: "c1", motoId: "m1" }).aplicable).toBe(false);
  });

  it("marca como aplicable un beneficio disponible para misma moto, taller y cliente", () => {
    expect(evaluarBeneficio(beneficioBase, { tallerId: "t1", clienteId: "c1", motoId: "m1", provieneDeOrdenRealCerradaCalificada: true, esProximaAtencionDeLaMismaMoto: true }).aplicable).toBe(true);
    expect(isBeneficioAplicableEnOrden(beneficioBase, ordenBase)).toBe(true);
  });

  it("marca como no publicable una calificación sin token válido", () => {
    const calificacion = {
      tallerId: "t1",
      clienteId: "c1",
      motoId: "m1",
      ordenId: "o1",
      rating: 5,
      estadoPublicacion: "PENDIENTE",
      token: null,
    };
    expect(evaluarCalificacion(calificacion).publicable).toBe(false);
  });
});
