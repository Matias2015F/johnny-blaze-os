import { evaluarComprobante } from "./comprobante.rules.js";

function crearDecision({ permitido, codigo, mensaje, motivos = [], accionSugerida }) {
  return {
    permitido,
    codigo,
    mensaje,
    motivos,
    accionSugerida,
  };
}

function mapearCodigoComprobante(resultado = {}) {
  if (resultado.publicable && resultado.verificable) return "COMPROBANTE_LISTO";
  if (!resultado.verificable && !resultado.trazabilidadMinima) return "COMPROBANTE_BLOQUEADO_SIN_TRAZABILIDAD";
  if (!resultado.verificable) return "COMPROBANTE_BLOQUEADO_SIN_REQUISITOS";
  return "COMPROBANTE_BLOQUEADO";
}

function mapearMensajeComprobante(codigo) {
  const mensajes = {
    COMPROBANTE_LISTO: "El comprobante cumple las condiciones para verificarse y publicarse.",
    COMPROBANTE_BLOQUEADO_SIN_TRAZABILIDAD: "No podés verificar el comprobante porque falta trazabilidad documental mínima.",
    COMPROBANTE_BLOQUEADO_SIN_REQUISITOS: "No podés verificar el comprobante porque faltan datos obligatorios o el PDF.",
    COMPROBANTE_BLOQUEADO: "No podés procesar el comprobante en su estado actual.",
  };
  return mensajes[codigo] || mensajes.COMPROBANTE_BLOQUEADO;
}

function mapearAccionComprobante(codigo) {
  const acciones = {
    COMPROBANTE_LISTO: "Publicar o verificar comprobante",
    COMPROBANTE_BLOQUEADO_SIN_TRAZABILIDAD: "Completar documentación mínima",
    COMPROBANTE_BLOQUEADO_SIN_REQUISITOS: "Completar campos obligatorios",
    COMPROBANTE_BLOQUEADO: "Revisar comprobante",
  };
  return acciones[codigo] || acciones.COMPROBANTE_BLOQUEADO;
}

export function evaluarServicioComprobante(comprobante = {}) {
  const resultado = evaluarComprobante(comprobante);
  const codigo = !comprobante?.pdfUrl
    ? "COMPROBANTE_BLOQUEADO_SIN_REQUISITOS"
    : mapearCodigoComprobante(resultado);
  return crearDecision({
    permitido: resultado.verificable && resultado.publicable,
    codigo,
    mensaje: mapearMensajeComprobante(codigo),
    motivos: resultado.motivos,
    accionSugerida: mapearAccionComprobante(codigo),
  });
}
