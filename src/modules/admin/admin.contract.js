export const ADMIN_AUDIT_COLLECTION = "adminAuditLogs";
export const ADMIN_USAGE_COLLECTION = "usageSnapshots";
export const ADMIN_SUPPORTED_ROLES = ["admin", "user"];

export const isRolAdminValido = (rol) => ADMIN_SUPPORTED_ROLES.includes(String(rol || ""));
