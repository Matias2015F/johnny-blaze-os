import { describe, expect, it } from "vitest";
import {
  ORDEN_ESTADOS,
  ORDEN_ESTADOS_CANONICOS_NUEVOS,
  ORDEN_ETAPAS_VALIDACION,
  isEstadoCanonicoNuevoOrden,
  isEstadoOrdenValido,
  isEtapaValidacionOrden,
} from "./orden.contract.js";

describe("orden.contract", () => {
  it("reconoce los nuevos estados canonicos sin tocar datos vivos", () => {
    expect(ORDEN_ESTADOS).toEqual(expect.arrayContaining(ORDEN_ESTADOS_CANONICOS_NUEVOS));

    ORDEN_ESTADOS_CANONICOS_NUEVOS.forEach((estado) => {
      expect(isEstadoOrdenValido(estado)).toBe(true);
      expect(isEstadoCanonicoNuevoOrden(estado)).toBe(true);
    });

    expect(isEstadoCanonicoNuevoOrden("CANCELADO")).toBe(false);
  });

  it("expone las etapas contextuales de validacion", () => {
    expect(ORDEN_ETAPAS_VALIDACION).toEqual([
      "INGRESO",
      "PRESUPUESTO",
      "EJECUCION",
      "CIERRE_DOCUMENTAL",
    ]);

    ORDEN_ETAPAS_VALIDACION.forEach((etapa) => {
      expect(isEtapaValidacionOrden(etapa)).toBe(true);
    });

    expect(isEtapaValidacionOrden("RUTA_VIVA")).toBe(false);
  });
});

