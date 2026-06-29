import { useMemo } from "react";

export function usePresupuestosView({ presupuestos, bikes, clients, busqueda, filtroEstado }) {
  const lista = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return presupuestos
      .filter((p) => {
        if (filtroEstado !== "todos" && p.estado !== filtroEstado) return false;
        if (!q) return true;
        const bike = bikes.find((b) => b.id === p.bikeId);
        const client = clients.find((c) => c.id === p.clientId);
        const patente = (bike?.patente || "").toLowerCase();
        const nombre = (client?.nombre || "").toLowerCase();
        const num = (p.numeroPresupuesto || "").toLowerCase();
        return patente.includes(q) || nombre.includes(q) || num.includes(q);
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [presupuestos, bikes, clients, busqueda, filtroEstado]);

  return { lista };
}
