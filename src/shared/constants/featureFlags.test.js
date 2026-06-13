import { describe, expect, it } from "vitest";
import {
  getFeatureFlags,
  isOrdenShadowDiagnosticsEnabled,
  isOrdenShadowOnOrderDetailEnabled,
} from "./featureFlags.js";

describe("featureFlags", () => {
  it("mantiene apagadas las flags por defecto", () => {
    expect(isOrdenShadowDiagnosticsEnabled({})).toBe(false);
    expect(isOrdenShadowOnOrderDetailEnabled({})).toBe(false);
    expect(getFeatureFlags({})).toEqual({
      ORDEN_SHADOW_DIAGNOSTICS: false,
      ORDEN_SHADOW_ON_ORDER_DETAIL: false,
    });
  });

  it("activa solo la flag de preview cuando corresponde", () => {
    const env = { VITE_ENABLE_ORDEN_SHADOW_DIAGNOSTICS: "true" };

    expect(isOrdenShadowDiagnosticsEnabled(env)).toBe(true);
    expect(isOrdenShadowOnOrderDetailEnabled(env)).toBe(false);
    expect(getFeatureFlags(env)).toEqual({
      ORDEN_SHADOW_DIAGNOSTICS: true,
      ORDEN_SHADOW_ON_ORDER_DETAIL: false,
    });
  });

  it("activa solo la flag de order detail cuando corresponde", () => {
    const env = { VITE_ENABLE_ORDEN_SHADOW_ON_ORDER_DETAIL: "true" };

    expect(isOrdenShadowDiagnosticsEnabled(env)).toBe(false);
    expect(isOrdenShadowOnOrderDetailEnabled(env)).toBe(true);
    expect(getFeatureFlags(env)).toEqual({
      ORDEN_SHADOW_DIAGNOSTICS: false,
      ORDEN_SHADOW_ON_ORDER_DETAIL: true,
    });
  });

  it("no cruza habilitaciones entre preview y order detail", () => {
    const env = {
      VITE_ENABLE_ORDEN_SHADOW_DIAGNOSTICS: "true",
      VITE_ENABLE_ORDEN_SHADOW_ON_ORDER_DETAIL: "false",
    };

    expect(getFeatureFlags(env)).toEqual({
      ORDEN_SHADOW_DIAGNOSTICS: true,
      ORDEN_SHADOW_ON_ORDER_DETAIL: false,
    });
  });
});
