import { useMemo, useState } from "react";
import { calcularResultadosOrden } from "../lib/calc.js";

function normalizarFecha(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export function usePagosView({ orders, bikes, clients }) {
  const hoy = useMemo(() => new Date().toLocaleDateString("sv-SE"), []);

  const [filtro,    setFiltro]    = useState("hoy");
  const [desde,     setDesde]     = useState(hoy);
  const [hasta,     setHasta]     = useState(hoy);
  const [ordenDesc, setOrdenDesc] = useState(true);

  // Ordenes activas con saldo calculado y bike/client enriquecidos
  const pendientes = useMemo(() => {
    return (orders || [])
      .filter((o) => o.estado !== "cerrado_emitido")
      .map((o) => {
        const total  = calcularResultadosOrden(o).total;
        const pagado = (o.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
        const saldo  = total - pagado;
        const bike   = bikes?.find((b) => b.id === o.bikeId)   || {};
        const client = clients?.find((c) => c.id === o.clientId) || {};
        return { ...o, total, pagado, saldo, bike, client };
      })
      .filter((o) => o.total > 0)
      .sort((a, b) => b.saldo - a.saldo);
  }, [orders, bikes, clients]);

  const sinCobrar     = useMemo(() => pendientes.filter((o) => o.saldo > 0), [pendientes]);
  const pagosCompletos = useMemo(
    () => pendientes.filter((o) => o.saldo <= 0 && o.estado !== "cerrado_emitido"),
    [pendientes]
  );

  // Historial plano de pagos, filtrado por fecha/periodo
  const historialPagos = useMemo(() => {
    const lista = (orders || []).flatMap((o) => {
      const bike   = bikes?.find((b) => b.id === o.bikeId)   || {};
      const client = clients?.find((c) => c.id === o.clientId) || {};
      return (o.pagos || []).map((p) => ({
        ...p,
        orderId:         o.id,
        numeroTrabajo:   o.numeroTrabajo || `#${o.id.slice(-4).toUpperCase()}`,
        clientName:      client?.nombre  || "Sin cliente",
        bikePlate:       bike?.patente   || "---",
        fechaNormalizada: normalizarFecha(p.fecha),
      }));
    });

    const sorted = lista.sort((a, b) => {
      const fa = `${a.fechaNormalizada || ""} ${a.hora || ""}`;
      const fb = `${b.fechaNormalizada || ""} ${b.hora || ""}`;
      return ordenDesc ? fb.localeCompare(fa) : fa.localeCompare(fb);
    });

    return sorted.filter((p) => {
      if (filtro === "todo")    return true;
      if (filtro === "hoy")    return p.fechaNormalizada === hoy;
      if (filtro === "periodo") {
        const f = p.fechaNormalizada;
        return !!f && f >= desde && f <= hasta;
      }
      return true;
    });
  }, [orders, bikes, clients, filtro, hoy, desde, hasta, ordenDesc]);

  const stats = useMemo(() => ({
    cobradoHoy:         historialPagos.filter((p) => p.fechaNormalizada === hoy).reduce((s, p) => s + (p.monto || 0), 0),
    totalFiltrado:      historialPagos.reduce((s, p) => s + (p.monto || 0), 0),
    saldoPendienteTotal: sinCobrar.reduce((s, o) => s + o.saldo, 0),
  }), [historialPagos, sinCobrar, hoy]);

  return {
    sinCobrar,
    pagosCompletos,
    historialPagos,
    stats,
    filtro,     setFiltro,
    desde,      setDesde,
    hasta,      setHasta,
    ordenDesc,  setOrdenDesc,
    mostrarRangos: filtro === "periodo",
  };
}
