import { describe, expect, it } from "vitest";
import { obtenerCasoShadowDifferential } from "./fixtures/ordenShadowDifferentialCorpus.js";
import {
  evaluarTransicionCierreOrden,
  getSiguienteEstadoCierrePermitido,
  isCierreDocumentalCompleto,
  isOrdenEjecucionValida,
  isOrdenIngresoValida,
  isOrdenPresupuestoValida,
  isPagoCompleto,
  isRetiroConfirmado,
} from "./orden.stageValidators.js";

describe("orden.stageValidators", () => {
  it("permite ingreso sin garantia final y exige cliente, moto y motivo", () => {
    const ingresoValido = {
      id: "ingreso-1",
      estado: "BORRADOR",
      clientId: "cliente-1",
      bikeId: "moto-1",
      motivoIngreso: "No arranca",
    };

    expect(isOrdenIngresoValida(ingresoValido)).toBe(true);
    expect(isOrdenIngresoValida({ ...ingresoValido, garantiaFinal: "" })).toBe(true);
    expect(isOrdenIngresoValida({ ...ingresoValido, clientId: "" })).toBe(false);
    expect(isOrdenIngresoValida({ ...ingresoValido, bikeId: "" })).toBe(false);
    expect(isOrdenIngresoValida({ ...ingresoValido, motivoIngreso: "" })).toBe(false);

    const recienIngresada = obtenerCasoShadowDifferential("recienIngresada").legacyOrden;
    expect(isOrdenIngresoValida(recienIngresada)).toBe(false);
  });

  it("valida presupuesto con diagnostico, tareas, importe y version", () => {
    const presupuestoValido = {
      diagnostico: "Motor no arranca",
      tareas: [{ nombre: "Cambio de bateria" }],
      importe: 45000,
      versionPresupuesto: 2,
    };

    expect(isOrdenPresupuestoValida(presupuestoValido)).toBe(true);
    expect(isOrdenPresupuestoValida({ ...presupuestoValido, versionPresupuesto: "" })).toBe(false);
  });

  it("valida ejecucion con autorizacion y tareas activas", () => {
    const ejecucionValida = {
      estado: "EN_REPARACION",
      autorizadoPor: "mecanico-1",
      tareas: [{ nombre: "Cambio de aceite" }],
      puedeContinuarConTareasAutorizadas: true,
    };

    expect(isOrdenEjecucionValida(ejecucionValida)).toBe(true);
    expect(isOrdenEjecucionValida({ ...ejecucionValida, autorizadoPor: "" })).toBe(false);
    expect(isOrdenEjecucionValida({ ...ejecucionValida, tareas: [] })).toBe(false);

    const adicionalPendiente = {
      ...ejecucionValida,
      estado: "ESPERANDO_APROBACION_ADICIONAL",
      puedeContinuarConTareasAutorizadas: false,
    };

    expect(isOrdenEjecucionValida(adicionalPendiente)).toBe(false);
    expect(isOrdenEjecucionValida({ ...adicionalPendiente, puedeContinuarConTareasAutorizadas: true })).toBe(true);

    const bloqueoPresupuestario = {
      ...ejecucionValida,
      estado: "BLOQUEADA_POR_LIMITE_PRESUPUESTARIO",
      puedeContinuarConTareasAutorizadas: true,
    };

    expect(isOrdenEjecucionValida(bloqueoPresupuestario)).toBe(true);
  });

  it("formaliza la secuencia pura de cierre", () => {
    const base = {
      id: "orden-1",
      estado: "ENTREGADO",
      clientId: "cliente-1",
      bikeId: "moto-1",
      tallerId: "taller-1",
      total: 15000,
      pagos: [{ monto: 15000 }],
      retirado: true,
      garantiaFinal: "Garantia vigente",
      cierreRechazo: {
        excepciones: "Ninguna",
        observaciones: "Todo correcto",
      },
      recomendaciones: "Controlar presion de neumaticos",
      comprobante: {
        comprobanteId: "cmp-1",
        tallerId: "taller-1",
        clienteId: "cliente-1",
        motoId: "moto-1",
        ordenId: "orden-1",
        pdfUrl: "https://example.test/comprobante.pdf",
        fechaCierre: "2026-06-13",
        estadoVerificacion: "VERIFICADO",
      },
    };

    expect(isPagoCompleto({ ...base, pagos: [{ monto: 5000 }] })).toBe(false);
    expect(getSiguienteEstadoCierrePermitido({ ...base, pagos: [{ monto: 5000 }] })).toBe("PENDIENTE_PAGO");

    expect(isPagoCompleto(base)).toBe(true);
    expect(isRetiroConfirmado(base)).toBe(true);
    expect(isCierreDocumentalCompleto(base)).toBe(true);
    expect(getSiguienteEstadoCierrePermitido(base)).toBe("CERRADO_CON_PDF");

    const pagoCompletoSinRetiro = { ...base, estado: "PENDIENTE_PAGO", retirado: false };
    expect(getSiguienteEstadoCierrePermitido(pagoCompletoSinRetiro)).toBe("COBRADO_PENDIENTE_RETIRO");

    const sinCierreDocumental = {
      ...base,
      retirado: true,
      comprobante: {
        ...base.comprobante,
        pdfUrl: "",
      },
    };
    expect(isCierreDocumentalCompleto(sinCierreDocumental)).toBe(false);
    expect(getSiguienteEstadoCierrePermitido(sinCierreDocumental)).toBe("ENTREGADO");
  });

  it("devuelve revision manual para estados inconsistentes y no muta el objeto original", () => {
    const inconsistent = {
      id: "orden-2",
      estado: "MODO_RARO",
      status: "AUTORIZADO",
      clientId: "cliente-1",
      bikeId: "moto-1",
      tallerId: "taller-1",
      total: 15000,
      pagos: [{ monto: 15000 }],
      retirado: true,
      garantiaFinal: "Garantia vigente",
      cierreRechazo: {
        excepciones: "Ninguna",
        observaciones: "Todo correcto",
      },
      recomendaciones: "Controlar presion de neumaticos",
      comprobante: {
        comprobanteId: "cmp-1",
        tallerId: "taller-1",
        clienteId: "cliente-1",
        motoId: "moto-1",
        ordenId: "orden-2",
        pdfUrl: "https://example.test/comprobante.pdf",
        fechaCierre: "2026-06-13",
        estadoVerificacion: "VERIFICADO",
      },
    };

    const copy = JSON.parse(JSON.stringify(inconsistent));
    const decision = evaluarTransicionCierreOrden(inconsistent);

    expect(decision.requiresManualReview).toBe(true);
    expect(decision.permitido).toBe(false);
    expect(decision.estadoSiguiente).toBeNull();
    expect(decision.motivos).toContain("INCONSISTENT_LEGACY_STATE");
    expect(inconsistent).toEqual(copy);
  });
});
