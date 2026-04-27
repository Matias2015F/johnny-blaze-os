import { calcularResultadosOrden } from "../lib/calc.js";

function descargarCSV(nombre, filas) {
  const csv = filas
    .map(f => f.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${nombre}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportarOrdenes(orders = [], bikes = [], clients = []) {
  const h = ["Fecha", "Estado", "Cliente", "Teléfono", "Patente", "Marca", "Modelo",
             "Tareas realizadas", "Total cobrado", "Costo interno", "Ganancia", "Rentabilidad %"];
  const filas = [h, ...orders.map(o => {
    const bike   = bikes.find(b => b.id === o.bikeId)    || {};
    const client = clients.find(c => c.id === o.clientId) || {};
    const res    = calcularResultadosOrden(o);
    return [
      o.fechaIngreso || "",
      o.estado || "",
      client.nombre || "",
      client.tel || "",
      bike.patente || "",
      bike.marca || "",
      bike.modelo || "",
      (o.tareas || []).map(t => t.nombre).join(" | "),
      res.total,
      res.costoInterno,
      res.margen,
      Math.round(res.rentabilidad),
    ];
  })];
  descargarCSV("ordenes", filas);
}

export function exportarClientes(clients = [], orders = []) {
  const h = ["Nombre", "Teléfono", "Cantidad de órdenes", "Total facturado", "Ganancia generada"];
  const filas = [h, ...clients.map(c => {
    const ords     = orders.filter(o => o.clientId === c.id);
    const totalFac = ords.reduce((s, o) => s + (o.total || 0), 0);
    const ganancia = ords.reduce((s, o) => s + calcularResultadosOrden(o).margen, 0);
    return [c.nombre || "", c.tel || "", ords.length, totalFac, ganancia];
  })];
  descargarCSV("clientes", filas);
}

export function exportarBalance(orders = []) {
  const porMes = {};
  orders.forEach(o => {
    const mes = (o.fechaIngreso || "sin-fecha").slice(0, 7);
    if (!porMes[mes]) porMes[mes] = { ordenes: 0, total: 0, costo: 0, ganancia: 0 };
    const res = calcularResultadosOrden(o);
    porMes[mes].ordenes++;
    porMes[mes].total    += res.total;
    porMes[mes].costo    += res.costoInterno;
    porMes[mes].ganancia += res.margen;
  });
  const h = ["Mes", "Órdenes", "Total cobrado", "Costo interno", "Ganancia neta", "Rentabilidad %"];
  const filas = [h, ...Object.entries(porMes).sort().map(([mes, d]) => [
    mes, d.ordenes, d.total, d.costo, d.ganancia,
    d.total > 0 ? Math.round((d.ganancia / d.total) * 100) : 0,
  ])];
  descargarCSV("balance_mensual", filas);
}

export function exportarRepuestos(orders = []) {
  const conteo = {};
  orders.forEach(o => {
    (o.repuestos || []).forEach(r => {
      const k = r.nombre?.trim().toUpperCase() || "SIN NOMBRE";
      if (!conteo[k]) conteo[k] = { cantidad: 0, totalCobrado: 0 };
      conteo[k].cantidad    += r.cantidad || 1;
      conteo[k].totalCobrado += (r.monto || 0) * (r.cantidad || 1);
    });
  });
  const h = ["Repuesto", "Veces usado", "Total cobrado"];
  const filas = [h, ...Object.entries(conteo)
    .sort((a, b) => b[1].cantidad - a[1].cantidad)
    .map(([nombre, d]) => [nombre, d.cantidad, d.totalCobrado])];
  descargarCSV("repuestos", filas);
}
