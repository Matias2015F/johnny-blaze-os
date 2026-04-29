export const TIPOS_SERVICIO = {
  cambio_aceite:   "Cambio de aceite",
  frenos:          "Control de frenos",
  transmision:     "Control de transmisión",
  valvulas:        "Regulación de válvulas",
  service:         "Service general",
  control_general: "Control general",
  otro:            "Otro control",
};

export function normalizarTexto(texto) {
  if (!texto) return "";
  return texto
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const KEYWORDS = {
  cambio_aceite:   ["aceite", "aciete", "aseite"],
  frenos:          ["freno", "frenos", "pastilla", "pastillas"],
  transmision:     ["transmision", "transmicion", "cadena", "kit transmision"],
  valvulas:        ["valvula", "valvulas"],
  service:         ["service", "servis", "serivce"],
  control_general: ["control general"],
};

function detectarTipo(norm) {
  for (const [tipo, kws] of Object.entries(KEYWORDS)) {
    if (kws.some(kw => norm.includes(kw))) return tipo;
  }
  return null;
}

function detectarKm(norm) {
  const patterns = [
    /(\d[\d.]*)\s*(?:km|kms|kilometros)/,
    /(?:a los|en los|en|cada)\s+(\d[\d.]*)/,
  ];
  for (const p of patterns) {
    const m = norm.match(p);
    if (m) {
      const val = parseInt(m[1].replace(/\./g, ""), 10);
      if (val > 0 && val <= 100000) return val;
    }
  }
  return null;
}

function detectarDias(norm) {
  const mDias = norm.match(/en\s+(\d+)\s*(?:dias|dia)/);
  if (mDias) return parseInt(mDias[1], 10);
  const mMes = norm.match(/en\s+(\d+)\s*(?:meses|mes)/);
  if (mMes) return parseInt(mMes[1], 10) * 30;
  const mSem = norm.match(/en\s+(\d+)\s*(?:semanas|semana)/);
  if (mSem) return parseInt(mSem[1], 10) * 7;
  return null;
}

export function detectarProximoControl(texto) {
  if (!texto?.trim()) return null;
  const norm = normalizarTexto(texto);
  const tipo = detectarTipo(norm);
  if (!tipo) return null;
  const km   = detectarKm(norm);
  const dias = detectarDias(norm);
  if (!km && !dias) return null;
  return {
    tipo,
    descripcion: TIPOS_SERVICIO[tipo],
    textoOrigen: texto.trim(),
    unidad: km ? "km" : "dias",
    valorObjetivo: km || dias,
  };
}

const MARGEN_KM   = 500;
const MARGEN_DIAS = 7;

export function buildProximoControl({ tipo, descripcion, unidad, valorObjetivo, kmBase, fechaBase, textoOrigen = "", origen = "manual" }) {
  return {
    activo: true,
    origen,
    tipo,
    descripcion: descripcion || TIPOS_SERVICIO[tipo] || tipo,
    unidad,
    valorObjetivo,
    textoOrigen,
    kmBase:        unidad === "km" ? (kmBase ?? 0) : null,
    kmObjetivo:    unidad === "km" ? (kmBase ?? 0) + valorObjetivo : null,
    kmAviso:       unidad === "km" ? (kmBase ?? 0) + valorObjetivo - MARGEN_KM : null,
    fechaBase:     unidad === "dias" ? (fechaBase || new Date().toISOString().slice(0, 10)) : null,
    fechaObjetivo: unidad === "dias"
      ? new Date(Date.now() + valorObjetivo * 86400000).toISOString().slice(0, 10)
      : null,
  };
}

export function evaluarEstadoRecordatorio(rec, kmActual, ahora = Date.now()) {
  if (!rec?.activo) return "normal";

  if (rec.unidad === "km" && kmActual != null) {
    if (kmActual >= rec.kmObjetivo) return "service_vencido";
    if (kmActual >= rec.kmAviso)    return "proximo_service";
    return "normal";
  }

  if ((rec.unidad === "dias" || rec.unidad === "minutos") && rec.fechaObjetivo) {
    const obj   = new Date(rec.fechaObjetivo).getTime();
    const aviso = rec.unidad === "minutos" ? obj - 60000 : obj - MARGEN_DIAS * 86400000;
    if (ahora >= obj)   return "service_vencido";
    if (ahora >= aviso) return "proximo_service";
    return "normal";
  }

  return "normal";
}

export function generarMensajeWhatsApp(cliente, moto, recordatorio, config) {
  const nombreTaller  = config?.nombreTaller || "el taller";
  const nombreCliente = cliente?.nombre || "cliente";
  const marca         = moto?.marca  || "";
  const modelo        = moto?.modelo || "";
  const patente       = moto?.patente || "";
  const tipoControl   = recordatorio?.descripcion || "service";
  const plantilla     = config?.whatsappPlantillas?.recordatorioService;

  if (plantilla) {
    return plantilla
      .replace("{nombreCliente}", nombreCliente)
      .replace("{nombreTaller}",  nombreTaller)
      .replace("{marca}",         marca)
      .replace("{modelo}",        modelo)
      .replace("{patente}",       patente)
      .replace("{tipoControl}",   tipoControl);
  }

  return `Hola ${nombreCliente}, te escribimos de ${nombreTaller}.\n\nTu moto ${marca} ${modelo} patente ${patente} puede estar cerca del próximo control recomendado: ${tipoControl}.\n\nSi querés, podés pasar por el taller y la revisamos para verificarlo.`;
}
