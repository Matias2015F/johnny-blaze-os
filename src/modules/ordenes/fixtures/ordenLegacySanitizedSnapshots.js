import { sanitizarOrdenParaDiagnostico } from "../orden.sanitizer.js";

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach((item) => freeze(item));
  return value;
}

const ORDEN_CANONICA = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_001",
  estado: "ENTREGADO",
  clienteId: "cliente_sanitizado",
  motoId: "moto_sanitizada",
  tallerId: "taller_sanitizado",
  garantiaFinal: "Garantia de ejemplo",
  cierreRechazo: { excepciones: "Ninguna", observaciones: "Todo correcto" },
  trabajos: [],
  repuestos: [],
  pagos: [],
}));

const ORDEN_STATUS = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_002",
  status: "entregada",
  clienteId: "cliente_sanitizado",
  motoId: "moto_sanitzada",
  tallerId: "taller_sanitizado",
  garantia: "Garantia de ejemplo",
  excepciones: "Ninguna",
  observaciones: "Legacy status",
}));

const ORDEN_PAGADO_RETIRADO = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_003",
  pagado: true,
  retirado: true,
  clienteId: "cliente_sanitizado",
  motoId: "moto_sanitzada",
  tallerId: "taller_sanitizado",
  garantia: "Garantia de ejemplo",
  excepciones: "Ninguna",
  observaciones: "Pagado y retirado",
}));

const ORDEN_COBRADO_MOTO_RETIRADA = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_004",
  cobrado: true,
  motoRetirada: true,
  clienteId: "cliente_sanitizado",
  motoId: "moto_sanitzada",
  tallerId: "taller_sanitizado",
  garantia: "Garantia de ejemplo",
  excepciones: "Ninguna",
  observaciones: "Cobrado y retirada",
}));

const ORDEN_CON_EMBEBIDOS = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_005",
  estado: "ENTREGADO",
  cliente: { id: "cliente_sanitizado", nombre: "Cliente demo", telefono: "[telefono oculto]" },
  moto: { id: "moto_sanitzada", patente: "AA000AA" },
  taller: { id: "taller_sanitizado", nombre: "Taller demo" },
  garantia: "Garantia de ejemplo",
  excepciones: "Ninguna",
  observaciones: "Embebidos",
}));

const ORDEN_SOLO_IDS = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_006",
  estado: "ENTREGADO",
  clientId: "cliente_sanitizado",
  bikeId: "moto_sanitzada",
  tallerId: "taller_sanitizado",
  garantiaFinal: "Garantia de ejemplo",
  cierreRechazo: { excepciones: "Ninguna", observaciones: "Solo ids" },
}));

const ORDEN_INCOMPLETA = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_007",
  estado: "BORRADOR",
  tallerId: "taller_sanitizado",
}));

const ORDEN_DESCONOCIDA = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_008",
  estado: "ENTREGADO",
  clientId: "cliente_sanitizado",
  bikeId: "moto_sanitzada",
  tallerId: "taller_sanitizado",
  campoRaroUno: "valor",
  campoRaroDos: 123,
  nested: { raro: true },
  garantiaFinal: "Garantia de ejemplo",
  cierreRechazo: { excepciones: "Ninguna", observaciones: "Desconocidos" },
}));

const ORDEN_CANCELADA = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_009",
  estado: "CANCELADO",
  clientId: "cliente_sanitizado",
  bikeId: "moto_sanitzada",
  tallerId: "taller_sanitizado",
  garantiaFinal: "Garantia de ejemplo",
  cierreRechazo: { excepciones: "Ninguna", observaciones: "Cancelada" },
}));

const ORDEN_SUFICIENTE_PDF = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_010",
  estado: "ENTREGADO",
  clientId: "cliente_sanitizado",
  bikeId: "moto_sanitzada",
  tallerId: "taller_sanitizado",
  garantiaFinal: "Garantia de ejemplo",
  cierreRechazo: { excepciones: "Ninguna", observaciones: "Lista para PDF" },
  repuestos: [{ nombre: "Filtro", monto: 1000 }],
  pagos: [{ monto: 5000 }],
}));

const ORDEN_COBRADO_PENDIENTE_RETIRO = freeze(sanitizarOrdenParaDiagnostico({
  id: "orden_demo_011",
  estado: "COBRADO_PENDIENTE_RETIRO",
  cobrado: true,
  retirado: false,
  motoRetirada: false,
  clientId: "cliente_sanitizado",
  bikeId: "moto_sanitzada",
  tallerId: "taller_sanitizado",
  garantiaFinal: "Garantia de ejemplo",
  cierreRechazo: { excepciones: "Ninguna", observaciones: "Pendiente de retiro" },
}));

export const ORDEN_LEGACY_SANITIZED_SNAPSHOTS = freeze({
  canonicaCompleta: ORDEN_CANONICA,
  statusAlternativo: ORDEN_STATUS,
  pagadoRetirado: ORDEN_PAGADO_RETIRADO,
  cobradoMotoRetirada: ORDEN_COBRADO_MOTO_RETIRADA,
  cobradoPendienteRetiro: ORDEN_COBRADO_PENDIENTE_RETIRO,
  conEmbebidos: ORDEN_CON_EMBEBIDOS,
  soloIds: ORDEN_SOLO_IDS,
  incompleta: ORDEN_INCOMPLETA,
  desconocida: ORDEN_DESCONOCIDA,
  cancelada: ORDEN_CANCELADA,
  suficienteParaPdf: ORDEN_SUFICIENTE_PDF,
});

export function obtenerOrdenLegacySanitizedSnapshot(key = "canonicaCompleta") {
  return ORDEN_LEGACY_SANITIZED_SNAPSHOTS[key] || ORDEN_LEGACY_SANITIZED_SNAPSHOTS.canonicaCompleta;
}
