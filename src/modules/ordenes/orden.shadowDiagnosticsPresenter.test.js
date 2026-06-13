import { describe, expect, it } from "vitest";
import { isOrdenShadowDiagnosticsEnabled } from "../../shared/constants/featureFlags.js";
import { obtenerOrdenShadowFixture } from "./fixtures/ordenShadowFixtures.js";
import { prepararOrdenShadowDiagnosticsViewModel } from "./orden.shadowDiagnosticsPresenter.js";

describe("orden.shadowDiagnosticsPresenter", () => {
  it("desarrollo + flag activa + ruta exacta autoriza el diagnostico", () => {
    expect(isOrdenShadowDiagnosticsEnabled({ DEV: true, VITE_ENABLE_ORDEN_SHADOW_DIAGNOSTICS: "true" })).toBe(true);
  });

  it("fixture cobrada pendiente de retiro muestra bloqueo", () => {
    const vm = prepararOrdenShadowDiagnosticsViewModel({ legacyOrden: obtenerOrdenShadowFixture("cobradaPendienteRetiro") });
    expect(vm.shadowResult.decisionPdf.permitido).toBe(false);
    expect(vm.panel.severity).toBe("warning");
  });

  it("fixture entregada completa devuelve decision permitida", () => {
    const vm = prepararOrdenShadowDiagnosticsViewModel({ legacyOrden: obtenerOrdenShadowFixture("entregadaCompleta") });
    expect(vm.shadowResult.decisionPdf.permitido).toBe(true);
    expect(vm.panel.severity).toBe("ok");
  });

  it("fixture cancelado devuelve bloqueo", () => {
    const vm = prepararOrdenShadowDiagnosticsViewModel({ legacyOrden: obtenerOrdenShadowFixture("cancelada") });
    expect(vm.shadowResult.decisionPdf.permitido).toBe(false);
    expect(vm.panel.severity).toBe("blocked");
  });

  it("no muta el fixture original", () => {
    const fixture = obtenerOrdenShadowFixture("legacyCamposAlternativos");
    const copy = JSON.parse(JSON.stringify(fixture));
    prepararOrdenShadowDiagnosticsViewModel({ legacyOrden: fixture });
    expect(fixture).toEqual(copy);
  });

  it("datos incompletos no provocan crash", () => {
    const vm = prepararOrdenShadowDiagnosticsViewModel({ legacyOrden: { estado: "ENTREGADO" } });
    expect(vm).toBeTruthy();
    expect(vm.shadowResult).toBeTruthy();
  });
});

