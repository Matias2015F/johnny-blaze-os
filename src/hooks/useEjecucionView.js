import { useEffect, useMemo, useState } from "react";
import { LS, actualizarOrden, crearEntradaHistorial, obtenerOrden } from "../lib/storage.js";

export function useEjecucionView({ ordenId }) {
  const [orden,     setOrden]     = useState(null);
  const [cliente,   setCliente]   = useState(null);
  const [moto,      setMoto]      = useState(null);
  const [cronometro, setCronometro] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [notas,     setNotas]     = useState("");
  const [tareas,    setTareas]    = useState([]);

  useEffect(() => {
    const o = obtenerOrden(ordenId);
    if (!o) return;
    setOrden(o);
    setCliente(LS.getDoc("clientes", o.clientId) || {});
    setMoto(LS.getDoc("motos",    o.bikeId)    || {});
    setNotas(o.notasEjecucion || "");
    setTareas((o.tareas || []).map((t) => ({ ...t, completada: t.completada || false })));
    setCronometro(o.cronometroEjecucion || 0);
  }, [ordenId]);

  // Timer con cleanup correcto
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => setCronometro((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [isRunning]);

  // Cronómetro como objeto de display — formateo de tiempo es lógica de dominio
  const tiempoDisplay = useMemo(() => {
    const totalMin = Math.floor(cronometro / 60);
    return {
      horas:    Math.floor(totalMin / 60),
      minutos:  totalMin % 60,
      segundos: cronometro % 60,
    };
  }, [cronometro]);

  // Totales en un solo useMemo — evita 3 pasadas independientes
  const totales = useMemo(() => {
    const manoObra  = tareas.reduce((s, t) => s + (t.monto || 0), 0);
    const repuestos = (orden?.repuestos || []).reduce((s, r) => s + (r.monto || 0) * (r.cantidad || 1), 0);
    const fletes    = (orden?.fletes    || []).reduce((s, f) => s + (f.monto || 0), 0);
    const actual    = manoObra + repuestos + fletes;
    const presupuesto = orden?.total || 0;
    return { manoObra, repuestos, fletes, actual, presupuesto, supera: presupuesto > 0 && actual > presupuesto };
  }, [tareas, orden]);

  const toggleTarea = (idx) => {
    setTareas((prev) => prev.map((t, i) => (i === idx ? { ...t, completada: !t.completada } : t)));
  };

  // Persiste estado actual sin cambiar el flujo — guardado manual
  const guardar = () => {
    actualizarOrden(ordenId, {
      cronometroEjecucion: cronometro,
      notasEjecucion:      notas,
      tareas,
    });
  };

  // Persiste cierre y avanza estado — NO navega (la vista llama setView)
  const finalizar = () => {
    if (!orden) return;
    const entrada = crearEntradaHistorial(orden.estado, "finalizada");
    actualizarOrden(ordenId, {
      cronometroEjecucion: cronometro,
      notasEjecucion:      notas,
      tareas,
      estado:              "finalizada",
      finalizacion_fecha:  Date.now(),
      historial:           [...(orden.historial || []), entrada],
    });
  };

  return {
    isLoading: !orden,
    contexto: {
      patente:       moto?.patente   || "",
      clienteNombre: cliente?.nombre || "",
    },
    tiempoDisplay,
    isRunning, setIsRunning,
    tareas,    toggleTarea,
    notas,     setNotas,
    totales,
    guardar,
    finalizar,
  };
}
