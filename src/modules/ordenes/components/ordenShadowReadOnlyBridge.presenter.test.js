import { describe, expect, it } from "vitest";
import { prepararOrdenShadowReadOnlyBridgeViewModel, shouldMountOrdenShadowReadOnlyBridge } from "./ordenShadowReadOnlyBridge.presenter.js";

const baseOrder = {
  id: "orden_1",
  estado: "ENTREGADO",
  clientId: "cliente_1",
  bikeId: "moto_1",
  tallerId: "taller_1",
  garantiaFinal: "Garantia vigente",
  cierreRechazo: { excepciones: "Ninguna", observaciones: "Todo correcto" },
  cliente: {
    nombre: "Maria Lopez",
    telefono: "+54 11 3434-6543",
    email: "maria@example.com",
    documento: "30111222",
    direccion: "Av. Siempre Viva 123",
  },
  moto: {
    patente: "XYZ789",
    motor: "MTR-88991",
    chasis: "CHS-55661",
  },
};

const stagingEnv = {
  MODE: "staging",
  VITE_WORKSHOP_UID: "taller_1",
  VITE_ORDEN_SHADOW_MASTER: "true",
  VITE_ORDEN_SHADOW_COMPUTE: "true",
  VITE_ORDEN_SHADOW_COMPARISON: "true",
  VITE_ORDEN_SHADOW_UI: "true",
  VITE_ORDEN_SHADOW_WORKSHOP_ALLOWLIST: "taller_1",
  VITE_ORDEN_SHADOW_SURFACES: "order_detail",
  VITE_ORDEN_SHADOW_ROLES: "mechanic",
};

describe("ordenShadowReadOnlyBridge.presenter", () => {
  it("no monta el bridge cuando la policy no autoriza la superficie", () => {
    expect(shouldMountOrdenShadowReadOnlyBridge({
      order: baseOrder,
      env: {
        MODE: "production",
        VITE_WORKSHOP_UID: "taller_1",
        VITE_ORDEN_SHADOW_MASTER: "false",
        VITE_ORDEN_SHADOW_COMPUTE: "true",
        VITE_ORDEN_SHADOW_COMPARISON: "true",
        VITE_ORDEN_SHADOW_UI: "true",
        VITE_ORDEN_SHADOW_WORKSHOP_ALLOWLIST: "taller_1",
        VITE_ORDEN_SHADOW_SURFACES: "order_detail",
        VITE_ORDEN_SHADOW_ROLES: "mechanic",
      },
    })).toBe(false);
  });

  it("monta el bridge cuando la policy autoriza staging y allowlist", () => {
    expect(shouldMountOrdenShadowReadOnlyBridge({
      order: baseOrder,
      env: stagingEnv,
    })).toBe(true);
  });

  it("no monta nada si la orden no existe", () => {
    const result = prepararOrdenShadowReadOnlyBridgeViewModel({
      order: null,
      env: stagingEnv,
    });

    expect(result.mounted).toBe(false);
    expect(result.reason).toBe("INVALID_ORDER");
  });

  it("no provoca crash con una orden parcial", () => {
    const result = prepararOrdenShadowReadOnlyBridgeViewModel({
      order: { id: "orden_parcial", tallerId: "taller_1" },
      env: stagingEnv,
    });

    expect(result.mounted).toBe(true);
    expect(result.shadowResult).toBeTruthy();
    expect(result.panel).toBeTruthy();
  });

  it("bloquea PDF para orden cobrada pendiente de retiro", () => {
    const result = prepararOrdenShadowReadOnlyBridgeViewModel({
      order: {
        ...baseOrder,
        estado: "",
        cobrado: true,
        retirado: false,
        motoRetirada: false,
      },
      env: stagingEnv,
    });

    expect(result.shadowResult.decisionPdf.permitido).toBe(false);
    expect(result.shadowResult.decisionPdf.codigo).toBe("PDF_BLOQUEADO_MOTO_NO_RETIRADA");
    expect(result.panel.decisionPdf.permitido).toBe(false);
  });

  it("permite PDF para orden entregada completa", () => {
    const result = prepararOrdenShadowReadOnlyBridgeViewModel({
      order: { ...baseOrder },
      env: stagingEnv,
    });

    expect(result.shadowResult.decisionPdf.permitido).toBe(true);
    expect(result.panel.decisionPdf.permitido).toBe(true);
    expect(result.panel.divergenciasTexto).toBe("Sin divergencias");
  });

  it("muestra bloqueo para orden cancelada", () => {
    const result = prepararOrdenShadowReadOnlyBridgeViewModel({
      order: { ...baseOrder, estado: "CANCELADO" },
      env: stagingEnv,
    });

    expect(result.shadowResult.decisionPdf.permitido).toBe(false);
    expect(result.shadowResult.decisionPdf.codigo).toBe("PDF_BLOQUEADO_CANCELADO");
    expect(result.panel.divergenciasTexto).toBe("Sin divergencias");
  });

  it("no muta el objeto original", () => {
    const original = JSON.parse(JSON.stringify(baseOrder));
    const copy = JSON.parse(JSON.stringify(original));

    prepararOrdenShadowReadOnlyBridgeViewModel({
      order: original,
      env: stagingEnv,
    });

    expect(original).toEqual(copy);
  });

  it("sanitiza el modelo presentado", () => {
    const result = prepararOrdenShadowReadOnlyBridgeViewModel({
      order: baseOrder,
      env: stagingEnv,
    });

    const serialized = JSON.stringify({
      safeOrder: result.sanitizedOrder,
      snapshot: result.diagnosticSnapshot,
      panel: result.panel,
    });

    expect(serialized).not.toContain("Maria Lopez");
    expect(serialized).not.toContain("+54 11 3434-6543");
    expect(serialized).not.toContain("maria@example.com");
    expect(serialized).not.toContain("30111222");
    expect(serialized).not.toContain("Av. Siempre Viva 123");
    expect(serialized).not.toContain("XYZ789");
    expect(serialized).not.toContain("MTR-88991");
    expect(serialized).not.toContain("CHS-55661");
  });

  it("muestra comparacion legacy no disponible cuando no hay comparacion real", () => {
    const result = prepararOrdenShadowReadOnlyBridgeViewModel({
      order: { id: "orden_2", tallerId: "taller_1" },
      env: stagingEnv,
    });

    expect(result.panel.divergenciasTexto).toBe("Comparacion legacy no disponible");
  });

  it("falla de forma segura cuando el diagnostico lanza una excepcion", () => {
    const result = prepararOrdenShadowReadOnlyBridgeViewModel({
      order: baseOrder,
      env: stagingEnv,
      dependencies: {
        evaluarOrdenShadowFn: () => {
          throw new Error("boom");
        },
      },
    });

    expect(result.mounted).toBe(false);
    expect(result.reason).toBe("DIAGNOSTIC_FAILURE");
    expect(result.notice).toBe("Diagnostico sombra no disponible.");
  });
});

