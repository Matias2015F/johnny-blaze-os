import { prepararDecisionPdfOrden, prepararDecisionProximaAccionOrden } from "./orden.applicationService.js";
import { evaluarLegacyOrdenParaPdf } from "./orden.adapter.js";

const SOURCE = "orden.shadowIntegration";
const LEGACY_STATE_KEYS = ["estado", "status", "state", "cobrado", "pagado", "retirado", "motoRetirada", "entregado"];

function clonar(valor) {
  return valor == null ? valor : JSON.parse(JSON.stringify(valor));
}

function crearResultado({ decisionPdf, proximaAccion, warnings = [], divergencias = [], comparacionLegacyDisponible = false }) {
  return {
    enabled: true,
    source: SOURCE,
    decisionPdf,
    proximaAccion,
    warnings: [...warnings],
    divergencias: [...divergencias],
    comparacionLegacyDisponible,
  };
}

function extraerCodigoLegacy(legacyDecision = {}) {
  if (!legacyDecision) return null;
  if (typeof legacyDecision === "string") return legacyDecision;
  return legacyDecision.codigo || legacyDecision.code || null;
}

function tieneDecisionLegacyComparable(legacyOrden = {}, legacyDecision = null) {
  if (legacyDecision) return true;
  return LEGACY_STATE_KEYS.some((key) => {
    const value = legacyOrden?.[key];
    return value !== undefined && value !== null && value !== "";
  });
}

export function compararDecisionLegacyVsDomain(legacyOrden = {}, legacyDecisionOpcional = null) {
  const decisionPdf = prepararDecisionPdfOrden(legacyOrden);
  const legacyDecision = legacyDecisionOpcional || evaluarLegacyOrdenParaPdf(legacyOrden);
  const codigoLegacy = extraerCodigoLegacy(legacyDecision);
  const divergencias = [];
  const warnings = [];
  const comparacionLegacyDisponible = tieneDecisionLegacyComparable(legacyOrden, legacyDecisionOpcional);

  if (comparacionLegacyDisponible && codigoLegacy && codigoLegacy !== decisionPdf.codigo) {
    divergencias.push({
      campo: "codigo",
      legacy: codigoLegacy,
      domain: decisionPdf.codigo,
    });
  }

  if (comparacionLegacyDisponible && typeof legacyDecision?.permitido === "boolean" && legacyDecision.permitido !== decisionPdf.permitido) {
    divergencias.push({
      campo: "permitido",
      legacy: legacyDecision.permitido,
      domain: decisionPdf.permitido,
    });
  }

  if (!decisionPdf.permitido) {
    warnings.push("PDF_BLOQUEADO_EN_SHADOW");
  }

  if (!legacyOrden?.id || !legacyOrden?.clientId && !legacyOrden?.cliente && !legacyOrden?.bikeId && !legacyOrden?.moto) {
    warnings.push("ORDEN_LEGACY_INCOMPLETA");
  }

  if (!comparacionLegacyDisponible) {
    warnings.push("COMPARACION_LEGACY_NO_DISPONIBLE");
  }

  if (decisionPdf.codigo === "PDF_BLOQUEADO_MOTO_NO_RETIRADA") {
    warnings.push("MOTO_NO_RETIRADA");
  }

  if (decisionPdf.codigo === "PDF_BLOQUEADO_CANCELADO") {
    warnings.push("ORDEN_CANCELADA");
  }

  return crearResultado({
    decisionPdf,
    proximaAccion: prepararDecisionProximaAccionOrden(legacyOrden),
    warnings,
    divergencias,
    comparacionLegacyDisponible,
  });
}

export function evaluarOrdenShadow(legacyOrden = {}) {
  return compararDecisionLegacyVsDomain(legacyOrden);
}

export function crearResumenShadowOrden(legacyOrden = {}) {
  const orden = clonar(legacyOrden) || {};
  const shadow = evaluarOrdenShadow(orden);
  return {
    enabled: shadow.enabled,
    source: shadow.source,
    orden,
    decisionPdf: shadow.decisionPdf,
    proximaAccion: shadow.proximaAccion,
    warnings: shadow.warnings,
    divergencias: shadow.divergencias,
    comparacionLegacyDisponible: shadow.comparacionLegacyDisponible,
  };
}
