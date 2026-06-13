import { evaluarCierreOrden, evaluarEstadoOrden, evaluarPdfFinal } from "./orden.rules.js";

function crearDecision({ permitido, codigo, mensaje, motivos = [], accionSugerida }) {
  return {
    permitido,
    codigo,
    mensaje,
    motivos,
    accionSugerida,
  };
}

function mapearCodigoPdf(orden = {}, resultado = {}) {
  if (resultado.permitido) return "PDF_LISTO";
  if (resultado.esCobradaPendienteRetiro) return "PDF_BLOQUEADO_MOTO_NO_RETIRADA";
  if (String(orden.estado || "").toUpperCase() === "CANCELADO") return "PDF_BLOQUEADO_CANCELADO";
  if (!resultado.esEntregada) return "PDF_BLOQUEADO_NO_ENTREGADO";
  if (!resultado.tieneDatosMinimos) return "PDF_BLOQUEADO_DATOS_INCOMPLETOS";
  return "PDF_BLOQUEADO";
}

function mapearMensajePdf(codigo) {
  const mensajes = {
    PDF_LISTO: "La orden ya cumple las condiciones para generar el PDF final.",
    PDF_BLOQUEADO_MOTO_NO_RETIRADA: "No podés generar el PDF final porque la moto todavía no fue retirada.",
    PDF_BLOQUEADO_CANCELADO: "No podés generar el PDF final porque la orden fue cancelada.",
    PDF_BLOQUEADO_NO_ENTREGADO: "No podés generar el PDF final porque la orden todavía no fue entregada.",
    PDF_BLOQUEADO_DATOS_INCOMPLETOS: "No podés generar el PDF final porque faltan datos obligatorios.",
    PDF_BLOQUEADO: "No podés generar el PDF final en el estado actual.",
  };
  return mensajes[codigo] || mensajes.PDF_BLOQUEADO;
}

function mapearAccionPdf(codigo) {
  const acciones = {
    PDF_LISTO: "Generar PDF final",
    PDF_BLOQUEADO_MOTO_NO_RETIRADA: "Confirmar retiro de moto",
    PDF_BLOQUEADO_CANCELADO: "Revisar orden cancelada",
    PDF_BLOQUEADO_NO_ENTREGADO: "Completar trabajo o retiro",
    PDF_BLOQUEADO_DATOS_INCOMPLETOS: "Completar datos requeridos para PDF",
    PDF_BLOQUEADO: "Completar revisión de la orden",
  };
  return acciones[codigo] || acciones.PDF_BLOQUEADO;
}

export function evaluarServicioPdfFinal(orden = {}) {
  const resultado = evaluarPdfFinal(orden);
  const codigo = mapearCodigoPdf(orden, resultado);
  return crearDecision({
    permitido: resultado.permitido,
    codigo,
    mensaje: mapearMensajePdf(codigo),
    motivos: resultado.motivos,
    accionSugerida: mapearAccionPdf(codigo),
  });
}

export function evaluarServicioEstadoOrden(orden = {}) {
  const resultado = evaluarEstadoOrden(orden);
  const pdf = evaluarServicioPdfFinal(orden);
  return crearDecision({
    permitido: resultado.puedeAvanzarAPdf,
    codigo: pdf.codigo,
    mensaje: pdf.mensaje,
    motivos: resultado.motivos,
    accionSugerida: resultado.proximaAccion,
  });
}

export function evaluarServicioCierreOrden(orden = {}) {
  const resultado = evaluarCierreOrden(orden);
  const pdf = evaluarServicioPdfFinal(orden);
  return crearDecision({
    permitido: resultado.puedeCerrar && pdf.permitido,
    codigo: pdf.codigo,
    mensaje: pdf.mensaje,
    motivos: resultado.motivos,
    accionSugerida: pdf.accionSugerida,
  });
}

