// Helper compartido de reputacion (prefijo _ = no cuenta en el limite de 12 funciones).
// Fuente unica del calculo de score por rating, usado por submit-rating.js y moderate-rating.js.

// Promedio real (1-5) a partir de los 4 subscores que escribe submit-rating.js.
// No existe un campo `score` plano en ratings/{id}.
function ratingScore(data) {
  const parts = [data.scoreAtencion, data.scoreClaridad, data.scoreTrabajo, data.scoreCumplimiento]
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
  if (!parts.length) return 0;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

module.exports = { ratingScore };
