export const MOTO_COLECCION = "motos";
export const MOTO_PATENTE_KEY = "patente";
export const MOTO_PATENTE_NORMALIZADA_KEY = "patenteNormalizada";
export const MOTO_CLIENTE_ID_KEY = "clienteId";
export const MOTO_KM_KEY = "kilometrajeActual";

export const isMotoShapeValido = (moto = {}) => Boolean(moto && (moto.patente || moto.patenteNormalizada));
