import { describe, expect, it } from "vitest";
import { evaluarServicioPdfFinal } from "./orden.domainService.js";

describe("orden.domainService", () => {
  const base = {
    id: "orden_1",
    tallerId: "t1",
    clientId: "c1",
    bikeId: "m1",
    estado: "ENTREGADO",
    garantiaFinal: "Garantia vigente",
    cierreRechazo: { excepciones: "Ninguna", observaciones: "Todo correcto" },
  };

  it("devuelve decision estructurada para PDF listo", () => {
    const resultado = evaluarServicioPdfFinal(base);
    expect(resultado).toMatchObject({
      permitido: true,
      codigo: "PDF_LISTO",
      accionSugerida: "Generar PDF final",
    });
  });

  it("bloquea PDF por retiro pendiente con codigo y accion", () => {
    const resultado = evaluarServicioPdfFinal({ ...base, estado: "COBRADO_PENDIENTE_RETIRO" });
    expect(resultado).toMatchObject({
      permitido: false,
      codigo: "PDF_BLOQUEADO_MOTO_NO_RETIRADA",
      accionSugerida: "Confirmar retiro de moto",
    });
  });

  it("bloquea PDF por cancelacion con codigo especifico", () => {
    const resultado = evaluarServicioPdfFinal({ ...base, estado: "CANCELADO" });
    expect(resultado).toMatchObject({
      permitido: false,
      codigo: "PDF_BLOQUEADO_CANCELADO",
      accionSugerida: "Revisar orden cancelada",
    });
  });
});

