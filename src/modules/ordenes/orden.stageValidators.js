import {
  ORDEN_ESTADOS_CANONICOS_NUEVOS,
  isEstadoOrdenValido,
} from "./orden.contract.js";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function asText(value) {
  return String(value ?? "").trim();
}

function hasText(value) {
  return asText(value).length > 0;
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

function pickFirstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== "");
}

function parseNumeroFlexible(value) {
  const limpio = String(value ?? "").replace(/\./g, "").replace(",", ".");
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : NaN;
}

function normalizeEstado(orden = {}) {
  const estado = asText(orden?.estado || orden?.status || orden?.state).toUpperCase();
  return estado;
}

export function isEstadoCanonicoNuevoReconocido(estado = "") {
  return ORDEN_ESTADOS_CANONICOS_NUEVOS.includes(String(estado || "").toUpperCase());
}

function hasReference(reference) {
  if (typeof reference === "string") return hasText(reference);
  if (!reference || typeof reference !== "object") return false;
  return hasText(reference.id || reference.uid || reference.clienteId || reference.motoId || reference.clientId || reference.bikeId);
}

function getClienteReferencia(orden = {}) {
  return pickFirstDefined(
    orden?.clientId,
    orden?.clienteId,
    orden?.cliente?.id,
    orden?.cliente?.uid,
    orden?.cliente?.clienteId,
    orden?.cliente,
  );
}

function getMotoReferencia(orden = {}) {
  return pickFirstDefined(
    orden?.bikeId,
    orden?.motoId,
    orden?.moto?.id,
    orden?.moto?.uid,
    orden?.moto?.motoId,
    orden?.moto,
  );
}

function getMotivoIngreso(orden = {}) {
  return pickFirstDefined(
    orden?.motivoIngreso,
    orden?.falla,
    orden?.motivo,
    orden?.motivoConsulta,
    orden?.razonIngreso,
    orden?.descripcionIngreso,
    orden?.reasonIngreso,
  );
}

function getDiagnostico(orden = {}) {
  return pickFirstDefined(
    orden?.diagnostico,
    orden?.motivoConsulta,
    orden?.falla,
    orden?.motivo,
    orden?.descripcionDiagnostico,
  );
}

function getTareas(orden = {}) {
  return asArray(pickFirstDefined(orden?.tareas, orden?.conceptos, orden?.trabajos, orden?.items));
}

function getImportePresupuesto(orden = {}) {
  const bruto = pickFirstDefined(
    orden?.importe,
    orden?.total,
    orden?.monto,
    orden?.montoTotal,
    orden?.valor,
  );
  return parseNumeroFlexible(bruto);
}

function getVersionPresupuesto(orden = {}) {
  return pickFirstDefined(
    orden?.versionPresupuesto,
    orden?.numeroPresupuesto,
    orden?.presupuestoVersion,
    orden?.version,
  );
}

function isAutorizacionValida(orden = {}) {
  return Boolean(
    hasText(orden?.autorizacionId)
    || hasText(orden?.autorizadoPor)
    || hasText(orden?.aprobadoPor)
    || hasText(orden?.presupuestoAprobadoPor)
    || normalizeEstado(orden) === "AUTORIZADO"
  );
}

function hasTareasActivas(orden = {}) {
  return getTareas(orden).length > 0;
}

function isAdicionalPendiente(orden = {}) {
  return normalizeEstado(orden) === "ESPERANDO_APROBACION_ADICIONAL"
    || asText(orden?.adicionalEstado).toUpperCase() === "PENDIENTE";
}

function isBloqueadaPorLimitePresupuestario(orden = {}) {
  return normalizeEstado(orden) === "BLOQUEADA_POR_LIMITE_PRESUPUESTARIO"
    || Boolean(orden?.bloqueoPresupuestario);
}

function puedeContinuarTrabajoSeparado(orden = {}) {
  return Boolean(
    orden?.tareasAutorizadasSeparables
    || orden?.puedeContinuarConTareasAutorizadas
    || orden?.trabajoSeparable
    || orden?.continuarConTareasAutorizadas
  );
}

function hasPagoRegistrado(orden = {}) {
  return Array.isArray(orden?.pagos) && orden.pagos.length > 0;
}

