import {
  hasCamposObligatoriosComprobante,
  hasTrazabilidadDocumentalMinima,
  isComprobantePublicable,
  isComprobanteVerificable,
} from "./comprobante.contract.js";

export function evaluarComprobante(comprobante = {}) {
  return {
    publicable: isComprobanteListoParaPublicacion(comprobante),
    verificable: isComprobanteListoParaVerificacion(comprobante),
    trazabilidadMinima: hasTrazabilidadDocumentalMinima(comprobante),
    motivos: obtenerMotivosBloqueoComprobante(comprobante),
  };
}

export function obtenerMotivosBloqueoComprobante(comprobante = {}) {
  const motivos = [];
  if (!comprobante) return ["Comprobante inexistente"];

  if (!hasCamposObligatoriosComprobante(comprobante)) {
    motivos.push("Faltan campos obligatorios");
  }

  if (!comprobante.pdfUrl) {
    motivos.push("Falta pdfUrl");
  }

  if (!hasTrazabilidadDocumentalMinima(comprobante)) {
    motivos.push("Falta trazabilidad documental mínima");
  }

  if (!isComprobanteVerificable(comprobante)) {
    motivos.push("No es verificable");
  }

  return [...new Set(motivos)];
}

export function isComprobanteListoParaVerificacion(comprobante = {}) {
  return isComprobanteVerificable(comprobante) && hasTrazabilidadDocumentalMinima(comprobante);
}

export function isComprobanteListoParaPublicacion(comprobante = {}) {
  return isComprobantePublicable(comprobante) && hasTrazabilidadDocumentalMinima(comprobante);
}
