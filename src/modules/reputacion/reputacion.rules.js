import {
  isBeneficioAplicable,
  isBeneficioNoAplicable,
  isBeneficioShapeValido,
  isCalificacionPublicable,
  isCalificacionShapeValido,
  isEstadoBeneficioValido,
  isEstadoPublicacionValido,
  isTokenReputacionValido as isTokenReputacionValidoContract,
} from "./reputacion.contract.js";

export function evaluarCalificacion(calificacion = {}) {
  return {
    valida: isCalificacionShapeValido(calificacion),
    publicable: isCalificacionPublicable(calificacion) && isTokenReputacionValidoContract(calificacion.token),
    estadoPublicacionValido: isEstadoPublicacionValido(calificacion.estadoPublicacion || "PENDIENTE"),
  };
}

export function evaluarBeneficio(beneficio = {}, contexto = {}) {
  return {
    valido: isBeneficioShapeValido(beneficio),
    aplicable: isBeneficioAplicable(beneficio, contexto),
    noAplicable: isBeneficioNoAplicable(beneficio, contexto),
    motivos: obtenerMotivosBloqueoBeneficio(beneficio, contexto),
  };
}

export function obtenerMotivosBloqueoBeneficio(beneficio = {}, contexto = {}) {
  const motivos = [];
  if (!beneficio) return ["Beneficio inexistente"];

  if (!isBeneficioShapeValido(beneficio)) motivos.push("Faltan campos mínimos del beneficio");
  if (!isEstadoBeneficioValido(beneficio.estado)) motivos.push("Estado de beneficio inválido");
  if (String(beneficio.estado || "") !== "DISPONIBLE") motivos.push("El beneficio no está disponible");
  if (contexto.tallerId && beneficio.tallerId !== contexto.tallerId) motivos.push("No coincide tallerId");
  if (contexto.clienteId && beneficio.clienteId !== contexto.clienteId) motivos.push("No coincide clienteId");
  if (contexto.motoId && beneficio.motoId !== contexto.motoId) motivos.push("No coincide motoId");
  if (beneficio.vencido) motivos.push("El beneficio está vencido");
  if (beneficio.usado || beneficio.used) motivos.push("El beneficio ya fue usado");
  if (!contexto.provieneDeOrdenRealCerradaCalificada) motivos.push("No proviene de orden real cerrada/calificada");
  if (!contexto.esProximaAtencionDeLaMismaMoto) motivos.push("No aplica a la próxima atención de la misma moto");
  return [...new Set(motivos)];
}

export function isBeneficioAplicableEnOrden(beneficio = {}, orden = {}) {
  return isBeneficioAplicable(beneficio, {
    tallerId: orden.tallerId,
    clienteId: orden.clientId,
    motoId: orden.bikeId,
    provieneDeOrdenRealCerradaCalificada: true,
    esProximaAtencionDeLaMismaMoto: true,
  });
}

export function esTokenReputacionValido(token) {
  return isTokenReputacionValidoContract(token);
}
