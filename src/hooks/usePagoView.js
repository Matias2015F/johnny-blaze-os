import { useEffect, useMemo, useState } from "react";
import { LS, actualizarOrden, crearEntradaHistorial, crearRecordatorioDeOrden, generateId, obtenerOrden } from "../lib/storage.js";
import { hoyEstable } from "../lib/constants.js";
import { logAction } from "../services/auditService.js";

export function usePagoView({ ordenId }) {
  const [orden, setOrden] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [moto, setMoto] = useState(null);
  const [montoRecibido, setMontoRecibido] = useState("");
  const [metodoPago, setMetodoPago] = useState("efectivo");
  const [comprobante, setComprobante] = useState("");

  useEffect(() => {
    const o = obtenerOrden(ordenId);
    if (!o) return;
    setOrden(o);
    setCliente(LS.getDoc("clientes", o.clientId) || {});
    setMoto(LS.getDoc("motos", o.bikeId) || {});
    setMontoRecibido(String(o.costoFinal || o.total || 0));
  }, [ordenId]);

  const costoFinal = orden?.costoFinal || orden?.total || 0;
  const recibido   = Number(montoRecibido) || 0;
  const diferencia = recibido - costoFinal;

  const gananciaNeta = useMemo(
    () => (orden?.tareas || []).reduce((s, t) => s + (t.monto || 0), 0),
    [orden]
  );

  // Accion de negocio: mutaciones + audit — sin navegacion (la vista decide a donde ir)
  const registrarPago = () => {
    if (!orden) return;
    const nuevoPago = {
      id: generateId(),
      monto: recibido,
      metodo: metodoPago,
      comprobante,
      fecha: hoyEstable(),
      hora: new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
      tipo: "pago_final",
    };
    const entrada = crearEntradaHistorial(orden.estado, "cobrado_pendiente_retiro");
    actualizarOrden(ordenId, {
      estado: "cobrado_pendiente_retiro",
      pagado_fecha: Date.now(),
      ganancia: gananciaNeta,
      pagos: [...(orden.pagos || []), nuevoPago],
      historial: [...(orden.historial || []), entrada],
    });
    LS.addDoc("caja", {
      fecha: hoyEstable(),
      tipo: "ingreso",
      concepto: `Pago trabajo ${orden.numeroTrabajo || ordenId.slice(-4).toUpperCase()}`,
      monto: recibido,
      metodo: metodoPago,
      comprobante,
    });
    logAction("pago_registrado", ordenId, "trabajo", {
      monto: recibido,
      metodo: metodoPago,
      numeroTrabajo: orden.numeroTrabajo || "",
    }).catch(() => {});
    crearRecordatorioDeOrden(orden);
  };

  return {
    isLoading: !orden,
    contexto: {
      patente:        moto?.patente   || "",
      clienteNombre:  cliente?.nombre || "",
    },
    costoFinal,
    gananciaNeta,
    diferencia,
    puedeConfirmar: recibido >= costoFinal,
    // Form state
    montoRecibido,  setMontoRecibido,
    metodoPago,     setMetodoPago,
    comprobante,    setComprobante,
    // Accion
    registrarPago,
  };
}
