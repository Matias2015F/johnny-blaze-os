import { LS } from "./storage.js";
import { CONFIG_DEFAULT } from "./constants.js";
import { formatMoney } from "../utils/format.js";

export const calcularNuevoTotal = (tareas = [], repuestos = [], fletes = []) => {
  const t = tareas.reduce((s, x) => s + (x.monto || 0), 0);
  const r = repuestos.reduce((s, x) => s + ((x.monto || 0) * (x.cantidad || 1)), 0);
  const f = fletes.reduce((s, x) => s + (x.monto || 0), 0);
  return t + r + f;
};

export const calcularResultadosOrden = (order) => {
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const vHoraInt = config.valorHoraInterno || 12000;

  // ── Precio al cliente (lo que se cobra) ──────────────────────
  const moCliente        = (order.tareas    || []).reduce((s, t) => s + (t.monto || 0), 0);
  const repuestosCliente = (order.repuestos || []).reduce((s, r) => s + ((r.monto || 0) * (r.cantidad || 1)), 0);
  const fletesCliente    = (order.fletes    || []).reduce((s, f) => s + (f.monto || 0), 0);
  const totalCobrado     = moCliente + repuestosCliente + fletesCliente;

  // ── Costo interno (lo que sale de caja) ──────────────────────
  const moCosto          = (order.tareas    || []).reduce((s, t) => s + ((t.horasReal || t.horasBase || 0) * vHoraInt), 0);
  const repuestosCosto   = (order.repuestos || []).reduce((s, r) => s + ((r.montoCosto || r.monto || 0) * (r.cantidad || 1)), 0);
  const fletesCosto      = (order.fletes    || []).reduce((s, f) => s + ((f.montoCosto || f.monto || 0)), 0);
  const insumosOverhead  = (order.insumos   || []).reduce((s, i) => s + (i.monto || 0), 0); // no se cobra, es gasto operativo

  const costoInternoTotal = moCosto + repuestosCosto + fletesCosto + insumosOverhead;

  // ── Resultado ─────────────────────────────────────────────────
  const margen       = totalCobrado - costoInternoTotal;
  const rentabilidad = totalCobrado > 0 ? (margen / totalCobrado) * 100 : 0;

  const tareasAnalizadas = (order.tareas || []).map((t) => {
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
      // Cada categoría: cobrado / costo / margen — simétrico y consistente
      moCliente,        moCosto,        margenMO:        moCliente        - moCosto,
      repuestosCliente, repuestosCosto, margenRepuestos: repuestosCliente - repuestosCosto,
      fletesCliente,    fletesCosto,    margenFletes:    fletesCliente    - fletesCosto,
      // Insumos: gasto operativo puro, no facturado al cliente
      insumosOverhead,
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
