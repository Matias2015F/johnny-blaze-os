import { mapLegacyOrdenToDomainOrden } from "./orden.adapter.js";
import { evaluarOrdenShadow } from "./orden.shadowIntegration.js";
import { presentarDecisionShadowOrden } from "./orden.shadowPresenter.js";
import { obtenerOrdenShadowFixture } from "./fixtures/ordenShadowFixtures.js";
import { FEATURE_FLAGS } from "../../shared/constants/featureFlags.js";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function selectLegacyOrden({ legacyOrden, fixtureKey } = {}) {
  if (legacyOrden) return clone(legacyOrden);
  return clone(obtenerOrdenShadowFixture(fixtureKey));
}

function detectLegacyState(orden = {}) {
  return String(orden?.estado || orden?.status || orden?.state || "").trim() || "SIN_ESTADO";
}

export function prepararOrdenShadowDiagnosticsViewModel(params = {}) {
  const legacyOrden = selectLegacyOrden(params);
  const domainOrden = mapLegacyOrdenToDomainOrden(legacyOrden);
  const shadowResult = evaluarOrdenShadow(legacyOrden);
  const panel = presentarDecisionShadowOrden(shadowResult);

  return {
    enabled: FEATURE_FLAGS.ORDEN_SHADOW_DIAGNOSTICS,
    source: "orden.shadowDiagnosticsPresenter",
    legacyEstado: detectLegacyState(legacyOrden),
    estadoNormalizado: domainOrden.estado,
    legacyOrden,
    domainOrden,
    shadowResult,
    panel,
  };
}

