function normalizarTexto(valor, fallback = "") {
  const texto = String(valor || "").trim();
  return texto || fallback;
}

export function getShadowDecisionSeverity(shadowResult = {}) {
  const codigo = normalizarTexto(shadowResult?.decisionPdf?.codigo || shadowResult?.codigo, "");
  if (codigo === "PDF_LISTO") return "ok";
  if (codigo === "PDF_BLOQUEADO_CANCELADO") return "blocked";
  if (codigo === "PDF_BLOQUEADO_MOTO_NO_RETIRADA" || codigo === "PDF_BLOQUEADO_NO_ENTREGADO") return "warning";
  if (codigo.startsWith("COMPROBANTE_") || codigo.startsWith("BENEFICIO_") || codigo.startsWith("CALIFICACION_")) return "warning";
  if (Array.isArray(shadowResult?.divergencias) && shadowResult.divergencias.length > 0) return "warning";
  return "info";
}

export function getShadowDecisionTitle(shadowResult = {}) {
  const codigo = normalizarTexto(shadowResult?.decisionPdf?.codigo || shadowResult?.codigo, "");
  const titles = {
    PDF_LISTO: "PDF final listo",
    PDF_BLOQUEADO_MOTO_NO_RETIRADA: "PDF bloqueado: moto no retirada",
    PDF_BLOQUEADO_CANCELADO: "PDF bloqueado: orden cancelada",
    PDF_BLOQUEADO_NO_ENTREGADO: "PDF bloqueado: orden no entregada",
    PDF_BLOQUEADO_DATOS_INCOMPLETOS: "PDF bloqueado: datos incompletos",
  };
  return titles[codigo] || "Decision sombra";
}

export function presentarDecisionShadowOrden(shadowResult = {}) {
  const decisionPdf = shadowResult?.decisionPdf || {};
  const proximaAccion = shadowResult?.proximaAccion || {};
  const divergencias = Array.isArray(shadowResult?.divergencias) ? shadowResult.divergencias : [];
  const warnings = Array.isArray(shadowResult?.warnings) ? shadowResult.warnings : [];
  const motivos = Array.isArray(decisionPdf?.motivos) ? decisionPdf.motivos : [];
  const comparacionLegacyDisponible = Boolean(shadowResult?.comparacionLegacyDisponible);
  const divergenciasTexto = divergencias.length > 0
    ? JSON.stringify(divergencias)
    : comparacionLegacyDisponible
      ? "Sin divergencias"
      : "Comparacion legacy no disponible";

  return {
    enabled: Boolean(shadowResult?.enabled),
    source: normalizarTexto(shadowResult?.source, "orden.shadowIntegration"),
    title: getShadowDecisionTitle(shadowResult),
    severity: getShadowDecisionSeverity(shadowResult),
    comparacionLegacyDisponible,
    decisionPdf: {
      permitido: Boolean(decisionPdf?.permitido),
      codigo: normalizarTexto(decisionPdf?.codigo, "SIN_CODIGO"),
      mensaje: normalizarTexto(decisionPdf?.mensaje, ""),
      motivos,
      accionSugerida: normalizarTexto(decisionPdf?.accionSugerida, ""),
    },
    proximaAccion: {
      permitido: Boolean(proximaAccion?.permitido),
      codigo: normalizarTexto(proximaAccion?.codigo, "SIN_CODIGO"),
      mensaje: normalizarTexto(proximaAccion?.mensaje, ""),
      motivos: Array.isArray(proximaAccion?.motivos) ? proximaAccion.motivos : [],
      accionSugerida: normalizarTexto(proximaAccion?.accionSugerida, ""),
    },
    warnings,
    divergencias,
    divergenciasTexto,
    resumenMotivos: motivos.length > 0 ? motivos.join(" | ") : "Sin motivos de bloqueo",
    resumenWarnings: warnings.length > 0 ? warnings.join(" | ") : "Sin warnings",
  };
}