function getMontoPagado(orden = {}) {
  if (typeof orden?.montoPagado === "number") return orden.montoPagado;
  if (typeof orden?.totalPagado === "number") return orden.totalPagado;
  if (typeof orden?.pagadoTotal === "number") return orden.pagadoTotal;
  if (hasPagoRegistrado(orden)) {
    return orden.pagos.reduce((sum, pago) => {
      const brutoMonto = (
        pago?.monto
        ?? pago?.importe
        ?? pago?.valor
        ?? pago?.total
        ?? pago?.amount
        ?? pago?.montoCobrado
        ?? 0
      );
      const montoFlexible = parseNumeroFlexible(brutoMonto);
      return Number.isFinite(montoFlexible) ? sum + montoFlexible : sum;
    }, 0);
  }
  if (orden?.pagado === true || orden?.cobrado === true) return Number(getMontoTotal(orden)) || 1;
  return 0;
}

function getMontoTotal(orden = {}) {
  const bruto = pickFirstDefined(
    orden?.montoTotal,
    orden?.total,
    orden?.importeTotal,
    orden?.importe,
  );
  const numero = parseNumeroFlexible(bruto);
  return Number.isFinite(numero) ? numero : 0;
}

function tienePagoCompleto(orden = {}) {
  const total = getMontoTotal(orden);
  if (total <= 0) {
    return Boolean(orden?.pagadoTotal || orden?.pagoCompleto || orden?.cobrado === true);
  }
  return getMontoPagado(orden) >= total;
}

function tieneRetiroConfirmado(orden = {}) {
  return Boolean(
    orden?.retirado
    || orden?.motoRetirada
    || orden?.retiroConfirmado
    || normalizeEstado(orden) === "ENTREGADO"
    || normalizeEstado(orden) === "CERRADO_CON_PDF"
  );
}

function getGarantiaFinal(orden = {}) {
  return pickFirstDefined(orden?.garantiaFinal, orden?.garantia, orden?.garantiaTexto);
}

function getExcepcionesFinales(orden = {}) {
  return pickFirstDefined(
    orden?.cierreRechazo?.excepciones,
    orden?.excepciones,
  );
}

function getObservacionesFinales(orden = {}) {
  return pickFirstDefined(
    orden?.cierreRechazo?.observaciones,
    orden?.observaciones,
  );
}

function getRecomendacionesFinales(orden = {}) {
  return pickFirstDefined(
    orden?.recomendaciones,
    orden?.cierreRechazo?.recomendaciones,
    orden?.recomendacion,
  );
}

function getComprobanteFuente(orden = {}) {
  return orden?.comprobante || orden?.comprobanteCierre || orden?.documento || orden;
}

function hasDatosMinimosComprobante(orden = {}) {
  const comprobante = getComprobanteFuente(orden);
  return Boolean(
    comprobante
    && hasText(comprobante.comprobanteId || orden?.comprobanteId)
    && hasText(comprobante.tallerId || orden?.tallerId)
    && hasText(comprobante.clienteId || orden?.clientId || orden?.clienteId)
    && hasText(comprobante.motoId || orden?.bikeId || orden?.motoId)
    && hasText(comprobante.ordenId || orden?.id || orden?.ordenId)
    && hasText(comprobante.pdfUrl || orden?.pdfUrl)
    && hasText(comprobante.fechaCierre || orden?.fechaCierre)
    && hasText(comprobante.estadoVerificacion || orden?.estadoVerificacion)
  );
}

export function isOrdenIngresoValida(orden = {}) {
  return Boolean(
    hasReference(getClienteReferencia(orden))
    && hasReference(getMotoReferencia(orden))
    && hasText(getMotivoIngreso(orden))
  );
}

export function isOrdenPresupuestoValida(orden = {}) {
  return Boolean(
    hasText(getDiagnostico(orden))
    && getTareas(orden).length > 0
    && Number.isFinite(getImportePresupuesto(orden))
    && hasText(getVersionPresupuesto(orden))
  );
}

export function isOrdenEjecucionValida(orden = {}) {
  const estado = normalizeEstado(orden);
  if (!estado || !isEstadoOrdenValido(estado)) return false;
  if (!isAutorizacionValida(orden)) return false;
  if (!hasTareasActivas(orden)) return false;
  if (isAdicionalPendiente(orden) && !puedeContinuarTrabajoSeparado(orden)) return false;
  if (isBloqueadaPorLimitePresupuestario(orden) && !puedeContinuarTrabajoSeparado(orden)) return false;
  return true;
}

export function isOrdenCierreDocumentalValida(orden = {}) {
  return Boolean(
    tienePagoCompleto(orden)
    && tieneRetiroConfirmado(orden)
    && hasText(getGarantiaFinal(orden))
    && hasText(getExcepcionesFinales(orden))
    && hasText(getObservacionesFinales(orden))
    && hasText(getRecomendacionesFinales(orden))
    && hasDatosMinimosComprobante(orden)
  );
}

