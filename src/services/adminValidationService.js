export const VALID_PLAN_KEYS = ["base", "pro", "full"];
export const MAX_EXTENSION_DAYS = 365;
export const MIN_EXTENSION_DAYS = 1;

export function validatePlanKey(planKey) {
  if (!VALID_PLAN_KEYS.includes(planKey)) {
    throw new Error(`Plan inválido: "${planKey}". Los valores permitidos son: base (Mensual), pro (Trimestral), full (Anual).`);
  }
}

export function validateExtraDays(days) {
  const n = Number(days);
  if (!Number.isFinite(n) || n < MIN_EXTENSION_DAYS || n > MAX_EXTENSION_DAYS) {
    throw new Error(`Cantidad de días inválida: "${days}". Debe ser entre ${MIN_EXTENSION_DAYS} y ${MAX_EXTENSION_DAYS}.`);
  }
}

export function validateEmail(email) {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    throw new Error(`El email no tiene formato válido: ${email}`);
  }
}

export function validateAdminSettings(settings) {
  const errors = [];
  const p = settings?.precios || {};
  const base = Number(p.base ?? 0);
  const pro = Number(p.pro ?? 0);
  const full = Number(p.full ?? 0);
  if (base < 0) errors.push("El precio base no puede ser negativo.");
  if (pro < base) errors.push("El precio Trimestral debe ser mayor o igual al Mensual.");
  if (full < pro) errors.push("El precio Anual debe ser mayor o igual al Trimestral.");
  const durations = settings?.planDurations || {};
  for (const [key, label] of [["base", "Mensual"], ["pro", "Trimestral"], ["full", "Anual"]]) {
    const days = Number(durations[key] ?? 0);
    if (!Number.isFinite(days) || days < 1 || days > 730) {
      errors.push(`La duracion del plan ${label} debe estar entre 1 y 730 dias.`);
    }
  }
  const trial = Number(settings?.duracionTrialDias ?? 14);
  if (!Number.isFinite(trial) || trial < 0 || trial > 30) {
    errors.push("Los días de prueba deben estar entre 0 y 30.");
  }
  const grace = Number(settings?.graceDaysDefault ?? 3);
  if (!Number.isFinite(grace) || grace < 0 || grace > 15) {
    errors.push("Los días de gracia deben estar entre 0 y 15.");
  }
  if (settings?.notificationEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(settings.notificationEmail))) {
    errors.push("El email de notificaciones no tiene formato válido.");
  }
  if (errors.length > 0) throw new Error(errors.join(" "));
}
