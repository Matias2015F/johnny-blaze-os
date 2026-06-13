function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach((item) => freeze(item));
  return value;
}

function createOrder({
  id,
  estado,
  clientId = "shadow-client",
  bikeId = "shadow-bike",
  tallerId = "shadow-workshop",
  garantiaFinal = "Garantia de ejemplo",
  excepciones = "Ninguna",
  observaciones = "Orden de prueba sanitizada",
  ...rest
}) {
  return freeze({
    id,
    estado,
    clientId,
    bikeId,
    tallerId,
    garantiaFinal,
    cierreRechazo: {
      excepciones,
      observaciones,
    },
    trabajosRealizados: [],
    repuestos: [],
    pagos: [],
    ...rest,
  });
}

const ORDEN_RECIEN_INGRESADA = createOrder({
  id: "diff-order-001",
  estado: "BORRADOR",
  clientId: "",
  bikeId: "",
  tallerId: "shadow-workshop",
  garantiaFinal: "",
  excepciones: "",
  observaciones: "",
});

const ORDEN_PRESUPUESTO_PENDIENTE = createOrder({
  id: "diff-order-002",
  estado: "PRESUPUESTADO",
  observaciones: "Pendiente de aprobacion",
});

const ORDEN_PRESUPUESTO_APROBADO = createOrder({
  id: "diff-order-003",
  estado: "AUTORIZADO",
  observaciones: "Presupuesto aprobado",
});

const ORDEN_PRESUPUESTO_RECHAZADO = createOrder({
  id: "diff-order-004",
  estado: "CANCELADO",
  motivoCierre: "PRESUPUESTO_RECHAZADO",
  observaciones: "Presupuesto rechazado",
});

const ORDEN_ADICIONAL_PENDIENTE = createOrder({
  id: "diff-order-005",
  estado: "ESPERANDO_REPUESTOS",
  adicionalEstado: "PENDIENTE",
  observaciones: "Adicional pendiente de decision",
});

const ORDEN_ADICIONAL_AUTORIZADO = createOrder({
  id: "diff-order-006",
  estado: "AUTORIZADO",
  adicionalEstado: "AUTORIZADO",
  observaciones: "Adicional autorizado",
});

const ORDEN_TRABAJO_EN_PROGRESO = createOrder({
  id: "diff-order-007",
  estado: "EN_REPARACION",
  observaciones: "Trabajo en progreso",
});

const ORDEN_BLOQUEO_PRESUPUESTARIO = createOrder({
  id: "diff-order-008",
  estado: "PENDIENTE_PAGO",
  bloqueoPresupuestario: true,
  observaciones: "Bloqueo por limite presupuestario",
});

const ORDEN_FINALIZADA_PENDIENTE_COBRO = createOrder({
  id: "diff-order-009",
  estado: "LISTO_PARA_ENTREGA",
  cobrado: false,
  retirado: false,
  observaciones: "Terminada, pendiente de cobro",
});

const ORDEN_COBRADA_PENDIENTE_RETIRO = createOrder({
  id: "diff-order-010",
  estado: "COBRADO_PENDIENTE_RETIRO",
  cobrado: true,
  retirado: false,
  motoRetirada: false,
  observaciones: "Cobrada, pendiente de retiro",
});

const ORDEN_RETIRADA = createOrder({
  id: "diff-order-011",
  estado: "ENTREGADO",
  cobrado: true,
  retirado: true,
  motoRetirada: true,
  observaciones: "Retirada con PDF final",
});

const ORDEN_CANCELADA = createOrder({
  id: "diff-order-012",
  estado: "CANCELADO",
  observaciones: "Cancelada",
});

const ORDEN_LEGACY_INCOMPLETA = freeze({
  id: "diff-order-013",
  estado: "ENTREGADO",
  tallerId: "shadow-workshop",
  garantiaFinal: "Garantia de ejemplo",
  observaciones: "Legacy incompleta",
});

const ORDEN_REFERENCIAS_FALTANTES = freeze({
  id: "diff-order-014",
  estado: "ENTREGADO",
  clientId: "shadow-client",
  tallerId: "shadow-workshop",
  garantiaFinal: "Garantia de ejemplo",
  observaciones: "Falta referencia de moto",
});

const ORDEN_ESTADO_INCONSISTENTE = createOrder({
  id: "diff-order-015",
  estado: "MODO_RARO",
  status: "AUTORIZADO",
  observaciones: "Estado inconsistente",
});