export function isPagoCompleto(orden = {}) {
  return tienePagoCompleto(orden);
}

export function isRetiroConfirmado(orden = {}) {
  return tieneRetiroConfirmado(orden);
}

export function isCierreDocumentalCompleto(orden = {}) {
  return isOrdenCierreDocumentalValida(orden);
}

export function isPagoCompletoOrden(orden = {}) {
  return tienePagoCompleto(orden);
}

export function isRetiroConfirmadoOrden(orden = {}) {
  return tieneRetiroConfirmado(orden);
}

export function getSiguienteEstadoCierrePermitido(orden = {}) {
  const estado = normalizeEstado(orden);
  const inconsistencias = estado && hasText(orden?.status) && estado !== asText(orden?.status).toUpperCase();
  if (inconsistencias || (!estado && hasText(orden?.status)) || (estado && !isEstadoOrdenValido(estado))) {
    return null;
  }

  if (!tienePagoCompleto(orden)) return "PENDIENTE_PAGO";
  if (!tieneRetiroConfirmado(orden)) return "COBRADO_PENDIENTE_RETIRO";
  if (!isOrdenCierreDocumentalValida(orden)) return "ENTREGADO";
  return "CERRADO_CON_PDF";
}

export function evaluarTransicionCierreOrden(orden = {}) {
  const estadoActual = normalizeEstado(orden);
  const siguienteEstado = getSiguienteEstadoCierrePermitido(orden);
  const manualReview = Boolean(
    (estadoActual && hasText(orden?.status) && estadoActual !== asText(orden?.status).toUpperCase())
    || (!estadoActual && hasText(orden?.status))
    || estadoActual === "MODO_RARO"
    || (estadoActual && !isEstadoOrdenValido(estadoActual))
  );

  const motivos = [];
  if (manualReview) {
    motivos.push("INCONSISTENT_LEGACY_STATE");
  } else if (!tienePagoCompleto(orden)) {
    motivos.push("PAGO_TOTAL_PENDIENTE");
  } else if (!tieneRetiroConfirmado(orden)) {
    motivos.push("RETIRO_PENDIENTE");
  } else if (!isOrdenCierreDocumentalValida(orden)) {
    motivos.push("CIERRE_DOCUMENTAL_INCOMPLETO");
  }

  const accionSugerida = manualReview
    ? "REVISAR_Y_REPARAR_DATOS"
    : siguienteEstado === "PENDIENTE_PAGO"
      ? "REGISTRAR_PAGO"
      : siguienteEstado === "COBRADO_PENDIENTE_RETIRO"
        ? "CONFIRMAR_RETIRO_DE_MOTO"
        : siguienteEstado === "ENTREGADO"
          ? "COMPLETAR_CIERRE_DOCUMENTAL"
          : "GENERAR_PDF_FINAL";

  const permitido = !manualReview && siguienteEstado !== null;

  return clone({
    decisionState: "DECIDED",
    operationallyEnforced: false,
    requiresManualReview: manualReview,
    permitido,
    codigo: manualReview
      ? "CIERRE_REQUIERE_REVISION_MANUAL"
      : siguienteEstado === "PENDIENTE_PAGO"
        ? "CIERRE_PENDIENTE_PAGO"
        : siguienteEstado === "COBRADO_PENDIENTE_RETIRO"
          ? "CIERRE_PAGO_COMPLETO_SIN_RETIRO"
          : siguienteEstado === "ENTREGADO"
            ? "CIERRE_DOCUMENTAL_PENDIENTE"
            : "CIERRE_CON_PDF_PERMITIDO",
    estadoSiguiente: siguienteEstado,
    mensaje: manualReview
      ? "La orden requiere revision manual antes de cualquier transicion."
      : siguienteEstado === "PENDIENTE_PAGO"
        ? "La orden debe permanecer en pendiente de pago hasta registrar el cobro total."
        : siguienteEstado === "COBRADO_PENDIENTE_RETIRO"
          ? "El pago completo permite avanzar a cobrados pendiente de retiro."
          : siguienteEstado === "ENTREGADO"
            ? "La moto ya fue retirada, pero falta documentacion para cerrar."
            : "La orden cumple la secuencia final y puede cerrar documentalmente.",
    motivos,
    accionSugerida,
    requiereRevisionManual: manualReview,
    pagoCompleto: tienePagoCompleto(orden),
    retiroConfirmado: tieneRetiroConfirmado(orden),
    cierreDocumentalCompleto: isCierreDocumentalCompleto(orden),
  });
}
