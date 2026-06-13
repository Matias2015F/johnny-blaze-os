export const REPUTACION_COLECCION = "ratings";
export const REPUTACION_PUBLICA_COLECCION = "publicWorkshops";
export const REPUTACION_TOKEN_COLECCION = "reviewTokens";
export const DESCUENTO_ESTADOS = ["DISPONIBLE", "USADO", "VENCIDO"];
export const REPUTACION_PUBLICACION_ESTADOS = ["PENDIENTE", "PUBLICADO", "RECHAZADO", "OCULTO"];

export const isEstadoBeneficioValido = (estado) => DESCUENTO_ESTADOS.includes(String(estado || ""));
export const isEstadoPublicacionValido = (estado) => REPUTACION_PUBLICACION_ESTADOS.includes(String(estado || ""));
export const isTokenReputacionValido = (token) => Boolean(
  token &&
  typeof token === "object" &&
  token.tallerId &&
  token.clienteId &&
  token.motoId &&
  token.ordenId &&
  token.token,
);

export const isCalificacionShapeValido = (rating = {}) => Boolean(
  rating &&
  rating.tallerId &&
  rating.clienteId &&
  rating.motoId &&
  rating.ordenId &&
  rating.rating != null,
);

export const isCalificacionPublicable = (rating = {}) =>
  isCalificacionShapeValido(rating) &&
  isEstadoPublicacionValido(rating.estadoPublicacion || "PENDIENTE");

export const isBeneficioShapeValido = (beneficio = {}) => Boolean(
  beneficio &&
  beneficio.beneficioId &&
  beneficio.tallerId &&
  beneficio.clienteId &&
  beneficio.motoId &&
  beneficio.ordenOrigenId &&
  beneficio.porcentaje != null &&
  beneficio.estado,
);

export const isBeneficioAplicable = (beneficio = {}, contexto = {}) => {
  if (!isBeneficioShapeValido(beneficio)) return false;
  if (String(beneficio.estado || "") !== "DISPONIBLE") return false;
  if (beneficio.tallerId !== contexto.tallerId) return false;
  if (beneficio.clienteId !== contexto.clienteId) return false;
  if (beneficio.motoId !== contexto.motoId) return false;
  const vencido = Boolean(beneficio.vencido || (beneficio.fechaVencimiento && new Date(beneficio.fechaVencimiento).getTime() < Date.now()));
  if (vencido) return false;
  if (beneficio.usado || beneficio.used) return false;
  if (!contexto.provieneDeOrdenRealCerradaCalificada) return false;
  if (!contexto.esProximaAtencionDeLaMismaMoto) return false;
  return true;
};

export const isBeneficioNoAplicable = (beneficio = {}, contexto = {}) => !isBeneficioAplicable(beneficio, contexto);
