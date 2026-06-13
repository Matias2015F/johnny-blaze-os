export const CLIENTE_COLECCION = "clientes";
export const CLIENTE_ID_KEY = "id";
export const CLIENTE_NOMBRE_KEY = "nombre";
export const CLIENTE_TELEFONO_KEYS = ["tel", "telefono", "whatsapp"];
export const CLIENTE_CAMPO_ACTIVO = "activo";

export const isClienteShapeValido = (cliente = {}) => Boolean(cliente && (cliente.nombre || cliente.id));
