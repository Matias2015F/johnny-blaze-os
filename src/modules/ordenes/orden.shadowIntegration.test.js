import { describe, expect, it } from "vitest";
import { crearResumenShadowOrden, evaluarOrdenShadow } from "./orden.shadowIntegration.js";

describe("orden.shadowIntegration", () => {
  const base = {
    id: "orden_1",
    estado: "ENTREGADO",
    cliente: { id: "c1" },
    moto: { id: "m1" },
    taller: { id: "t1" },
    garantia: "Garantia vigente",
    excepciones: "Ninguna",
    observaciones: "Todo correcto",
  };

  it("genera warning de PDF bloqueado para cobrada pendiente retiro", () => {
    const shadow = evaluarOrdenShadow({ ...base, pagado: true, retirado: false, estado: "" });
    expect(shadow.decisionPdf.permitido).toBe(false);
    expect(shadow.warnings).toContain("MOTO_NO_RETIRADA");
    expect(shadow.source).toBe("orden.shadowIntegration");
  });

  it("no genera bloqueo para orden entregada completa", () => {
    const shadow = evaluarOrdenShadow(base);
    expect(shadow.decisionPdf.permitido).toBe(true);
    expect(shadow.warnings).toHaveLength(0);
    expect(shadow.divergencias).toHaveLength(0);
  });

  it("genera bloqueo para orden cancelada", () => {
    const shadow = evaluarOrdenShadow({ ...base, estado: "CANCELADO" });
    expect(shadow.decisionPdf.permitido).toBe(false);
    expect(shadow.warnings).toContain("ORDEN_CANCELADA");
  });

  it("genera motivos de bloqueo para legacy incompleta", () => {
    const shadow = evaluarOrdenShadow({ estado: "ENTREGADO", garantia: "Garantia vigente" });
    expect(shadow.decisionPdf.permitido).toBe(false);
    expect(shadow.warnings).toContain("ORDEN_LEGACY_INCOMPLETA");
  });

  it("no muta el objeto original", () => {
    const original = {
      ...base,
      cliente: { ...base.cliente },
      moto: { ...base.moto },
      taller: { ...base.taller },
    };
    const copia = JSON.parse(JSON.stringify(original));
    crearResumenShadowOrden(original);
    expect(original).toEqual(copia);
  });
});
