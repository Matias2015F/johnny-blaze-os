import {
  evaluarServicioCierreOrden,
  evaluarServicioEstadoOrden,
  evaluarServicioPdfFinal,
} from "./orden.domainService.js";

const ESTADO_LEGACY_A_CANONICO = {
  diagnostico: "DIAGNOSTICO",
  presupuesto: "PRESUPUESTADO",
  aprobacion: "AUTORIZADO",
  reparacion: "EN_REPARACION",
  finalizada: "ENTREGADO",
  listo_para_emitir: "LISTO_PARA_ENTREGA",
  entregada: "ENTREGADO",
  cobrado_pendiente_retiro: "COBRADO_PENDIENTE_RETIRO",
  cerrado_emitido: "CERRADO_CON_PDF",
};

function clonar(valor) {
  return valor == null ? valor : JSON.parse(JSON.stringify(valor));
}

function normalizarEstadoOrden(legacyOrden = {}) {
  const estadoBruto = String(legacyOrden?.estado || legacyOrden?.status || "").trim();
  if (!estadoBruto) {
    if (legacyOrden?.cobrado || legacyOrden?.pagado) {
      return legacyOrden?.retirado || legacyOrden?.motoRetirada ? "ENTREGADO" : "COBRADO_PENDIENTE_RETIRO";
    }
    if (legacyOrden?.retirado || legacyOrden?.motoRetirada || legacyOrden?.entregado) {
      return "ENTREGADO";
    }
    return "BORRADOR";
  }

  const estadoNormalizado = estadoBruto.toUpperCase();
  return ESTADO_LEGACY_A_CANONICO[estadoBruto] || ESTADO_LEGACY_A_CANONICO[estadoBruto.toLowerCase()] || estadoNormalizado;
}

function obtenerIdDesdeLegacy(legacyOrden = {}) {
  return legacyOrden.id || legacyOrden.ordenId || legacyOrden.workOrderId || legacyOrden.uid || legacyOrden.key || "";
}

function obtenerClienteId(legacyOrden = {}) {
  return legacyOrden.clientId || legacyOrden.clienteId || legacyOrden.cliente?.id || legacyOrden.cliente?.uid || legacyOrden.cliente?.clienteId || "";
}

function obtenerMotoId(legacyOrden = {}) {
  return legacyOrden.bikeId || legacyOrden.motoId || legacyOrden.moto?.id || legacyOrden.moto?.uid || legacyOrden.moto?.motoId || "";
}

function obtenerTallerId(legacyOrden = {}) {
  return legacyOrden.tallerId || legacyOrden.workshopUid || legacyOrden.taller?.id || legacyOrden.taller?.uid || legacyOrden.taller?.tallerId || "";
}

function obtenerGarantia(legacyOrden = {}) {
  return legacyOrden.garantiaFinal || legacyOrden.garantia || legacyOrden.garantiaTexto || "";
}

function obtenerObservaciones(legacyOrden = {}) {
  return legacyOrden.cierreRechazo?.observaciones || legacyOrden.observaciones || legacyOrden.recomendaciones || "";
}

function obtenerExcepciones(legacyOrden = {}) {
  return legacyOrden.cierreRechazo?.excepciones || legacyOrden.excepciones || "";
}

export function mapLegacyOrdenToDomainOrden(legacyOrden = {}) {
  const orden = clonar(legacyOrden) || {};
  return {
    ...orden,
    id: obtenerIdDesdeLegacy(orden),
    tallerId: obtenerTallerId(orden),
    clientId: obtenerClienteId(orden),
    bikeId: obtenerMotoId(orden),
    estado: normalizarEstadoOrden(orden),
    garantiaFinal: obtenerGarantia(orden),
    cierreRechazo: {
      excepciones: obtenerExcepciones(orden),
      observaciones: obtenerObservaciones(orden),
    },
    trabajosRealizados: orden.trabajosRealizados || orden.trabajos || [],
    repuestos: orden.repuestos || [],
    pagos: orden.pagos || [],
  };
}

export function evaluarLegacyOrdenParaPdf(legacyOrden = {}) {
  return evaluarServicioPdfFinal(mapLegacyOrdenToDomainOrden(legacyOrden));
}

export function evaluarLegacyOrdenParaVista(legacyOrden = {}) {
  const orden = mapLegacyOrdenToDomainOrden(legacyOrden);
  return {
    orden,
    decisionEstado: evaluarServicioEstadoOrden(orden),
    decisionCierre: evaluarServicioCierreOrden(orden),
  };
}

export function obtenerDecisionPdfDesdeOrdenLegacy(legacyOrden = {}) {
  return evaluarLegacyOrdenParaPdf(legacyOrden);
}

export function obtenerProximaAccionDesdeOrdenLegacy(legacyOrden = {}) {
  return evaluarLegacyOrdenParaPdf(legacyOrden).accionSugerida;
}

