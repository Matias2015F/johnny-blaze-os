import {
  buildOrdenShadowActivationContextFromEnv,
  getOrdenShadowActivationPolicy,
} from "../../shared/policies/ordenShadowActivationPolicy.js";

const DIAGNOSTICS_PATH = "/__diagnostics/orden-shadow";

function normalizePathname(pathname = "") {
  const value = String(pathname || "").replace(/\/+$/, "");
  return value || "/";
}

function normalizeSearch(search = "") {
  return String(search || "");
}

export function isDiagnosticsRouteRequested({ pathname, search } = {}) {
  const normalizedPath = normalizePathname(pathname);
  const normalizedSearch = normalizeSearch(search);
  if (normalizedPath === DIAGNOSTICS_PATH) return true;
  return normalizedPath === "/" && new URLSearchParams(normalizedSearch).get("diagnostics") === "orden-shadow";
}

export function canMountOrdenShadowDiagnostics(env = {}) {
  const policy = getOrdenShadowActivationPolicy(
    buildOrdenShadowActivationContextFromEnv({
      env,
      surface: "diagnostics",
      userRole: "internal",
    }),
  );
  return policy.uiVisible;
}

export function resolveDiagnosticsEntry({ pathname, search, env } = {}) {
  return isDiagnosticsRouteRequested({ pathname, search }) && canMountOrdenShadowDiagnostics(env)
    ? "ORDEN_SHADOW"
    : null;
}