export const ORDEN_SHADOW_DIFFERENTIAL_CORPUS = freeze([
  freeze({
    key: "recienIngresada",
    label: "Orden recien ingresada",
    expectedClassification: "invalid_fixture",
    legacyDecisionDisponible: false,
    ambiguousRule: false,
    legacyOrden: ORDEN_RECIEN_INGRESADA,
  }),
  freeze({
    key: "presupuestoPendiente",
    label: "Presupuesto pendiente",
    expectedClassification: "undefined_business_rule",
    legacyDecisionDisponible: true,
    ambiguousRule: true,
    legacyOrden: ORDEN_PRESUPUESTO_PENDIENTE,
  }),
  freeze({
    key: "presupuestoAprobado",
    label: "Presupuesto aprobado",
    expectedClassification: "undefined_business_rule",
    legacyDecisionDisponible: true,
    ambiguousRule: true,
    legacyOrden: ORDEN_PRESUPUESTO_APROBADO,
  }),
  freeze({
    key: "presupuestoRechazado",
    label: "Presupuesto rechazado",
    expectedClassification: "expected_difference",
    legacyDecisionDisponible: true,
    ambiguousRule: false,
    legacyOrden: ORDEN_PRESUPUESTO_RECHAZADO,
  }),
  freeze({
    key: "adicionalPendiente",
    label: "Adicional pendiente",
    expectedClassification: "undefined_business_rule",
    legacyDecisionDisponible: true,
    ambiguousRule: true,
    legacyOrden: ORDEN_ADICIONAL_PENDIENTE,
  }),
  freeze({
    key: "adicionalAutorizado",
    label: "Adicional autorizado",
    expectedClassification: "undefined_business_rule",
    legacyDecisionDisponible: true,
    ambiguousRule: true,
    legacyOrden: ORDEN_ADICIONAL_AUTORIZADO,
  }),
  freeze({
    key: "trabajoEnProgreso",
    label: "Trabajo en progreso",
    expectedClassification: "undefined_business_rule",
    legacyDecisionDisponible: true,
    ambiguousRule: true,
    legacyOrden: ORDEN_TRABAJO_EN_PROGRESO,
  }),
  freeze({
    key: "bloqueoPresupuestario",
    label: "Bloqueo por limite presupuestario",
    expectedClassification: "undefined_business_rule",
    legacyDecisionDisponible: true,
    ambiguousRule: true,
    legacyOrden: ORDEN_BLOQUEO_PRESUPUESTARIO,
  }),
  freeze({
    key: "finalizadaPendienteCobro",
    label: "Finalizada pendiente de cobro",
    expectedClassification: "undefined_business_rule",
    legacyDecisionDisponible: true,
    ambiguousRule: true,
    legacyOrden: ORDEN_FINALIZADA_PENDIENTE_COBRO,
  }),
  freeze({
    key: "cobradaPendienteRetiro",
    label: "Cobrada pendiente de retiro",
    expectedClassification: "expected_difference",
    legacyDecisionDisponible: true,
    ambiguousRule: false,
    legacyOrden: ORDEN_COBRADA_PENDIENTE_RETIRO,
  }),
  freeze({
    key: "retirada",
    label: "Retirada",
    expectedClassification: "expected_difference",
    legacyDecisionDisponible: true,
    ambiguousRule: false,
    legacyOrden: ORDEN_RETIRADA,
  }),
  freeze({
    key: "cancelada",
    label: "Cancelada",
    expectedClassification: "expected_difference",
    legacyDecisionDisponible: true,
    ambiguousRule: false,
    legacyOrden: ORDEN_CANCELADA,
  }),
  freeze({
    key: "legacyIncompleta",
    label: "Legacy incompleta",
    expectedClassification: "invalid_fixture",
    legacyDecisionDisponible: false,
    ambiguousRule: false,
    legacyOrden: ORDEN_LEGACY_INCOMPLETA,
  }),
  freeze({
    key: "referenciasFaltantes",
    label: "Referencias faltantes",
    expectedClassification: "invalid_fixture",
    legacyDecisionDisponible: false,
    ambiguousRule: false,
    legacyOrden: ORDEN_REFERENCIAS_FALTANTES,
  }),
  freeze({
    key: "estadoInconsistente",
    label: "Estado desconocido o inconsistente",
    expectedClassification: "undefined_business_rule",
    legacyDecisionDisponible: true,
    ambiguousRule: true,
    legacyOrden: ORDEN_ESTADO_INCONSISTENTE,
  }),
]);

export function obtenerCasoShadowDifferential(key = "recienIngresada") {
  return ORDEN_SHADOW_DIFFERENTIAL_CORPUS.find((item) => item.key === key) || ORDEN_SHADOW_DIFFERENTIAL_CORPUS[0];
}
