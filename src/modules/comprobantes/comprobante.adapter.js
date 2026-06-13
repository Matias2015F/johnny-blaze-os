import { evaluarServicioComprobante } from "./comprobante.domainService.js";

function clonar(valor) {
  return valor == null ? valor : JSON.parse(JSON.stringify(valor));
}

function obtenerComprobanteId(legacyComprobante = {}) {
  return legacyComprobante.comprobanteId || legacyComprobante.receiptId || legacyComprobante.id || legacyComprobante.uid || "";
}

function obtenerEstadoVerificacion(legacyComprobante = {}) {
  const estado = legacyComprobante.estadoVerificacion || legacyComprobante.verificacion || legacyComprobante.verificationState || legacyComprobante.estado || "PENDIENTE";
  return String(estado || "PENDIENTE").toUpperCase();
}

function obtenerFechaCierre(legacyComprobante = {}) {
  return legacyComprobante.fechaCierre || legacyComprobante.closedAt || legacyComprobante.cierreAt || legacyComprobante.fecha || "";
}

function obtenerTrazabilidadBase(legacyComprobante = {}) {
  return {
    comprobanteId: obtenerComprobanteId(legacyComprobante),
    tallerId: legacyComprobante.tallerId || legacyComprobante.taller?.id || legacyComprobante.workshopUid || "",
    clienteId: legacyComprobante.clienteId || legacyComprobante.cliente?.id || legacyComprobante.customerId || "",
    motoId: legacyComprobante.motoId || legacyComprobante.moto?.id || legacyComprobante.bikeId || "",
    ordenId: legacyComprobante.ordenId || legacyComprobante.orderId || legacyComprobante.workOrderId || "",
    pdfUrl: legacyComprobante.pdfUrl || legacyComprobante.pdf || legacyComprobante.urlPdf || "",
    garantia: legacyComprobante.garantia || legacyComprobante.garantiaFinal || "",
    excepciones: legacyComprobante.excepciones || legacyComprobante.cierreRechazo?.excepciones || "",
    recomendaciones: legacyComprobante.recomendaciones || legacyComprobante.observaciones || "",
    trabajosRealizados: legacyComprobante.trabajosRealizados || legacyComprobante.trabajos || [],
    repuestos: legacyComprobante.repuestos || [],
    pagos: legacyComprobante.pagos || [],
    fechaCierre: obtenerFechaCierre(legacyComprobante),
    estadoVerificacion: obtenerEstadoVerificacion(legacyComprobante),
  };
}

export function mapLegacyComprobanteToDomainComprobante(legacyComprobante = {}) {
  const comprobante = clonar(legacyComprobante) || {};
  return {
    ...comprobante,
    ...obtenerTrazabilidadBase(comprobante),
  };
}

export function evaluarLegacyComprobanteParaVerificacion(legacyComprobante = {}) {
  return evaluarServicioComprobante(mapLegacyComprobanteToDomainComprobante(legacyComprobante));
}

export function evaluarLegacyComprobanteParaPublicacion(legacyComprobante = {}) {
  return evaluarLegacyComprobanteParaVerificacion(legacyComprobante);
}

