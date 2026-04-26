export function iniciarCronometro(orden) {
  if (orden.cronometroActivo) return orden;
  return { ...orden, cronometroActivo: true, inicioCronometro: Date.now() };
}

export function pausarCronometro(orden) {
  if (!orden.cronometroActivo) return orden;
  const horas = (Date.now() - orden.inicioCronometro) / 3600000;
  return { ...orden, cronometroActivo: false, inicioCronometro: null, tiempoReal: (orden.tiempoReal || 0) + horas };
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
