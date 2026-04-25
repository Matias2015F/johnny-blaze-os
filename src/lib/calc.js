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

  const totalCobrado =
    (order.tareas || []).reduce((s, t) => s + (t.monto || 0), 0) +
    (order.repuestos || []).reduce((s, r) => s + ((r.monto || 0) * (r.cantidad || 1)), 0) +
    (order.fletes || []).reduce((s, f) => s + (f.monto || 0), 0);

  const tareasAnalizadas = (order.tareas || []).map((t) => {
    const costoT = (t.horasReal || t.horasBase || 1) * vHoraInt;
    return { ...t, perdida: t.monto < costoT };
  });

  const costoRepuestos = (order.repuestos || []).reduce((s, r) => s + ((r.montoCosto || r.monto || 0) * (r.cantidad || 1)), 0);
  const costoInsumos = (order.insumos || []).reduce((s, i) => s + (i.monto || 0), 0);
  const costoFletes = (order.fletes || []).reduce((s, f) => s + (f.monto || 0), 0);
  const costoMO = (order.tareas || []).reduce((s, t) => s + ((t.horasReal || t.horasBase || 0) * vHoraInt), 0);

  const costoInternoTotal = costoRepuestos + costoInsumos + costoFletes + costoMO;
  const margen = totalCobrado - costoInternoTotal;
  const rentabilidad = totalCobrado > 0 ? (margen / totalCobrado) * 100 : 0;

  return { total: totalCobrado, costoInterno: costoInternoTotal, margen, rentabilidad, tareasAnalizadas };
};

export const generarMensajePresupuesto = (order, bike, client) => {
  return `Hola ${client.nombre || "cliente"}.
Te paso el presupuesto estimado de tu moto ${bike.marca || ""} ${bike.modelo || ""} (${bike.patente || "---"}).

Trabajos a realizar:
${(order.tareas || []).map((t) => `• ${t.nombre}`).join("\n")}

Total estimado repuestos y mano de obra: ${formatMoney(order.total)}

Confirmame por favor si autorizás el trabajo.`;
};
