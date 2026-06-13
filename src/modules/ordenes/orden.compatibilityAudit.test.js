import { describe, expect, it } from "vitest";
import { ORDEN_LEGACY_SANITIZED_SNAPSHOTS } from "./fixtures/ordenLegacySanitizedSnapshots.js";
import { auditarCompatibilidadOrdenLegacy, crearReporteCompatibilidadOrden, detectarCamposCriticosAusentes, detectarCamposLegacyNoReconocidos } from "./orden.compatibilityAudit.js";

describe("orden.compatibilityAudit", () => {
  it("reconoce una orden canonica como compatible", () => {
    const orden = ORDEN_LEGACY_SANITIZED_SNAPSHOTS.canonicaCompleta;
    const report = crearReporteCompatibilidadOrden(orden);

    expect(report.compatible).toBe(true);
    expect(report.nivel).toBe("OK");
    expect(report.camposCriticosAusentes).toEqual([]);
    expect(report.camposNoReconocidos).toEqual([]);
    expect(report.decisionPdf.permitido).toBe(true);
    expect(report.proximaAccion).toBe("Generar PDF final");
    expect(report.snapshotSanitizado).not.toBe(orden);
  });

  it("detecta campos legacy no reconocidos y mantiene snapshot sanitizado", () => {
    const orden = {
      ...ORDEN_LEGACY_SANITIZED_SNAPSHOTS.desconocida,
      cliente: {
        nombre: "Matias",
        email: "matias@example.com",
      },
    };

    const report = auditarCompatibilidadOrdenLegacy(orden);

    expect(report.compatible).toBe(true);
    expect(report.nivel).toBe("WARNING");
    expect(detectarCamposLegacyNoReconocidos(orden)).toEqual(expect.arrayContaining(["campoRaroUno", "campoRaroDos", "nested"]));
    expect(report.camposNoReconocidos).toEqual(expect.arrayContaining(["campoRaroUno", "campoRaroDos", "nested"]));
    expect(JSON.stringify(report.snapshotSanitizado)).not.toContain("Matias");
    expect(JSON.stringify(report.snapshotSanitizado)).not.toContain("matias@example.com");
  });

  it("marca una orden incompleta como incompatible", () => {
    const orden = {
      estado: "BORRADOR",
      tallerId: "taller_1",
    };
    const report = crearReporteCompatibilidadOrden(orden);

    expect(report.compatible).toBe(false);
    expect(report.nivel).toBe("INCOMPATIBLE");
    expect(detectarCamposCriticosAusentes(orden)).toEqual(expect.arrayContaining(["cliente", "moto"]));
    expect(report.camposCriticosAusentes).toEqual(expect.arrayContaining(["cliente", "moto"]));
    expect(report.decisionPdf.permitido).toBe(false);
    expect(report.proximaAccion).toBe("Completar trabajo o retiro");
  });

  it("documenta el reporte completo sin exponer datos sensibles", () => {
    const report = crearReporteCompatibilidadOrden({
      id: "orden_demo_999",
      estado: "ENTREGADO",
      clientId: "cliente_999",
      bikeId: "moto_999",
      tallerId: "taller_999",
      cliente: { nombre: "Sergio Gomez", telefono: "+54 11 4444-1111" },
      moto: { patente: "AA123BB", dominio: "motogestion.ar" },
      garantiaFinal: "Garantia",
      cierreRechazo: { excepciones: "Ninguna", observaciones: "Listo" },
    });

    expect(report.compatible).toBe(true);
    expect(report.camposReconocidos).toEqual(expect.arrayContaining(["id", "estado", "clientId", "bikeId", "tallerId", "cierreRechazo", "garantiaFinal"]));
    expect(JSON.stringify(report.snapshotSanitizado)).not.toContain("Sergio Gomez");
    expect(JSON.stringify(report.snapshotSanitizado)).not.toContain("AA123BB");
    expect(JSON.stringify(report.snapshotSanitizado)).not.toContain("motogestion.ar");
  });
});
