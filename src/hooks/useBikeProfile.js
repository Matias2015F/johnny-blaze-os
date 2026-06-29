import { useCollection, LS } from "../lib/storage.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { evaluarEstadoRecordatorio } from "../lib/proximoControl.js";

export function useBikeProfile({ bikeId, kmActual }) {
  const recordatorios = useCollection("recordatorios");
  const config = LS.getDoc("config", "global") || {};

  const alertasMoto = (recordatorios || [])
    .filter((r) => r.motoId === bikeId && (r.estado === "pendiente" || r.estado === "avisado"))
    .map((r) => ({ ...r, estadoAlerta: evaluarEstadoRecordatorio(r, kmActual) }))
    .filter((r) => r.estadoAlerta !== "normal")
    .sort((a, _b) => (a.estadoAlerta === "service_vencido" ? -1 : 1));

  const calcularTotal = (order) => calcularResultadosOrden(order).total;

  return { alertasMoto, config, calcularTotal };
}
