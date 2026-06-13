function readEnv() {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    return import.meta.env;
  }
  return {};
}

function isTrueFlag(value) {
  return String(value || "").toLowerCase() === "true";
}

export function isOrdenShadowDiagnosticsEnabled(env = readEnv()) {
  return isTrueFlag(env.VITE_ENABLE_ORDEN_SHADOW_DIAGNOSTICS);
}

export function isOrdenShadowOnOrderDetailEnabled(env = readEnv()) {
  return isTrueFlag(env.VITE_ENABLE_ORDEN_SHADOW_ON_ORDER_DETAIL);
}

export function getFeatureFlags(env = readEnv()) {
  return {
    ORDEN_SHADOW_DIAGNOSTICS: isOrdenShadowDiagnosticsEnabled(env),
    ORDEN_SHADOW_ON_ORDER_DETAIL: isOrdenShadowOnOrderDetailEnabled(env),
  };
}

export const FEATURE_FLAGS = {
  ...getFeatureFlags(),
};
