import {
  DEFAULT_SAAS_ADMIN_SETTINGS,
  leerAdminSettings as leerAdminSettingsSaas,
  leerUsuarioSaas,
  normalizeDateMs,
  resolveSaasAccess,
} from "./saasService.js";

export { normalizeDateMs };

export function resolveAccountAccess(account) {
  return resolveSaasAccess(account);
}

export async function validarAcceso(uid) {
  const usuario = await leerUsuarioSaas(uid);
  if (!usuario) return { acceso: false, motivo: "sin_usuario" };
  return resolveSaasAccess(usuario);
}

export async function leerAdminSettings() {
  const settings = await leerAdminSettingsSaas();
  return settings || DEFAULT_SAAS_ADMIN_SETTINGS;
}
