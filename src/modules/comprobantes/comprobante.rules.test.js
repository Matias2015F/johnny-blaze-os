import { describe, expect, it } from "vitest";
import { evaluarComprobante, isComprobanteListoParaPublicacion, isComprobanteListoParaVerificacion } from "./comprobante.rules.js";

describe("comprobante.rules", () => {
  const base = {
    comprobanteId: "comp_1",
    tallerId: "t1",
    clienteId: "c1",
    motoId: "m1",
    ordenId: "o1",
    pdfUrl: "https://example.com/pdf",
    garantia: "Garantía",
    excepciones: "Ninguna",
    recomendaciones: "Seguir control",
    trabajosRealizados: ["Cambio de aceite"],
    repuestos: [],
    pagos: [],
    fechaCierre: "2026-06-12T00:00:00.000Z",
    estadoVerificacion: "VERIFICADO",
  };

  it("no publica comprobante sin pdfUrl", () => {
    const comprobante = { ...base, pdfUrl: "" };
    expect(isComprobanteListoParaPublicacion(comprobante)).toBe(false);
  });

  it("no verifica comprobante sin campos obligatorios", () => {
    const comprobante = { ...base };
    delete comprobante.ordenId;
    expect(isComprobanteListoParaVerificacion(comprobante)).toBe(false);
  });

  it("no verifica comprobante sin trazabilidad documental mínima", () => {
    const comprobante = { ...base };
    delete comprobante.fechaCierre;
    expect(isComprobanteListoParaVerificacion(comprobante)).toBe(false);
  });

  it("considera verificable un comprobante completo", () => {
    expect(isComprobanteListoParaVerificacion(base)).toBe(true);
    expect(evaluarComprobante(base).verificable).toBe(true);
  });
});
