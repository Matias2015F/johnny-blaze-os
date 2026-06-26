import { useMemo } from "react";
import { calcularResultadosOrden } from "../lib/calc.js";

export function useResumenPanel({ orders, caja }) {
  const mesActual = new Date().toISOString().slice(0, 7);

  const ordenesMes = useMemo(
    () => orders.filter((o) => (o.fechaIngreso || "").startsWith(mesActual)),
    [orders, mesActual]
  );

  const { totalMes, gananciaMes } = useMemo(() => ({
    totalMes:    ordenesMes.reduce((s, o) => s + (o.total || 0), 0),
    gananciaMes: ordenesMes.reduce((s, o) => s + calcularResultadosOrden(o).gananciaEstimada, 0),
  }), [ordenesMes]);

  const balance = useMemo(
    () => caja.reduce((acc, m) => (m.tipo === "ingreso" ? acc + m.monto : acc - m.monto), 0),
    [caja]
  );

  const mes             = new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });
  const balancePositivo  = balance >= 0;
  const gananciaPositiva = gananciaMes >= 0;

  return { ordenesMes, totalMes, gananciaMes, balance, mes, balancePositivo, gananciaPositiva };
}
