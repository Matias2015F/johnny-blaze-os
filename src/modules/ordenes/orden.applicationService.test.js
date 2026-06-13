import { describe, expect, it } from "vitest";
import {
  prepararDecisionCierreOrden,
  prepararDecisionPdfOrden,
  prepararEstadoOrdenParaVista,
} from "./orden.applicationService.js";

describe("orden.applicationService", () => {
  const legacyBase = {
    id: "orden_1",
    estado: "ENTREGADO",
    cliente: { id: "c1" },
    moto: { id: "m1" },
    taller: { id: "t1" },
    garantia: "Garantia vigente",
    excepciones: "Ninguna",
    observaciones: "Todo correcto",
  };

  it("devuelve PDF bloqueado para cobrada pendiente retiro", () => {
    const decision = prepararDecisionPdfOrden({ ...legacyBase, pagado: true, retirado: false, estado: "" });
    expect(decision).toMatchObject({
      permitido: false,
      codigo: "PDF_BLOQUEADO_MOTO_NO_RETIRADA",
      accionSugerida: "Confirmar retiro de moto",
      source: "orden.applicationService",
    });
  });

  it("no permite cierre documental si la moto no fue retirada", () => {
    const decision = prepararDecisionCierreOrden({ ...legacyBase, pagado: true, retirado: false, estado: "" });
    expect(decision.permitido).toBe(false);
    expect(decision.source).toBe("orden.applicationService");
  });

  it("permite PDF cuando la orden esta completa", () => {
    const decision = prepararDecisionPdfOrden(legacyBase);
    expect(decision.permitido).toBe(true);
    expect(decision.codigo).toBe("PDF_LISTO");
  });

  it("bloquea PDF si la orden esta cancelada", () => {
    const decision = prepararDecisionPdfOrden({ ...legacyBase, estado: "CANCELADO" });
    expect(decision.permitido).toBe(false);
    expect(decision.codigo).toBe("PDF_BLOQUEADO_CANCELADO");
  });

  it("no muta el objeto original", () => {
    const original = {
      ...legacyBase,
      cliente: { ...legacyBase.cliente },
      moto: { ...legacyBase.moto },
      taller: { ...legacyBase.taller },
    };
    const copia = JSON.parse(JSON.stringify(original));
    prepararEstadoOrdenParaVista(original);
    expect(original).toEqual(copia);
  });
});

