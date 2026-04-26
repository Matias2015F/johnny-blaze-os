import { LS } from "./storage.js";

const LS_KEY_APR = "jbos_aprendizaje";

export function guardarAprendizaje({ tipo, cilindrada, tiempoReal }) {
  const key = `${tipo.toUpperCase()}_${cilindrada}`;
  let data = {};
  try { data = JSON.parse(localStorage.getItem(LS_KEY_APR) || "{}"); } catch { /* */ }
  data[key] = data[key]
    ? { promedio: data[key].promedio * 0.8 + tiempoReal * 0.2, muestras: data[key].muestras + 1 }
    : { promedio: tiempoReal, muestras: 1 };
  localStorage.setItem(LS_KEY_APR, JSON.stringify(data));
}

export function obtenerAprendizaje(tipo, cilindrada) {
  try {
    const data = JSON.parse(localStorage.getItem(LS_KEY_APR) || "{}");
    return data[`${tipo.toUpperCase()}_${cilindrada}`] || null;
  } catch { return null; }
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
