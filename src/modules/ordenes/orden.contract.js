export const ORDEN_ESTADOS = [
  "BORRADOR",
  "DIAGNOSTICO",
  "PRESUPUESTADO",
  "AUTORIZADO",
  "EN_REPARACION",
  "ESPERANDO_REPUESTOS",
  "ESPERANDO_APROBACION_ADICIONAL",
  "PENDIENTE_PAGO",
  "BLOQUEADA_POR_LIMITE_PRESUPUESTARIO",
  "COBRADO_PENDIENTE_RETIRO",
  "LISTO_PARA_ENTREGA",
  "ENTREGADO",
  "CERRADO_CON_PDF",
  "CANCELADO",
  "diagnostico",
  "presupuesto",
  "aprobacion",
  "reparacion",
  "finalizada",
  "listo_para_emitir",
  "entregada",
  "cobrado_pendiente_retiro",
  "cerrado_emitido",
];

export const ORDEN_COLECCION = "trabajos";
export const ORDEN_CLIENTE_KEY = "clientId";
export const ORDEN_MOTO_KEY = "bikeId";
export const ORDEN_PDF_BLOQUEADO_ESTADO = "COBRADO_PENDIENTE_RETIRO";
export const ORDEN_PDF_REQUIERE_GARANTIA = true;
export const ORDEN_PDF_REQUIERE_EXCEPCIONES = true;
export const ORDEN_PDF_REQUIERE_OBSERVACIONES = true;
export const ORDEN_PDF_REQUIERE_CLIENTE = true;
export const ORDEN_PDF_REQUIERE_MOTO = true;
export const ORDEN_PDF_REQUIERE_TALLER = true;
export const ORDEN_PDF_REQUIERE_ORDEN = true;
export const ORDEN_ESTADOS_CANONICOS_NUEVOS = [
  "ESPERANDO_APROBACION_ADICIONAL",
  "BLOQUEADA_POR_LIMITE_PRESUPUESTARIO",
];
export const ORDEN_ETAPAS_VALIDACION = [
  "INGRESO",
  "PRESUPUESTO",
  "EJECUCION",
  "CIERRE_DOCUMENTAL",
];

export const isEstadoOrdenValido = (estado) => ORDEN_ESTADOS.includes(String(estado || ""));
export const isPdfFinalPermitido = (estado) => String(estado || "") !== ORDEN_PDF_BLOQUEADO_ESTADO;
export const isOrdenCobradaPendienteRetiro = (orden = {}) => String(orden?.estado || "") === ORDEN_PDF_BLOQUEADO_ESTADO;
export const isOrdenEntregada = (orden = {}) => String(orden?.estado || "") === "ENTREGADO";
export const isOrdenCerrable = (orden = {}) => isOrdenEntregada(orden) || String(orden?.estado || "") === "CERRADO_CON_PDF";
export const isOrdenDocumentable = (orden = {}) => Boolean(orden && isEstadoOrdenValido(orden.estado) && orden.clientId && orden.bikeId);
export const isEstadoCanonicoNuevoOrden = (estado) => ORDEN_ESTADOS_CANONICOS_NUEVOS.includes(String(estado || ""));
export const isEtapaValidacionOrden = (etapa) => ORDEN_ETAPAS_VALIDACION.includes(String(etapa || ""));

export const hasDatosMinimosParaPdf = (orden = {}) => {
  if (!orden || !isOrdenDocumentable(orden)) return false;
  if (ORDEN_PDF_REQUIERE_TALLER && !orden.tallerId) return false;
  if (ORDEN_PDF_REQUIERE_CLIENTE && !orden.clientId) return false;
  if (ORDEN_PDF_REQUIERE_MOTO && !orden.bikeId) return false;
  if (ORDEN_PDF_REQUIERE_ORDEN && !orden.id) return false;
  if (ORDEN_PDF_REQUIERE_GARANTIA && !String(orden.garantiaFinal || orden.garantia || "").trim()) return false;
  if (ORDEN_PDF_REQUIERE_EXCEPCIONES && !String(orden.cierreRechazo?.excepciones || orden.excepciones || "").trim()) return false;
  if (ORDEN_PDF_REQUIERE_OBSERVACIONES && !String(orden.cierreRechazo?.observaciones || orden.observaciones || orden.recomendaciones || "").trim()) return false;
  return true;
};

export const esCierrePdfValido = (orden = {}) =>
  isOrdenEntregada(orden) &&
  !isOrdenCobradaPendienteRetiro(orden) &&
  isPdfFinalPermitido(orden.estado) &&
  hasDatosMinimosParaPdf(orden);
