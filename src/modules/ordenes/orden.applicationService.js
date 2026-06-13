import {
  evaluarLegacyOrdenParaPdf,
  evaluarLegacyOrdenParaVista,
  obtenerProximaAccionDesdeOrdenLegacy,
} from "./orden.adapter.js";

const SOURCE = "orden.applicationService";

function crearDecision(decision = {}, extras = {}) {
  return {
    permitido: Boolean(decision.permitido),
    codigo: decision.codigo || "ORDEN_SIN_CODIGO",
    mensaje: decision.mensaje || "",
    motivos: Array.isArray(decision.motivos) ? [...decision.motivos] : [],
    accionSugerida: decision.accionSugerida || "",
    source: SOURCE,
    ...extras,
  };
}

export function prepararDecisionPdfOrden(legacyOrden = {}) {
  return crearDecision(evaluarLegacyOrdenParaPdf(legacyOrden));
}

export function prepararDecisionCierreOrden(legacyOrden = {}) {
  const vista = evaluarLegacyOrdenParaVista(legacyOrden);
  return crearDecision(vista.decisionCierre, {
    accionSugerida: vista.decisionCierre?.accionSugerida || vista.decisionEstado?.accionSugerida || "",
  });
}

export function prepararDecisionProximaAccionOrden(legacyOrden = {}) {
  const vista = evaluarLegacyOrdenParaVista(legacyOrden);
  return crearDecision(
    {
      permitido: false,
      codigo: vista.decisionEstado?.codigo || "ORDEN_SIN_CODIGO",
      mensaje: vista.decisionEstado?.mensaje || "",
      motivos: vista.decisionEstado?.motivos || [],
      accionSugerida: obtenerProximaAccionDesdeOrdenLegacy(legacyOrden),
    },
  );
}

export function prepararEstadoOrdenParaVista(legacyOrden = {}) {
  const vista = evaluarLegacyOrdenParaVista(legacyOrden);
  const pdf = prepararDecisionPdfOrden(legacyOrden);
  const cierre = prepararDecisionCierreOrden(legacyOrden);
  return {
    source: SOURCE,
    orden: vista.orden,
    decisionEstado: crearDecision(vista.decisionEstado),
    decisionPdf: pdf,
    decisionCierre: cierre,
    proximaAccion: obtenerProximaAccionDesdeOrdenLegacy(legacyOrden),
  };
}

