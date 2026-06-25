import { useEffect, useState } from "react";
import { LS, actualizarOrden, crearEntradaHistorial, obtenerOrden } from "../lib/storage.js";

export function useRetiroView({ ordenId }) {
  const [orden, setOrden] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [moto, setMoto] = useState(null);
  const [retirado, setRetirado] = useState(false);
  const [editGarantia, setEditGarantia] = useState(false);
  const [garantia, setGarantia] = useState("");

  useEffect(() => {
    const o = obtenerOrden(ordenId);
    if (!o) return;
    setOrden(o);
    setCliente(LS.getDoc("clientes", o.clientId) || {});
    setMoto(LS.getDoc("motos", o.bikeId) || {});
    setGarantia(o.garantiaFinal || "");
    setRetirado(o.estado === "cerrado_emitido" || !!o.retiro_fecha);
  }, [ordenId]);

  // Accion central: registra retiro si todavia no fue registrado, retorna la orden actualizada
  const registrarRetiro = async () => {
    if (orden?.estado === "cerrado_emitido" || orden?.retiro_fecha) return orden;
    const entrada = crearEntradaHistorial(orden.estado, "cerrado_emitido");
    const patch = {
      retiro_fecha: Date.now(),
      estado: "cerrado_emitido",
      historial: [...(orden.historial || []), entrada],
    };
    await Promise.resolve(actualizarOrden(ordenId, patch));
    const fresh = obtenerOrden(ordenId);
    const next = fresh || { ...(orden || {}), ...patch };
    setOrden(next);
    setRetirado(true);
    return next;
  };

  const clienteRetira = async () => {
    await registrarRetiro();
  };

  const guardarGarantia = () => {
    actualizarOrden(ordenId, { garantiaFinal: garantia || "" });
    setEditGarantia(false);
  };

  const totalPagado   = (orden?.pagos  || []).reduce((s, p) => s + (p.monto || 0), 0);
  const totalManoObra = (orden?.tareas || []).reduce((s, t) => s + (t.monto || 0), 0);

  return {
    isLoading: !orden,
    contexto: {
      patente:       moto?.patente   || "",
      clienteNombre: cliente?.nombre || "",
    },
    resumen: {
      fecha:          new Date(orden?.finalizacion_fecha || orden?.updatedAt || Date.now()).toLocaleDateString("es-AR"),
      totalPagado,
      gananciaTaller: orden?.ganancia || totalManoObra,
      marca:          moto?.marca  || "",
      modelo:         moto?.modelo || "",
    },
    garantia,        setGarantia,
    editGarantia,    setEditGarantia,
    retirado,
    ordenEstado:     orden?.estado || "",
    receiptToken:    orden?.receiptToken || orden?.tokenComprobante || orden?.publicReceiptToken || orden?.token || "",
    clienteTelefono: cliente?.celular || cliente?.whatsapp || cliente?.tel || cliente?.telefono || orden?.clienteTel || "",
    // Acciones de dominio
    registrarRetiro,
    clienteRetira,
    guardarGarantia,
  };
}
