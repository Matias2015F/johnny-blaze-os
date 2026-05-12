import { LS } from "./storage.js";
import { CONFIG_DEFAULT } from "./constants.js";
import { formatMoney } from "../utils/format.js";

const noRechazado = x => x.aprobacion !== "rechazado";

export const calcularNuevoTotal = (tareas = [], repuestos = [], fletes = [], insumos = []) => {
  const t = tareas.filter(noRechazado).reduce((s, x) => s + (x.monto || 0), 0);
  const r = repuestos.filter(noRechazado).reduce((s, x) => s + ((x.monto || 0) * (x.cantidad || 1)), 0);
  const f = fletes.filter(noRechazado).reduce((s, x) => s + (x.monto || 0), 0);
  const i = insumos.filter(noRechazado).reduce((s, x) => s + ((x.monto || 0) * (x.cantidad || 1)), 0);
  return t + r + f + i;
};

export const calcularResultadosOrden = (order) => {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const vHoraInt = config.valorHoraInterno || 12000;

  const tareasOk    = (order.tareas    || []).filter(noRechazado);
  const repuestosOk = (order.repuestos || []).filter(noRechazado);
  const fletesOk    = (order.fletes    || []).filter(noRechazado);
  const insumosOk   = (order.insumos   || []).filter(noRechazado);

  // ── Precio al cliente (lo que se cobra) ──────────────────────
  const moCliente        = tareasOk.reduce((s, t) => s + (t.monto || 0), 0);
  const repuestosCliente = repuestosOk.reduce((s, r) => s + ((r.monto || 0) * (r.cantidad || 1)), 0);
  const fletesCliente    = fletesOk.reduce((s, f) => s + (f.monto || 0), 0);
  const insumosCliente   = insumosOk.reduce((s, i) => s + ((i.monto || 0) * (i.cantidad || 1)), 0);
  const totalCobrado     = moCliente + repuestosCliente + fletesCliente + insumosCliente;

  // ── Costo interno (lo que sale de caja) ──────────────────────
  const moCosto        = tareasOk.reduce((s, t) => s + ((t.horasReal || t.horasBase || 0) * vHoraInt), 0);
  const repuestosCosto = repuestosOk.reduce((s, r) => s + ((r.montoCosto || r.monto || 0) * (r.cantidad || 1)), 0);
  const fletesCosto    = fletesOk.reduce((s, f) => s + ((f.montoCosto || f.monto || 0)), 0);
  const insumosCosto   = insumosCliente; // se cobran al cliente al mismo precio que cuestan

  const costoInternoTotal = moCosto + repuestosCosto + fletesCosto + insumosCosto;

  // ── Resultado ─────────────────────────────────────────────────
  const margen       = totalCobrado - costoInternoTotal;
  const rentabilidad = totalCobrado > 0 ? (margen / totalCobrado) * 100 : 0;

  const tareasAnalizadas = tareasOk.map((t) => {
    const costoT = (t.horasReal || t.horasBase || 1) * vHoraInt;
    return { ...t, perdida: t.monto < costoT };
  });

  const sinCostoCargado = (order.repuestos || []).some(r => !r.montoCosto);

  return {
    total: totalCobrado,
    costoInterno: costoInternoTotal,
    margen,
    rentabilidad,
    tareasAnalizadas,
    sinCostoCargado,
    desglose: {
      moCliente,        moCosto,        margenMO:        moCliente        - moCosto,
      repuestosCliente, repuestosCosto, margenRepuestos: repuestosCliente - repuestosCosto,
      fletesCliente,    fletesCosto,    margenFletes:    fletesCliente    - fletesCosto,
      insumosCliente,   insumosCosto,   margenInsumos:   0, // se cobran al costo, sin markup
    },
  };
};

export function calcularNuevoRango({ tiempoActual, costoHora, promedioHoras, desvioHoras }) {
  const costoActual = tiempoActual * costoHora;
  const restanteMin = Math.max(promedioHoras - tiempoActual, 0);
  const restanteMax = Math.max(promedioHoras + desvioHoras - tiempoActual, 0);
  return {
    costoActual,
    nuevoMin: costoActual + restanteMin * costoHora,
    nuevoMax: costoActual + restanteMax * costoHora,
  };
}

export function evaluarEstado({ tiempoHoras, valorHora, maxAutorizado }) {
  if (!maxAutorizado) return { estadoCron: "NORMAL", costoActual: tiempoHoras * valorHora };
  const costoActual = tiempoHoras * valorHora;
  if (costoActual >= maxAutorizado) return { estadoCron: "BLOQUEADO", costoActual };
  if (costoActual >= maxAutorizado * 0.8) return { estadoCron: "ALERTA", costoActual };
  return { estadoCron: "NORMAL", costoActual };
}

export const generarMensajePresupuesto = (order, bike, client) => {
  return `Hola ${client.nombre || "cliente"}.
Te paso el presupuesto estimado de tu moto ${bike.marca || ""} ${bike.modelo || ""} (${bike.patente || "---"}).

Trabajos a realizar:
${(order.tareas || []).map((t) => `• ${t.nombre}`).join("\n")}

Total estimado repuestos y mano de obra: ${formatMoney(order.total)}

Confirmame por favor si autorizás el trabajo.`;
};
