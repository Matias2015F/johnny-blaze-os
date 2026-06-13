import { crearSnapshotDiagnosticoOrden, sanitizarOrdenParaDiagnostico } from "../../ordenes/orden.sanitizer.js";
import { evaluarOrdenShadow } from "../../ordenes/orden.shadowIntegration.js";
import { presentarDecisionShadowOrden } from "../../ordenes/orden.shadowPresenter.js";
import {
  buildOrdenShadowActivationContextFromEnv,
  getOrdenShadowActivationPolicy,
} from "../../../shared/policies/ordenShadowActivationPolicy.js";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function isPlainOrder(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function createFallback(reason = "DIAGNOSTICO_NO_DISPONIBLE") {
  return {
    mounted: false,
    enabled: false,
    reason,
    source: "orden.shadowReadOnlyBridge",
    notice: reason === "INVALID_ORDER" ? "No hay una orden valida para diagnosticar." : "Diagnostico sombra no disponible.",
  };
}

function obtenerWorkshopUidDesdeOrden(order = {}) {
  return order?.workshopUid || order?.tallerId || order?.taller?.id || order?.taller?.uid || "";
}

export function shouldMountOrdenShadowReadOnlyBridge({ order, env = {} } = {}) {
  if (!isPlainOrder(order)) return false;
  const policy = getOrdenShadowActivationPolicy(
    buildOrdenShadowActivationContextFromEnv({
      env,
      workshopUid: obtenerWorkshopUidDesdeOrden(order),
      surface: "order_detail",
      userRole: "mechanic",
    }),
  );
  return policy.uiVisible;
}

export function prepararOrdenShadowReadOnlyBridgeViewModel({
  order,
  env = {},
  dependencies = {},
} = {}) {
  const deps = {
    sanitizarOrdenParaDiagnosticoFn: dependencies.sanitizarOrdenParaDiagnosticoFn || sanitizarOrdenParaDiagnostico,
    crearSnapshotDiagnosticoOrdenFn: dependencies.crearSnapshotDiagnosticoOrdenFn || crearSnapshotDiagnosticoOrden,
    evaluarOrdenShadowFn: dependencies.evaluarOrdenShadowFn || evaluarOrdenShadow,
    presentarDecisionShadowOrdenFn: dependencies.presentarDecisionShadowOrdenFn || presentarDecisionShadowOrden,
  };

  if (!isPlainOrder(order)) {
    return createFallback("INVALID_ORDER");
  }

  const activationPolicy = getOrdenShadowActivationPolicy(
    buildOrdenShadowActivationContextFromEnv({
      env,
      workshopUid: obtenerWorkshopUidDesdeOrden(order || {}),
      surface: "order_detail",
      userRole: "mechanic",
    }),
  );

  if (!activationPolicy.computeEnabled) {
    return createFallback("FLAG_DESACTIVADA");
  }

  if (!activationPolicy.uiVisible) {
    return createFallback(activationPolicy.reasonCode || "SURFACE_NOT_ALLOWED");
  }

  try {
    const legacyOrden = clone(order);
    const sanitizedOrden = deps.sanitizarOrdenParaDiagnosticoFn(legacyOrden);
    const snapshot = deps.crearSnapshotDiagnosticoOrdenFn(legacyOrden);
    const shadowResult = deps.evaluarOrdenShadowFn(legacyOrden);
    const panel = deps.presentarDecisionShadowOrdenFn(shadowResult);

    return {
      mounted: true,
      enabled: true,
      source: "orden.shadowReadOnlyBridge",
      orderId: sanitizedOrden.id || sanitizedOrden.ordenId || legacyOrden.id || "",
      legacyEstado: String(legacyOrden.estado || legacyOrden.status || legacyOrden.state || "").trim() || "SIN_ESTADO",
      sanitizedOrder: sanitizedOrden,
      diagnosticSnapshot: snapshot,
      shadowResult,
      panel,
      comparisonAvailable: Boolean(shadowResult?.comparacionLegacyDisponible),
      activationPolicy,
    };
  } catch (error) {
    return {
      mounted: false,
      enabled: true,
      source: "orden.shadowReadOnlyBridge",
      reason: "DIAGNOSTIC_FAILURE",
      errorCode: error?.code || error?.name || "UNKNOWN",
      notice: "Diagnostico sombra no disponible.",
    };
  }
}

export function prepararOrdenShadowReadOnlyBridgeState(params = {}) {
  return prepararOrdenShadowReadOnlyBridgeViewModel(params);
}
