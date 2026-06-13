export const PLANTILLAS_GARANTIA = [
  { id: "estandar", nombre: "Estándar", texto: "Garantía de 3 meses o 5.000 km sobre mano de obra. No cubre repuestos provistos por el cliente." },
  { id: "motor", nombre: "Reparación de motor", texto: "Garantía de 6 meses. Requiere control de aceite cada 1.000 km en este taller para mantener la validez." },
  { id: "transmision", nombre: "Transmisión / frenos", texto: "Garantía de 30 días. Sujeta a condiciones de uso normal y limpieza de cadena." },
];

export const TEXTO_CIERRE_RECHAZO = "Cliente rechaza o pospone el trabajo. El presupuesto queda cerrado sin garantia porque no se realizo la reparacion presupuestada. Si el cliente regresa en el futuro, el presupuesto puede ajustarse segun precios, disponibilidad de repuestos y estado de la moto al momento de retomar.";

export const CONFIG_DEFAULT = {
  id: "global",
  nombreTaller: "Moto Gestión",
  mecanicoResponsable: "Matías Fleischmann",
  dniMecanico: "---",
  telefonoTaller: "3434XXXXXX",
  emailNotificacion: "",
  direccionTaller: "",
  ciudadTaller: "",
  provinciaTaller: "",
  lat: null,
  lng: null,
  garantiaDias: 7,
  garantiaKm: 500,
  descuentoCalificacionPct: 15,
  garantiaDefault: PLANTILLAS_GARANTIA[0].texto,
  garantiaEstructurada: {
    observacionesTecnicas: "",
    limitesGarantia: "La garantía cubre mano de obra sobre los trabajos indicados. No cubre desgaste normal, modificaciones o repuestos provistos por el cliente.",
    responsabilidadesMecanico: "Revisión y corrección sin costo adicional de fallas directamente atribuibles al servicio realizado dentro del período de garantía.",
    responsabilidadesCliente: "Presentar el vehículo en el taller ante cualquier síntoma. La garantía se invalida por modificaciones no autorizadas, mal uso o falta de mantenimiento.",
    repuestosConGarantia: "",
    repuestosSinGarantia: "Repuestos provistos por el cliente no tienen garantía de nuestra parte.",
    mantenimientoRecomendado: "",
    proximosServiciosSugeridos: "",
    advertenciasDeUso: "",
  },
  offsetServiceKm: 2500,
  valorHoraInterno: 12000,
  margenPolitica: 25,
  valorHoraCliente: 15000,
  alertasNavegadorActivas: true,
  factorDificultad: { facil: 1, normal: 1.3, dificil: 1.7, complicado: 2.2 },
  cronometroAlertas: { activo: true, frecuenciaMin: 30 },
  datosCobro: {
    titular: "",
    banco: "",
    alias: "",
    cbu: "",
    cuit: "",
    tipoCuenta: "",
  },
  presupuestoConfig: {
    adelantoPct: 30,
    incluirAlias: true,
    incluirCBU: true,
    advertenciaAbierto: true,
    rechazoExtraPct: 0,
    rechazoExtraMonto: 0,
  },
  motivosIngreso: [
    "Service general",
    "Cambio de aceite",
    "Frenos",
    "No arranca",
    "Cadena / piñones",
    "Eléctrico",
    "Ruidos",
  ],
};

export const SERVICIOS_DEFAULT = [
  { id: "aceite", nombre: "Cambio de aceite", horasBase: 0.5, dificultad: "normal", repuestos: [], insumos: [{ nombre: "Insumos limpieza", monto: 1500 }] },
  { id: "transmision", nombre: "Cambio kit transmisión", horasBase: 1.5, dificultad: "normal", repuestos: [], insumos: [{ nombre: "Grasa cadena", monto: 1500 }] },
  { id: "carburacion", nombre: "Limpieza carburador", horasBase: 2.5, dificultad: "dificil", repuestos: [], insumos: [{ nombre: "Limpia carburador", monto: 2500 }] },
];

export const ESTADO_LABEL = {
  diagnostico: "Diagnóstico",
  presupuesto: "Presupuesto",
  aprobacion: "Esperando aprobación",
  reparacion: "En reparación",
  finalizada: "Listo para cobrar",
  listo_para_emitir: "Listo para emitir",
  entregada: "Pagado",
  cobrado_pendiente_retiro: "Cobrado — pendiente de retiro",
  cerrado_emitido: "Cerrado",
};

export const ESTADO_CSS = {
  diagnostico: "bg-slate-500 text-white",
  presupuesto: "bg-purple-600 text-white",
  aprobacion: "bg-yellow-500 text-black",
  reparacion: "bg-blue-600 text-white",
  finalizada: "bg-green-600 text-white",
  listo_para_emitir: "bg-emerald-600 text-white",
  entregada: "bg-emerald-700 text-white",
  cobrado_pendiente_retiro: "bg-amber-600 text-white",
  cerrado_emitido: "bg-slate-900 text-white",
};
