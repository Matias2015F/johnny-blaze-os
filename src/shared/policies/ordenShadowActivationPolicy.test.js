import { describe, expect, it } from "vitest";
import {
  buildOrdenShadowActivationContextFromEnv,
  getOrdenShadowActivationPolicy,
  getOrdenShadowBusinessRuleState,
  ORDEN_SHADOW_POLICY_REASON_CODES,
  parseOrdenShadowActivationConfig,
} from "./ordenShadowActivationPolicy.js";

describe("ordenShadowActivationPolicy", () => {
  it("parsea configuracion de forma defensiva", () => {
    const config = parseOrdenShadowActivationConfig({
      environment: "staging",
      workshopUid: "taller_1",
      surface: "diagnostics",
      userRole: "internal",
      allowlist: ["taller_1"],
      flags: {
        master: "true",
        compute: "true",
        comparison: "true",
        ui: "true",
      },
    });

    expect(config.valid).toBe(true);
    expect(config.flags.masterEnabled).toBe(true);
    expect(config.allowlist).toEqual(["taller_1"]);
  });

  it("master apagado fuerza apagado total", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "staging",
      workshopUid: "taller_1",
      surface: "diagnostics",
      userRole: "internal",
      allowlist: ["taller_1"],
      flags: { master: "false", compute: "true", comparison: "true", ui: "true" },
    });

    expect(policy).toMatchObject({
      computeEnabled: false,
      comparisonEnabled: false,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.MASTER_DISABLED,
    });
  });

  it("staging permite activacion controlada", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "staging",
      workshopUid: "taller_1",
      surface: "diagnostics",
      userRole: "internal",
      allowlist: ["taller_1"],
      flags: { master: "true", compute: "true", comparison: "true", ui: "true" },
    });

    expect(policy).toMatchObject({
      computeEnabled: true,
      comparisonEnabled: true,
      uiVisible: true,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.ENABLED_STAGING,
    });
  });

  it("produccion mantiene calculo interno pero no expone UI por defecto", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "production",
      workshopUid: "taller_1",
      surface: "order_detail",
      userRole: "mechanic",
      allowlist: ["taller_1"],
      flags: { master: "true", compute: "true", comparison: "true", ui: "false" },
    });

    expect(policy).toMatchObject({
      computeEnabled: true,
      comparisonEnabled: true,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.ENABLED_INTERNAL,
    });
  });

  it("workshop ausente bloquea", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "staging",
      surface: "diagnostics",
      userRole: "internal",
      allowlist: ["taller_1"],
      flags: { master: "true", compute: "true", comparison: "true", ui: "true" },
    });

    expect(policy).toMatchObject({
      computeEnabled: false,
      comparisonEnabled: false,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.WORKSHOP_MISSING,
    });
  });

  it("allowlist vacia bloquea", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "staging",
      workshopUid: "taller_1",
      surface: "diagnostics",
      userRole: "internal",
      allowlist: [],
      flags: { master: "true", compute: "true", comparison: "true", ui: "true" },
    });

    expect(policy.reasonCode).toBe(ORDEN_SHADOW_POLICY_REASON_CODES.WORKSHOP_NOT_ALLOWLISTED);
  });

  it("entorno desarrollo queda bloqueado", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "development",
      workshopUid: "taller_1",
      surface: "diagnostics",
      userRole: "internal",
      allowlist: ["taller_1"],
      flags: { master: "true", compute: "true", comparison: "true", ui: "true" },
    });

    expect(policy.reasonCode).toBe(ORDEN_SHADOW_POLICY_REASON_CODES.ENVIRONMENT_NOT_ALLOWED);
    expect(policy.uiVisible).toBe(false);
  });

  it("superficie no autorizada apaga solo la UI", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "staging",
      workshopUid: "taller_1",
      surface: "unknown_surface",
      userRole: "internal",
      allowlist: ["taller_1"],
      flags: { master: "true", compute: "true", comparison: "true", ui: "true" },
    });

    expect(policy.computeEnabled).toBe(true);
    expect(policy.comparisonEnabled).toBe(true);
    expect(policy.uiVisible).toBe(false);
    expect(policy.reasonCode).toBe(ORDEN_SHADOW_POLICY_REASON_CODES.SURFACE_NOT_ALLOWED);
  });

  it("rol no autorizado apaga solo la UI", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "staging",
      workshopUid: "taller_1",
      surface: "diagnostics",
      userRole: "mechanic",
      allowlist: ["taller_1"],
      flags: { master: "true", compute: "true", comparison: "true", ui: "true", allowedRoles: ["internal"] },
    });

    expect(policy.computeEnabled).toBe(true);
    expect(policy.comparisonEnabled).toBe(true);
    expect(policy.uiVisible).toBe(false);
    expect(policy.reasonCode).toBe(ORDEN_SHADOW_POLICY_REASON_CODES.ROLE_NOT_ALLOWED);
  });

  it("configuracion invalida apaga todo", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "staging",
      workshopUid: "taller_1",
      surface: "diagnostics",
      userRole: "internal",
      allowlist: 123,
      flags: "invalid",
    });

    expect(policy.reasonCode).toBe(ORDEN_SHADOW_POLICY_REASON_CODES.CONFIG_INVALID);
    expect(policy.computeEnabled).toBe(false);
    expect(policy.uiVisible).toBe(false);
  });

  it("flags parciales mantienen separadas las capacidades", () => {
    const policy = getOrdenShadowActivationPolicy({
      environment: "production",
      workshopUid: "taller_1",
      surface: "order_detail",
      userRole: "mechanic",
      allowlist: ["taller_1"],
      flags: { master: "true", compute: "true", comparison: "false", ui: "false" },
    });

    expect(policy.computeEnabled).toBe(true);
    expect(policy.comparisonEnabled).toBe(false);
    expect(policy.uiVisible).toBe(false);
    expect(policy.reasonCode).toBe(ORDEN_SHADOW_POLICY_REASON_CODES.ENABLED_INTERNAL);
  });

  it("build desde env preserva el contexto sin exponer detalles en componentes", () => {
    const context = buildOrdenShadowActivationContextFromEnv({
      env: {
        MODE: "staging",
        VITE_WORKSHOP_UID: "taller_1",
        VITE_ORDEN_SHADOW_MASTER: "true",
        VITE_ORDEN_SHADOW_COMPUTE: "true",
        VITE_ORDEN_SHADOW_COMPARISON: "true",
        VITE_ORDEN_SHADOW_UI: "true",
        VITE_ORDEN_SHADOW_WORKSHOP_ALLOWLIST: "taller_1",
      },
      surface: "diagnostics",
      userRole: "internal",
    });

    expect(context.environment).toBe("staging");
    expect(context.workshopUid).toBe("taller_1");
    expect(context.flags.master).toBe("true");
  });

  it("la regla de negocio indefinida devuelve indeterminate", () => {
    const state = getOrdenShadowBusinessRuleState({
      classification: "undefined_business_rule",
      caseKey: "adicionalPendiente",
    });

    expect(state).toMatchObject({
      status: "indeterminate",
      reason: "UNDEFINED_BUSINESS_RULE",
      fallback: "indeterminate",
    });
  });
});

