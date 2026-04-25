export const hoyEstable = () => new Date().toLocaleDateString("sv-SE");

export const PLANTILLAS_GARANTIA = [
  { id: "estandar", nombre: "Estándar", texto: "Garantía de 3 meses o 5.000km sobre mano de obra. No cubre repuestos provistos por el cliente." },
  { id: "motor", nombre: "Reparación de Motor", texto: "Garantía de 6 meses. Requiere control de aceite cada 1.000km en este taller para mantener la validez." },
  { id: "transmision", nombre: "Transmisión/Frenos", texto: "Garantía de 30 días. Sujeta a condiciones de uso normal y limpieza de cadena." },
];

export const CONFIG_DEFAULT = {
  id: "global",
  nombreTaller: "JOHNNY BLAZE OS",
  mecanicoResponsable: "Matías Fleischmann",
  dniMecanico: "---",
  telefonoTaller: "3434XXXXXX",
  garantiaDias: 7,
  garantiaKm: 500,
  garantiaDefault: PLANTILLAS_GARANTIA[0].texto,
  offsetServiceKm: 2500,
  valorHoraInterno: 12000,
  valorHoraCliente: 15000,
  factorDificultad: { facil: 1, normal: 1.3, dificil: 1.7, complicado: 2.2 },
};

export const SERVICIOS_DEFAULT = [
  { id: "aceite", nombre: "Cambio de aceite", horasBase: 0.5, dificultad: "normal", repuestos: [], insumos: [{ nombre: "Insumos limpieza", monto: 1500 }] },
  { id: "transmision", nombre: "Cambio kit transmisión", horasBase: 1.5, dificultad: "normal", repuestos: [], insumos: [{ nombre: "Grasa cadena", monto: 1500 }] },
  { id: "carburacion", nombre: "Limpieza Carburador", horasBase: 2.5, dificultad: "dificil", repuestos: [], insumos: [{ nombre: "Limpia carburador", monto: 2500 }] },
];

export const ESTADO_LABEL = {
  diagnostico: "Diagnóstico",
  presupuesto: "Presupuesto",
  aprobacion: "Esperando Aprobación",
  reparacion: "En Reparación",
  finalizada: "Listo para entrega",
  entregada: "Entregado",
};

export const ESTADO_CSS = {
  diagnostico: "bg-slate-500 text-white",
  presupuesto: "bg-purple-600 text-white",
  aprobacion: "bg-yellow-500 text-black",
  reparacion: "bg-blue-600 text-white",
  finalizada: "bg-green-600 text-white",
  entregada: "bg-slate-900 text-white",
};
