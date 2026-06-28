import { useState, useEffect } from "react";
import { LS, obtenerOrden, actualizarOrden } from "../lib/storage.js";

export function useEsperandoAprobacion(ordenId) {
  const [orden, setOrden] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [moto, setMoto] = useState(null);
  const [tiempoEspera, setTiempoEspera] = useState(0);

  useEffect(() => {
    const o = obtenerOrden(ordenId);
    if (!o) return;
    setOrden(o);
    setCliente(LS.getDoc("clientes", o.clientId) || {});
    setMoto(LS.getDoc("motos", o.bikeId) || {});
  }, [ordenId]);

  useEffect(() => {
    const interval = setInterval(() => setTiempoEspera((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const horas = Math.floor(tiempoEspera / 3600);
  const minutos = Math.floor((tiempoEspera % 3600) / 60);
  const segundos = tiempoEspera % 60;

  const totalTareas = (orden?.tareas || []).reduce((s, t) => s + (t.monto || 0), 0);
  const totalRepuestos = (orden?.repuestos || []).reduce((s, r) => s + (r.monto || 0) * (r.cantidad || 1), 0);
  const totalInsumos = (orden?.insumos || []).reduce((s, i) => s + (i.monto || 0), 0);
  const totalFletes = (orden?.fletes || []).reduce((s, f) => s + (f.monto || 0), 0);
  const totalPresupuesto = orden?.total || totalTareas + totalRepuestos + totalInsumos + totalFletes;

  const aprobar = () => {
    actualizarOrden(ordenId, { estado: "aprobacion", aprobado_fecha: Date.now() });
    return { ok: true };
  };

  return {
    orden,
    cliente,
    moto,
    horas,
    minutos,
    segundos,
    totalTareas,
    totalRepuestos,
    totalInsumos,
    totalFletes,
    totalPresupuesto,
    aprobar,
  };
}
