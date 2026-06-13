import { describe, expect, it } from "vitest";
import { canMountOrdenShadowDiagnostics, isDiagnosticsRouteRequested, resolveDiagnosticsEntry } from "./diagnosticsEntry.js";

describe("diagnosticsEntry", () => {
  const stagingAuthorized = {
    MODE: "staging",
    VITE_WORKSHOP_UID: "taller_1",
    VITE_ORDEN_SHADOW_MASTER: "true",
    VITE_ORDEN_SHADOW_COMPUTE: "true",
    VITE_ORDEN_SHADOW_COMPARISON: "true",
    VITE_ORDEN_SHADOW_UI: "true",
    VITE_ORDEN_SHADOW_WORKSHOP_ALLOWLIST: "taller_1",
  };
  const prodGeneral = {
    MODE: "production",
    VITE_WORKSHOP_UID: "taller_1",
    VITE_ORDEN_SHADOW_MASTER: "false",
    VITE_ORDEN_SHADOW_COMPUTE: "true",
    VITE_ORDEN_SHADOW_COMPARISON: "true",
    VITE_ORDEN_SHADOW_UI: "true",
    VITE_ORDEN_SHADOW_WORKSHOP_ALLOWLIST: "taller_1",
  };

  it("staging autorizado + ruta exacta autoriza", () => {
    expect(resolveDiagnosticsEntry({ pathname: "/__diagnostics/orden-shadow", search: "", env: stagingAuthorized })).toBe("ORDEN_SHADOW");
  });

  it("produccion general no autoriza", () => {
    expect(resolveDiagnosticsEntry({ pathname: "/__diagnostics/orden-shadow", search: "", env: prodGeneral })).toBe(null);
  });

  it("configuracion invalida no autoriza", () => {
    expect(resolveDiagnosticsEntry({
      pathname: "/__diagnostics/orden-shadow",
      search: "",
      env: {
        MODE: "staging",
        VITE_WORKSHOP_UID: "taller_1",
        VITE_ORDEN_SHADOW_MASTER: "true",
        VITE_ORDEN_SHADOW_COMPUTE: "true",
        VITE_ORDEN_SHADOW_COMPARISON: "true",
        VITE_ORDEN_SHADOW_UI: "true",
        VITE_ORDEN_SHADOW_WORKSHOP_ALLOWLIST: 123,
      },
    })).toBe(null);
  });

  it("ruta parcial o incorrecta no autoriza", () => {
    expect(resolveDiagnosticsEntry({ pathname: "/__diagnostics/orden", search: "", env: stagingAuthorized })).toBe(null);
    expect(resolveDiagnosticsEntry({ pathname: "/diagnostics/orden-shadow", search: "", env: stagingAuthorized })).toBe(null);
  });

  it("query o ruta normal mantiene la aplicacion normal", () => {
    expect(resolveDiagnosticsEntry({ pathname: "/", search: "?diagnostics=orden-shadow", env: prodGeneral })).toBe(null);
    expect(resolveDiagnosticsEntry({ pathname: "/login", search: "", env: stagingAuthorized })).toBe(null);
  });

  it("el resolver no muta los argumentos", () => {
    const args = { pathname: "/__diagnostics/orden-shadow", search: "?foo=bar", env: stagingAuthorized };
    const copy = JSON.parse(JSON.stringify(args));
    resolveDiagnosticsEntry(args);
    expect(args).toEqual(copy);
    expect(canMountOrdenShadowDiagnostics(args.env)).toBe(true);
    expect(isDiagnosticsRouteRequested(args)).toBe(true);
  });
});
