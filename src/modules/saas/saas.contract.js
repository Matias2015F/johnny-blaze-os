export const SAAS_USER_COLLECTION = "usuarios";
export const SAAS_ADMIN_SETTINGS_COLLECTION = "admin_settings";
export const SAAS_SUPPORT_TICKETS_COLLECTION = "soporteTickets";
export const SAAS_ESTADOS = ["trial", "activo", "vencido", "suspendido", "admin"];

export const isEstadoSaasValido = (estado) => SAAS_ESTADOS.includes(String(estado || ""));
