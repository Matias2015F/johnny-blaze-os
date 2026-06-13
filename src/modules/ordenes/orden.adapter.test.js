import { describe, expect, it } from "vitest";
import {
  evaluarLegacyOrdenParaPdf,
  mapLegacyOrdenToDomainOrden,
  obtenerProximaAccionDesdeOrdenLegacy,
} from "./orden.adapter.js";

describe("orden.adapter", () => {
  const legacyBase = {
    id: "orden_1",
    estado: "entregada",
    cliente: { id: "c1", nombre: "Cliente" },
    moto: { id: "m1", patente: "ABC123" },
    taller: { id: "t1", nombre: "Taller" },
    garantia: "Garantia vigente",
    excepciones: "Ninguna",
    observaciones: "Todo correcto",
  };

  it("traduce una orden legacy entregada a orden de dominio", () => {
    const mapped = mapLegacyOrdenToDomainOrden(legacyBase);
    expect(mapped).toMatchObject({
      id: "orden_1",
      estado: "ENTREGADO",
      clientId: "c1",
      bikeId: "m1",
      tallerId: "t1",
    });
  });

  it("bloquea PDF cuando legacy esta cobrada pero no retirada", () => {
    const legacy = { ...legacyBase, pagado: true, retirado: false, estado: "" };
    const decision = evaluarLegacyOrdenParaPdf(legacy);
    expect(decision.permitido).toBe(false);
    expect(decision.codigo).toBe("PDF_BLOQUEADO_MOTO_NO_RETIRADA");
    expect(obtenerProximaAccionDesdeOrdenLegacy(legacy)).toBe("Confirmar retiro de moto");
  });

  it("permite PDF cuando legacy llega completa", () => {
    const decision = evaluarLegacyOrdenParaPdf(legacyBase);
    expect(decision.permitido).toBe(true);
    expect(decision.codigo).toBe("PDF_LISTO");
  });

  it("bloquea PDF si falta cliente o moto", () => {
    const sinCliente = { ...legacyBase };
    delete sinCliente.cliente;
    const sinMoto = { ...legacyBase };
    delete sinMoto.moto;
    expect(evaluarLegacyOrdenParaPdf(sinCliente).permitido).toBe(false);
    expect(evaluarLegacyOrdenParaPdf(sinMoto).permitido).toBe(false);
  });

  it("no muta la orden original", () => {
    const original = {
      ...legacyBase,
      cliente: { ...legacyBase.cliente },
      moto: { ...legacyBase.moto },
      taller: { ...legacyBase.taller },
    };
    const copia = JSON.parse(JSON.stringify(original));
    mapLegacyOrdenToDomainOrden(original);
    expect(original).toEqual(copia);
  });
});

