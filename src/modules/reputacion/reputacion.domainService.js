import { evaluarBeneficio, evaluarCalificacion } from "./reputacion.rules.js";

function crearDecision({ permitido, codigo, mensaje, motivos = [], accionSugerida }) {
  return {
    permitido,
    codigo,
    mensaje,
    motivos,
    accionSugerida,
  };
}

function mapearCodigoCalificacion(resultado = {}) {
  if (resultado.publicable) return "CALIFICACION_LISTA";
  return "CALIFICACION_BLOQUEADA_TOKEN_INVALIDO";
}

function mapearMensajeCalificacion(codigo) {
  const mensajes = {
    CALIFICACION_LISTA: "La calificación cumple las condiciones para publicarse.",
    CALIFICACION_BLOQUEADA_TOKEN_INVALIDO: "No podés publicar la calificación porque el token no es válido.",
  };
  return mensajes[codigo] || mensajes.CALIFICACION_BLOQUEADA_TOKEN_INVALIDO;
}

function mapearAccionCalificacion(codigo) {
  const acciones = {
    CALIFICACION_LISTA: "Publicar calificación",
    CALIFICACION_BLOQUEADA_TOKEN_INVALIDO: "Validar token de reseña",
  };
  return acciones[codigo] || acciones.CALIFICACION_BLOQUEADA_TOKEN_INVALIDO;
}

function mapearCodigoBeneficio(resultado = {}) {
  if (resultado.aplicable) return "BENEFICIO_APLICABLE";
  if (resultado.noAplicable) return "BENEFICIO_NO_APLICABLE";
  return "BENEFICIO_BLOQUEADO";
}

function mapearMensajeBeneficio(codigo) {
  const mensajes = {
    BENEFICIO_APLICABLE: "El beneficio puede aplicarse a la próxima atención.",
    BENEFICIO_NO_APLICABLE: "El beneficio no aplica para este contexto.",
    BENEFICIO_BLOQUEADO: "No podés aplicar el beneficio en su estado actual.",
  };
  return mensajes[codigo] || mensajes.BENEFICIO_BLOQUEADO;
}

function mapearAccionBeneficio(codigo) {
  const acciones = {
    BENEFICIO_APLICABLE: "Aplicar descuento",
    BENEFICIO_NO_APLICABLE: "Revisar beneficio o contexto",
    BENEFICIO_BLOQUEADO: "Revisar reglas de beneficio",
  };
  return acciones[codigo] || acciones.BENEFICIO_BLOQUEADO;
}

export function evaluarServicioCalificacion(calificacion = {}) {
  const resultado = evaluarCalificacion(calificacion);
  const codigo = mapearCodigoCalificacion(resultado);
  return crearDecision({
    permitido: resultado.publicable,
    codigo,
    mensaje: mapearMensajeCalificacion(codigo),
    motivos: resultado.publicable ? [] : ["Token de reseña inválido o incompleto"],
    accionSugerida: mapearAccionCalificacion(codigo),
  });
}

export function evaluarServicioBeneficio(beneficio = {}, contexto = {}) {
  const resultado = evaluarBeneficio(beneficio, contexto);
  const codigo = mapearCodigoBeneficio(resultado);
  return crearDecision({
    permitido: resultado.aplicable,
    codigo,
    mensaje: mapearMensajeBeneficio(codigo),
    motivos: resultado.motivos,
    accionSugerida: mapearAccionBeneficio(codigo),
  });
}

