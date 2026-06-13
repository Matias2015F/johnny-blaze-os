import { describe, expect, it } from "vitest";
import { evaluarServicioComprobante } from "./comprobante.domainService.js";

describe("comprobante.domainService", () => {
  const base = {
    comprobanteId: "comp_1",
    tallerId: "t1",
    clienteId: "c1",
    motoId: "m1",
    ordenId: "o1",
    pdfUrl: "https://example.com/pdf",
    fechaCierre: "2026-06-12T00:00:00.000Z",
    estadoVerificacion: "VERIFICADO",
  };

  it("devuelve decision lista para verificacion/publicacion", () => {
    const resultado = evaluarServicioComprobante(base);
    expect(resultado).toMatchObject({
      permitido: true,
      codigo: "COMPROBANTE_LISTO",
      accionSugerida: "Publicar o verificar comprobante",
    });
  });

  it("bloquea comprobante sin pdfUrl", () => {
    const resultado = evaluarServicioComprobante({ ...base, pdfUrl: "" });
    expect(resultado).toMatchObject({
      permitido: false,
      codigo: "COMPROBANTE_BLOQUEADO_SIN_REQUISITOS",
      accionSugerida: "Completar campos obligatorios",
    });
  });

  it("bloquea comprobante sin trazabilidad minima", () => {
    const resultado = evaluarServicioComprobante({ ...base, fechaCierre: "" });
    expect(resultado).toMatchObject({
      permitido: false,
      codigo: "COMPROBANTE_BLOQUEADO_SIN_TRAZABILIDAD",
      accionSugerida: "Completar documentación mínima",
    });
  });
});

