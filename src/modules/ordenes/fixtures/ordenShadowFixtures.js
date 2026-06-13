function deepFreeze(valor) {
  if (!valor || typeof valor !== "object" || Object.isFrozen(valor)) return valor;
  Object.freeze(valor);
  Object.values(valor).forEach((item) => deepFreeze(item));
  return valor;
}

const ORDEN_COBRADA_PENDIENTE_RETIRO = deepFreeze({
  id: "shadow-orden-001",
  estado: "COBRADO_PENDIENTE_RETIRO",
  tallerId: "shadow-t1",
  clientId: "shadow-c1",
  bikeId: "shadow-b1",
  garantia: "Garantia de ejemplo",
  excepciones: "Ninguna",
  observaciones: "Esperando retiro",
});

const ORDEN_ENTREGADA_COMPLETA = deepFreeze({
  id: "shadow-orden-002",
  estado: "ENTREGADO",
  tallerId: "shadow-t1",
  clientId: "shadow-c2",
  bikeId: "shadow-b2",
  garantiaFinal: "Garantia de ejemplo",
  cierreRechazo: {
    excepciones: "Ninguna",
    observaciones: "Todo conforme",
  },
});

const ORDEN_SIN_GARANTIA = deepFreeze({
  id: "shadow-orden-003",
  estado: "ENTREGADO",
  tallerId: "shadow-t1",
  clientId: "shadow-c3",
  bikeId: "shadow-b3",
  cierreRechazo: {
    excepciones: "Ninguna",
    observaciones: "Falta garantia",
  },
});

const ORDEN_SIN_CLIENTE_O_MOTO = deepFreeze({
  id: "shadow-orden-004",
  estado: "ENTREGADO",
  tallerId: "shadow-t1",
  garantiaFinal: "Garantia de ejemplo",
  cierreRechazo: {
    excepciones: "Ninguna",
    observaciones: "Datos incompletos",
  },
});

const ORDEN_CANCELADA = deepFreeze({
  id: "shadow-orden-005",
  estado: "CANCELADO",
  tallerId: "shadow-t1",
  clientId: "shadow-c5",
  bikeId: "shadow-b5",
  garantiaFinal: "Garantia de ejemplo",
  cierreRechazo: {
    excepciones: "Ninguna",
    observaciones: "Orden cancelada",
  },
});

const ORDEN_LEGACY_CAMPOS_ALTERNATIVOS = deepFreeze({
  uid: "shadow-orden-006",
  status: "entregada",
  cliente: { id: "shadow-c6", nombre: "Cliente sombra" },
  moto: { id: "shadow-b6", patente: "SOMBRA-001" },
  taller: { id: "shadow-t1", nombre: "Taller sombra" },
  pagado: true,
  retirado: true,
  garantia: "Garantia de ejemplo",
  excepciones: "Ninguna",
  observaciones: "Campos legacy alternativos",
  trabajos: [],
  repuestos: [],
  pagos: [],
});

export const ORDEN_SHADOW_FIXTURES = deepFreeze({
  cobradaPendienteRetiro: ORDEN_COBRADA_PENDIENTE_RETIRO,
  entregadaCompleta: ORDEN_ENTREGADA_COMPLETA,
  sinGarantia: ORDEN_SIN_GARANTIA,
  sinClienteOMoto: ORDEN_SIN_CLIENTE_O_MOTO,
  cancelada: ORDEN_CANCELADA,
  legacyCamposAlternativos: ORDEN_LEGACY_CAMPOS_ALTERNATIVOS,
});

export function obtenerOrdenShadowFixture(key = "cobradaPendienteRetiro") {
  return ORDEN_SHADOW_FIXTURES[key] || ORDEN_SHADOW_FIXTURES.cobradaPendienteRetiro;
}

