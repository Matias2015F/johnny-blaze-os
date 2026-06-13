import { describe, expect, it } from "vitest";
import { evaluarPdfFinal, obtenerProximaAccionOrden } from "./orden.rules.js";

describe("orden.rules", () => {
  const base = {
    id: "orden_1",
    tallerId: "t1",
    clientId: "c1",
    bikeId: "m1",
    estado: "ENTREGADO",
    garantiaFinal: "Garantía vigente",
    cierreRechazo: { excepciones: "Ninguna", observaciones: "Todo correcto" },
  };

  it("bloquea PDF final y sugiere confirmar retiro cuando está cobrada pero no retirada", () => {
    const orden = { ...base, estado: "COBRADO_PENDIENTE_RETIRO" };
    const resultado = evaluarPdfFinal(orden);
    expect(resultado.permitido).toBe(false);
    expect(obtenerProximaAccionOrden(orden)).toBe("Confirmar retiro de moto");
  });

  it("bloquea PDF final si falta garantía", () => {
    const orden = { ...base };
    delete orden.garantiaFinal;
    expect(evaluarPdfFinal(orden).permitido).toBe(false);
  });

  it("bloquea PDF final si falta cliente o moto", () => {
    const sinCliente = { ...base };
    delete sinCliente.clientId;
    const sinMoto = { ...base };
    delete sinMoto.bikeId;
    expect(evaluarPdfFinal(sinCliente).permitido).toBe(false);
    expect(evaluarPdfFinal(sinMoto).permitido).toBe(false);
  });

  it("permite PDF final cuando está entregada y completa", () => {
    expect(evaluarPdfFinal(base).permitido).toBe(true);
  });

  it("bloquea PDF final si está cancelada", () => {
    const orden = { ...base, estado: "CANCELADO" };
    expect(evaluarPdfFinal(orden).permitido).toBe(false);
  });
});
