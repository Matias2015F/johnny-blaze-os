export function iniciarCronometro(orden) {
  if (orden.cronometroActivo || orden.trabajoSinCronometro) return orden;
  return { ...orden, cronometroActivo: true, inicioCronometro: Date.now(), trabajoSinCronometro: false };
}

export function pausarCronometro(orden) {
  if (!orden.cronometroActivo) return orden;
  const horas = (Date.now() - orden.inicioCronometro) / 3600000;
  return { ...orden, cronometroActivo: false, inicioCronometro: null, tiempoReal: (orden.tiempoReal || 0) + horas };
}

export function detenerCronometro(orden) {
  const pausada = pausarCronometro(orden);
  return { ...pausada, cronometroActivo: false, inicioCronometro: null, tiempoReal: 0 };
}

export function trabajarSinCronometro(orden) {
  const pausada = pausarCronometro(orden);
  return { ...pausada, trabajoSinCronometro: true };
}

export function obtenerTiempoActual(orden) {
  const base = orden.tiempoReal || 0;
  if (!orden.cronometroActivo || !orden.inicioCronometro) return base;
  return base + (Date.now() - orden.inicioCronometro) / 3600000;
}

export function formatTiempo(horas) {
  const h = Math.floor(horas);
  const m = Math.floor((horas - h) * 60);
  const s = Math.floor(((horas - h) * 60 - m) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatTiempoCorto(horas) {
  const h = Math.floor(horas);
  const m = Math.floor((horas - h) * 60);
  return `${h}h ${m}m`;
}

// ── Cronómetro de diagnóstico ─────────────────────────────────────────────────
export function iniciarDiag(orden) {
  if (orden.diagActivo) return orden;
  return { ...orden, diagActivo: true, diagInicio: Date.now() };
}

export function pausarDiag(orden) {
  if (!orden.diagActivo || !orden.diagInicio) return orden;
  const ms = (orden.diagTiempoMs || 0) + (Date.now() - orden.diagInicio);
  return { ...orden, diagActivo: false, diagInicio: null, diagTiempoMs: ms };
}

export function obtenerTiempoDiagActual(orden) {
  const base = orden.diagTiempoMs || 0;
  if (!orden.diagActivo || !orden.diagInicio) return base / 3600000;
  return (base + (Date.now() - orden.diagInicio)) / 3600000;
}
