import { LS } from "./storage.js";

const LS_KEY_APR = "jbos_aprendizaje";

export function guardarAprendizaje({ tipo, cilindrada, tiempoReal }) {
  const key = `${tipo.toUpperCase()}_${cilindrada}`;
  let data = {};
  try { data = JSON.parse(localStorage.getItem(LS_KEY_APR) || "{}"); } catch { /* */ }

  const prev = data[key];
  if (prev) {
    const desvioPrev = prev.desvio ?? Math.abs(tiempoReal - prev.promedio);
    data[key] = {
      promedio: prev.promedio * 0.8 + tiempoReal * 0.2,
      desvio:   desvioPrev  * 0.8 + Math.abs(tiempoReal - prev.promedio) * 0.2,
      muestras: prev.muestras + 1,
    };
  } else {
    data[key] = { promedio: tiempoReal, desvio: 0, muestras: 1 };
  }
  localStorage.setItem(LS_KEY_APR, JSON.stringify(data));
}

export function obtenerAprendizaje(tipo, cilindrada) {
  try {
    const data = JSON.parse(localStorage.getItem(LS_KEY_APR) || "{}");
    return data[`${tipo.toUpperCase()}_${cilindrada}`] || null;
  } catch { return null; }
}

// Confianza basada en cantidad de muestras y variabilidad (coef. de variación)
export function evaluarConfianza(apr) {
  if (!apr || !apr.muestras) return null;
  const { muestras, desvio = 0, promedio } = apr;
  const cv = promedio > 0 ? desvio / promedio : 1;

  if (muestras >= 6 && cv < 0.15) return { nivel: "alta",  texto: "Trabajo predecible",  badge: "bg-green-500/15 text-green-700 border-green-400/40" };
  if (muestras >= 3 && cv < 0.35) return { nivel: "media", texto: "Confianza media",      badge: "bg-blue-500/15 text-blue-700 border-blue-400/40" };
  return                                  { nivel: "baja",  texto: "Pocos datos aún",      badge: "bg-yellow-500/15 text-yellow-700 border-yellow-400/40" };
}

const COL = "precioHistorial";

export function registrarPrecio({ tarea, precio, cilindrada, modelo = "", marca = "", tipoMotor = "", tiempo = null }) {
  LS.addDoc(COL, {
    fecha: new Date().toISOString().slice(0, 10),
    tarea: tarea.toUpperCase(),
    precio,
    cilindrada,
    modelo,
    marca,
    tipoMotor,
    tiempo,
  });
}

export function obtenerHistorial(tarea) {
  return LS.getAll(COL).filter(r => r.tarea === tarea.toUpperCase());
}

export function calcularSugerencia(tarea, { cilindrada } = {}) {
  const todos = obtenerHistorial(tarea);
  if (!todos.length) return null;
  const precios = todos.map(r => r.precio);
  const similares = cilindrada
    ? todos.filter(r => Math.abs(r.cilindrada - cilindrada) <= 50).map(r => r.precio)
    : [];
  return {
    promedio: Math.round(precios.reduce((a, b) => a + b, 0) / precios.length),
    min: Math.min(...precios),
    max: Math.max(...precios),
    totalRegistros: todos.length,
    promedioSimilares: similares.length
      ? Math.round(similares.reduce((a, b) => a + b, 0) / similares.length)
      : null,
  };
}
