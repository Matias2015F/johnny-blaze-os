import {
  evaluarLegacyBeneficioParaOrden,
  evaluarLegacyRatingParaPublicacion,
} from "./reputacion.adapter.js";

const SOURCE = "reputacion.applicationService";

function crearDecision(decision = {}) {
  return {
    permitido: Boolean(decision.permitido),
    codigo: decision.codigo || "REPUTACION_SIN_CODIGO",
    mensaje: decision.mensaje || "",
    motivos: Array.isArray(decision.motivos) ? [...decision.motivos] : [],
    accionSugerida: decision.accionSugerida || "",
    source: SOURCE,
  };
}

export function prepararDecisionPublicacionCalificacion(legacyRating = {}) {
  return crearDecision(evaluarLegacyRatingParaPublicacion(legacyRating));
}

export function prepararDecisionAplicacionBeneficio(legacyBenefit = {}, legacyOrden = {}) {
  return crearDecision(evaluarLegacyBeneficioParaOrden(legacyBenefit, legacyOrden));
}

export function prepararEstadoBeneficioParaVista(legacyBenefit = {}, legacyOrden = {}) {
  const decision = prepararDecisionAplicacionBeneficio(legacyBenefit, legacyOrden);
  const calificacion = prepararDecisionPublicacionCalificacion(legacyBenefit?.rating ?? legacyBenefit?.calificacion ?? {});
  return {
    source: SOURCE,
    beneficio: { ...legacyBenefit },
    orden: { ...legacyOrden },
    decisionBeneficio: decision,
    decisionCalificacion: calificacion,
    permitido: decision.permitido,
    codigo: decision.codigo,
    mensaje: decision.mensaje,
    motivos: decision.motivos,
    accionSugerida: decision.accionSugerida,
  };
}

