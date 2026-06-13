import {
  evaluarLegacyComprobanteParaPublicacion,
  evaluarLegacyComprobanteParaVerificacion,
} from "./comprobante.adapter.js";

const SOURCE = "comprobante.applicationService";

function crearDecision(decision = {}) {
  return {
    permitido: Boolean(decision.permitido),
    codigo: decision.codigo || "COMPROBANTE_SIN_CODIGO",
    mensaje: decision.mensaje || "",
    motivos: Array.isArray(decision.motivos) ? [...decision.motivos] : [],
    accionSugerida: decision.accionSugerida || "",
    source: SOURCE,
  };
}

export function prepararDecisionVerificacionComprobante(legacyComprobante = {}) {
  return crearDecision(evaluarLegacyComprobanteParaVerificacion(legacyComprobante));
}

export function prepararDecisionPublicacionComprobante(legacyComprobante = {}) {
  return crearDecision(evaluarLegacyComprobanteParaPublicacion(legacyComprobante));
}

export function prepararEstadoComprobanteParaVista(legacyComprobante = {}) {
  const verificacion = prepararDecisionVerificacionComprobante(legacyComprobante);
  const publicacion = prepararDecisionPublicacionComprobante(legacyComprobante);
  return {
    source: SOURCE,
    comprobante: { ...legacyComprobante },
    decisionVerificacion: verificacion,
    decisionPublicacion: publicacion,
    permitido: verificacion.permitido && publicacion.permitido,
    codigo: verificacion.codigo,
    mensaje: verificacion.mensaje,
    motivos: verificacion.motivos,
    accionSugerida: verificacion.accionSugerida,
  };
}

