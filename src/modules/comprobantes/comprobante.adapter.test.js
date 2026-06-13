import { describe, expect, it } from "vitest";
import {
  evaluarLegacyComprobanteParaVerificacion,
  mapLegacyComprobanteToDomainComprobante,
} from "./comprobante.adapter.js";

describe("comprobante.adapter", () => {
  const legacyBase = {
    id: "comp_1",
    pdfUrl: "https://example.com/pdf",
    comprobanteId: "comp_1",
    taller: { id: "t1" },
    cliente: { id: "c1" },
    moto: { id: "m1" },
    orderId: "o1",
    fechaCierre: "2026-06-12T00:00:00.000Z",
    estado: "verificado",
  };

  it("traduce un comprobante legacy a forma de dominio", () => {
    const mapped = mapLegacyComprobanteToDomainComprobante(legacyBase);
    expect(mapped).toMatchObject({
      comprobanteId: "comp_1",
      tallerId: "t1",
      clienteId: "c1",
      motoId: "m1",
      ordenId: "o1",
      estadoVerificacion: "VERIFICADO",
    });
  });

  it("bloquea comprobante completo pero sin trazabilidad suficiente", () => {
    const legacy = { ...legacyBase };
    delete legacy.fechaCierre;
    const decision = evaluarLegacyComprobanteParaVerificacion(legacy);
    expect(decision.permitido).toBe(false);
    expect(decision.codigo).toBe("COMPROBANTE_BLOQUEADO_SIN_TRAZABILIDAD");
  });

  it("permite comprobante completo", () => {
    const decision = evaluarLegacyComprobanteParaVerificacion(legacyBase);
    expect(decision.permitido).toBe(true);
    expect(decision.codigo).toBe("COMPROBANTE_LISTO");
  });

  it("no muta el comprobante original", () => {
    const original = {
      ...legacyBase,
      taller: { ...legacyBase.taller },
      cliente: { ...legacyBase.cliente },
      moto: { ...legacyBase.moto },
    };
    const copia = JSON.parse(JSON.stringify(original));
    mapLegacyComprobanteToDomainComprobante(original);
    expect(original).toEqual(copia);
  });
});

