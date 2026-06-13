const DEFAULT_ALLOWED_ENVIRONMENTS = ["production", "staging", "internal"];
const DEFAULT_ALLOWED_SURFACES = ["diagnostics", "order_detail"];
const DEFAULT_ALLOWED_ROLES = ["internal", "admin", "owner", "support"];
const DISALLOWED_ENVIRONMENTS = new Set(["development", "dev", "test", "ci", "local"]);

export const ORDEN_SHADOW_POLICY_REASON_CODES = Object.freeze({
  MASTER_DISABLED: "MASTER_DISABLED",
  ENVIRONMENT_NOT_ALLOWED: "ENVIRONMENT_NOT_ALLOWED",
  WORKSHOP_MISSING: "WORKSHOP_MISSING",
  WORKSHOP_NOT_ALLOWLISTED: "WORKSHOP_NOT_ALLOWLISTED",
  SURFACE_NOT_ALLOWED: "SURFACE_NOT_ALLOWED",
  ROLE_NOT_ALLOWED: "ROLE_NOT_ALLOWED",
  CONFIG_INVALID: "CONFIG_INVALID",
  ENABLED_INTERNAL: "ENABLED_INTERNAL",
  ENABLED_STAGING: "ENABLED_STAGING",
});

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isExactTrue(value) {
  return String(value ?? "").trim().toLowerCase() === "true";
}

