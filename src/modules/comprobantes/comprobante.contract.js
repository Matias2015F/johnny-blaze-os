export const COMPROBANTE_PUBLICO_COLECCION = "publicReceipts";
export const COMPROBANTE_SECRETO_COLECCION = "publicReceiptSecrets";
export const COMPROBANTE_TIPO_SERVICIO = "servicio_realizado";
export const COMPROBANTE_TIPO_DIAGNOSTICO = "diagnostico_presupuesto_cerrado";
export const COMPROBANTE_ESTADOS_VERIFICACION = ["PENDIENTE", "VERIFICADO", "RECHAZADO", "ANULADO"];
export const COMPROBANTE_CAMPOS_ESPERADOS = [
  "comprobanteId",
  "tallerId",
  "clienteId",
  "motoId",
  "ordenId",
  "pdfUrl",
  "garantia",
  "excepciones",
  "recomendaciones",
  "trabajosRealizados",
  "repuestos",
  "pagos",
  "fechaCierre",
  "estadoVerificacion",
];

export const isEstadoVerificacionValido = (estado) => COMPROBANTE_ESTADOS_VERIFICACION.includes(String(estado || "").toUpperCase());
export const isComprobanteShapeValido = (comprobante = {}) => Boolean(
  comprobante &&
  comprobante.comprobanteId &&
  comprobante.tallerId &&
  comprobante.clienteId &&
  comprobante.motoId &&
  comprobante.ordenId,
);

export const hasCamposObligatoriosComprobante = (comprobante = {}) =>
  COMPROBANTE_CAMPOS_ESPERADOS.every((campo) => campo in (comprobante || {}));

export const isComprobanteVerificable = (comprobante = {}) =>
  isComprobanteShapeValido(comprobante) &&
  Boolean(comprobante.pdfUrl) &&
  isEstadoVerificacionValido(comprobante.estadoVerificacion);

export const isComprobantePublicable = (comprobante = {}) =>
  isComprobanteVerificable(comprobante) &&
  String(comprobante.estadoVerificacion || "").toUpperCase() !== "ANULADO";

export const hasTrazabilidadDocumentalMinima = (comprobante = {}) =>
  Boolean(
    comprobante &&
    comprobante.comprobanteId &&
    comprobante.tallerId &&
    comprobante.clienteId &&
    comprobante.motoId &&
    comprobante.ordenId &&
    comprobante.pdfUrl &&
    comprobante.fechaCierre,
  );


