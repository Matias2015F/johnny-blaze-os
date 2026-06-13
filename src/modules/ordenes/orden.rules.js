import {
  esCierrePdfValido,
  hasDatosMinimosParaPdf,
  isOrdenCobradaPendienteRetiro,
  isOrdenEntregada,
  isPdfFinalPermitido,
} from "./orden.contract.js";

export function evaluarEstadoOrden(orden = {}) {
  const motivos = obtenerMotivosBloqueoPdf(orden);
  return {
    puedeAvanzarAPdf: motivos.length === 0,
    esCobradaPendienteRetiro: isOrdenCobradaPendienteRetiro(orden),
    esEntregada: isOrdenEntregada(orden),
    tieneDatosMinimos: hasDatosMinimosParaPdf(orden),
    pdfPermitido: isPdfFinalPermitido(orden.estado) && esCierrePdfValido(orden),
    motivos,
    proximaAccion: obtenerProximaAccionOrden(orden),
  };
}

export function evaluarCierreOrden(orden = {}) {
  return {
    puedeCerrar: isOrdenEntregada(orden) && hasDatosMinimosParaPdf(orden),
    puedeGenerarPdfFinal: evaluarPdfFinal(orden).permitido,
    motivos: obtenerMotivosBloqueoPdf(orden),
  };
}

export function evaluarPdfFinal(orden = {}) {
  const motivos = obtenerMotivosBloqueoPdf(orden);
  const estadoCancelado = String(orden.estado || "").toUpperCase() === "CANCELADO";
  return {
    permitido: motivos.length === 0 && !estadoCancelado,
    motivos,
    tieneDatosMinimos: hasDatosMinimosParaPdf(orden),
    esEntregada: isOrdenEntregada(orden),
    esCobradaPendienteRetiro: isOrdenCobradaPendienteRetiro(orden),
  };
}

export function obtenerMotivosBloqueoPdf(orden = {}) {
  const motivos = [];

  if (!orden) {
    return ["Orden inexistente"];
  }

  if (isOrdenCobradaPendienteRetiro(orden)) {
    motivos.push("La orden estÃ¡ cobrada pero la moto aÃºn no fue retirada");
  }

  if (String(orden.estado || "") === "CANCELADO") {
    motivos.push("La orden está cancelada");
  }

  if (!isOrdenEntregada(orden)) {
    motivos.push("La orden aún no fue entregada");
  }

  if (!isPdfFinalPermitido(orden.estado)) {
    motivos.push("El estado actual no permite PDF final");
  }

  if (!orden.tallerId) motivos.push("Falta tallerId");
  if (!orden.clientId) motivos.push("Falta clientId");
  if (!orden.bikeId) motivos.push("Falta bikeId");
  if (!orden.id) motivos.push("Falta id de orden");

  if (!String(orden.garantiaFinal || orden.garantia || "").trim()) {
    motivos.push("Falta garantÃ­a");
  }

  if (!String(orden.cierreRechazo?.excepciones || orden.excepciones || "").trim()) {
    motivos.push("Faltan excepciones");
  }

  if (!String(orden.cierreRechazo?.observaciones || orden.observaciones || orden.recomendaciones || "").trim()) {
    motivos.push("Faltan observaciones o recomendaciones");
  }

  if (!hasDatosMinimosParaPdf(orden)) {
    motivos.push("Faltan datos mÃ­nimos para PDF");
  }

  return [...new Set(motivos)];
}

export function obtenerProximaAccionOrden(orden = {}) {
  if (isOrdenCobradaPendienteRetiro(orden)) return "Confirmar retiro de moto";
  if (!isOrdenEntregada(orden)) return "Completar trabajo o retiro";
  if (hasDatosMinimosParaPdf(orden)) return "Generar PDF final";
  return "Completar datos requeridos para PDF";
}