function normalizeToken(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeList(value) {
  if (value == null || value === "") {
    return { valid: true, value: [] };
  }

  if (Array.isArray(value)) {
    return {
      valid: true,
      value: Array.from(new Set(value.map(normalizeToken).filter(Boolean))),
    };
  }

  if (value instanceof Set) {
    return {
      valid: true,
      value: Array.from(new Set(Array.from(value).map(normalizeToken).filter(Boolean))),
    };
  }

  if (typeof value === "string") {
    return {
      valid: true,
      value: Array.from(new Set(value.split(",").map(normalizeToken).filter(Boolean))),
    };
  }

  return { valid: false, value: [] };
}

function parseFlagSet(flags = {}) {
  if (!isPlainObject(flags)) {
    return { valid: false };
  }

  const allowedEnvironments = normalizeList(flags.allowedEnvironments ?? flags.environments ?? DEFAULT_ALLOWED_ENVIRONMENTS);
  const allowedSurfaces = normalizeList(flags.allowedSurfaces ?? flags.surfaces ?? DEFAULT_ALLOWED_SURFACES);
  const allowedRoles = normalizeList(flags.allowedRoles ?? flags.roles ?? DEFAULT_ALLOWED_ROLES);

  return {
    valid: allowedEnvironments.valid && allowedSurfaces.valid && allowedRoles.valid,
    masterEnabled: isExactTrue(flags.master ?? flags.masterEnabled ?? flags.killSwitch ?? flags.enabled),
    computeEnabled: isExactTrue(flags.compute ?? flags.shadowComputeEnabled),
    comparisonEnabled: isExactTrue(flags.comparison ?? flags.shadowComparisonEnabled),
    uiVisibleEnabled: isExactTrue(flags.ui ?? flags.shadowUiVisible),
    allowedEnvironments: allowedEnvironments.value,
    allowedSurfaces: allowedSurfaces.value,
    allowedRoles: allowedRoles.value,
  };
}

function normalizeEnvironment(environment) {
  return normalizeToken(environment);
}

function getReasonResult({ computeEnabled, comparisonEnabled, uiVisible, reasonCode, environment }) {
  return {
    computeEnabled,
    comparisonEnabled,
    uiVisible,
    reasonCode,
    environment,
  };
}

export function parseOrdenShadowActivationConfig(input = {}) {
  if (!isPlainObject(input)) {
    return {
      valid: false,
      environment: "",
      workshopUid: "",
      surface: "",
      userRole: "",
      allowlist: [],
      flags: {
        masterEnabled: false,
        computeEnabled: false,
        comparisonEnabled: false,
        uiVisibleEnabled: false,
        allowedEnvironments: DEFAULT_ALLOWED_ENVIRONMENTS,
        allowedSurfaces: DEFAULT_ALLOWED_SURFACES,
        allowedRoles: DEFAULT_ALLOWED_ROLES,
      },
    };
  }

  const allowlist = normalizeList(input.allowlist);
  const flags = parseFlagSet(input.flags);

  return {
    valid: allowlist.valid && flags.valid,
    environment: normalizeEnvironment(input.environment),
    workshopUid: normalizeText(input.workshopUid),
    surface: normalizeToken(input.surface),
    userRole: normalizeToken(input.userRole),
    allowlist: allowlist.value,
    flags,
  };
}

export function buildOrdenShadowActivationContextFromEnv({
  env = {},
  workshopUid = "",
  surface = "",
  userRole = "",
} = {}) {
  return {
    environment: env.VITE_ORDEN_SHADOW_ENVIRONMENT || env.VITE_ENVIRONMENT || env.MODE || env.NODE_ENV,
    workshopUid: workshopUid || env.VITE_WORKSHOP_UID || env.VITE_ORDEN_SHADOW_WORKSHOP_UID || "",
    surface,
    userRole,
    flags: {
      master: env.VITE_ORDEN_SHADOW_MASTER || env.VITE_ENABLE_ORDEN_SHADOW_DIAGNOSTICS || env.VITE_ENABLE_ORDEN_SHADOW_ON_ORDER_DETAIL,
      compute: env.VITE_ORDEN_SHADOW_COMPUTE || env.VITE_ENABLE_ORDEN_SHADOW_ON_ORDER_DETAIL,
      comparison: env.VITE_ORDEN_SHADOW_COMPARISON || env.VITE_ENABLE_ORDEN_SHADOW_ON_ORDER_DETAIL,
      ui: env.VITE_ORDEN_SHADOW_UI || env.VITE_ENABLE_ORDEN_SHADOW_ON_ORDER_DETAIL,
      allowedEnvironments: env.VITE_ORDEN_SHADOW_ENVIRONMENTS,
      allowedSurfaces: env.VITE_ORDEN_SHADOW_SURFACES,
      allowedRoles: env.VITE_ORDEN_SHADOW_ROLES,
    },
    allowlist: env.VITE_ORDEN_SHADOW_WORKSHOP_ALLOWLIST,
  };
}

export function getOrdenShadowActivationPolicy({
  environment,
  workshopUid,
  surface,
  userRole,
  flags,
  allowlist,
} = {}) {
  const config = parseOrdenShadowActivationConfig({
    environment,
    workshopUid,
    surface,
    userRole,
    flags,
    allowlist,
  });

  if (!config.valid) {
    return getReasonResult({
      computeEnabled: false,
      comparisonEnabled: false,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.CONFIG_INVALID,
      environment: config.environment,
    });
  }

  if (!config.flags.masterEnabled) {
    return getReasonResult({
      computeEnabled: false,
      comparisonEnabled: false,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.MASTER_DISABLED,
      environment: config.environment,
    });
  }

  if (!config.environment || DISALLOWED_ENVIRONMENTS.has(config.environment) || !config.flags.allowedEnvironments.includes(config.environment)) {
    return getReasonResult({
      computeEnabled: false,
      comparisonEnabled: false,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.ENVIRONMENT_NOT_ALLOWED,
      environment: config.environment,
    });
  }

  if (!config.workshopUid) {
    return getReasonResult({
      computeEnabled: false,
      comparisonEnabled: false,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.WORKSHOP_MISSING,
      environment: config.environment,
    });
  }

  if (config.allowlist.length === 0 || !config.allowlist.includes(config.workshopUid)) {
    return getReasonResult({
      computeEnabled: false,
      comparisonEnabled: false,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.WORKSHOP_NOT_ALLOWLISTED,
      environment: config.environment,
    });
  }

  const computeEnabled = config.flags.computeEnabled;
  const comparisonEnabled = computeEnabled && config.flags.comparisonEnabled;
  const surfaceAllowed = config.flags.allowedSurfaces.includes(config.surface);
  const roleAllowed = config.flags.allowedRoles.includes(config.userRole);
  const uiCandidate = comparisonEnabled && config.flags.uiVisibleEnabled;

  if (uiCandidate && !surfaceAllowed) {
    return getReasonResult({
      computeEnabled,
      comparisonEnabled,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.SURFACE_NOT_ALLOWED,
      environment: config.environment,
    });
  }

  if (uiCandidate && surfaceAllowed && !roleAllowed) {
    return getReasonResult({
      computeEnabled,
      comparisonEnabled,
      uiVisible: false,
      reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.ROLE_NOT_ALLOWED,
      environment: config.environment,
    });
  }

  const uiVisible = uiCandidate && surfaceAllowed && roleAllowed;

  if (uiVisible) {
    return getReasonResult({
      computeEnabled,
      comparisonEnabled,
      uiVisible: true,
      reasonCode: config.environment === "staging"
        ? ORDEN_SHADOW_POLICY_REASON_CODES.ENABLED_STAGING
        : ORDEN_SHADOW_POLICY_REASON_CODES.ENABLED_INTERNAL,
      environment: config.environment,
    });
  }

  if (computeEnabled || comparisonEnabled) {
    return getReasonResult({
      computeEnabled,
      comparisonEnabled,
      uiVisible: false,
      reasonCode: config.environment === "staging"
        ? ORDEN_SHADOW_POLICY_REASON_CODES.ENABLED_STAGING
        : ORDEN_SHADOW_POLICY_REASON_CODES.ENABLED_INTERNAL,
      environment: config.environment,
    });
  }

  return getReasonResult({
    computeEnabled: false,
    comparisonEnabled: false,
    uiVisible: false,
    reasonCode: ORDEN_SHADOW_POLICY_REASON_CODES.CONFIG_INVALID,
    environment: config.environment,
  });
}

export function getOrdenShadowBusinessRuleState({
  classification,
  caseKey = "",
  ruleId = "",
  affectedCases = [],
} = {}) {
  if (classification !== "undefined_business_rule") {
    return {
      status: "resolved",
      reason: null,
      fallback: null,
      ruleId: ruleId || null,
      affectedCases: Array.isArray(affectedCases) ? [...affectedCases] : [],
    };
  }

  return {
    status: "indeterminate",
    reason: "UNDEFINED_BUSINESS_RULE",
    fallback: "indeterminate",
    ruleId: ruleId || `ORDER_${String(caseKey || "UNKNOWN").toUpperCase()}`,
    affectedCases: Array.isArray(affectedCases) ? [...affectedCases] : (caseKey ? [caseKey] : []),
  };
}

