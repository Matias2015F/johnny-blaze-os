import { useEffect, useMemo, useState } from "react";
import { LS, actualizarOrden, crearEntradaHistorial, obtenerOrden } from "../lib/storage.js";
import { abrirEnlaceExterno, generarEnlaceMontoFinal } from "../lib/whatsappService.js";

export function useFinalizacionView({ ordenId }) {
  const [orden,   setOrden]   = useState(null);
  const [cliente, setCliente] = useState(null);
  const [moto,    setMoto]    = useState(null);

  const [costosAdicionales, setCostosAdicionales] = useState(0);
  const [motivoAdicional,   setMotivoAdicional]   = useState("");
  const [whatsappEnviado,   setWhatsappEnviado]   = useState(false);

  useEffect(() => {
    const o = obtenerOrden(ordenId);
    if (!o) return;
    setOrden(o);
    setCliente(LS.getDoc("clientes", o.clientId) || {});
    setMoto(LS.getDoc("motos",    o.bikeId)    || {});
    setCostosAdicionales(o.costosAdicionales || 0);
    setMotivoAdicional(o.motivoAdicional || "");
  }, [ordenId]);

  // Cálculos financieros derivados — se recomputan solo cuando cambian sus deps
  const desglose = useMemo(() => {
    const manoObra   = (orden?.tareas    || []).reduce((s, t) => s + (t.monto || 0), 0);
    const repuestos  = (orden?.repuestos || []).reduce((s, r) => s + (r.monto || 0) * (r.cantidad || 1), 0);
    const insumos    = (orden?.insumos   || []).reduce((s, i) => s + (i.monto || 0), 0);
    const fletes     = (orden?.fletes    || []).reduce((s, f) => s + (f.monto || 0), 0);
    const materiales = repuestos + insumos + fletes;
    const costoFinal = manoObra + materiales + Number(costosAdicionales || 0);
    return { manoObra, materiales, costoFinal, ganancia: manoObra };
  }, [orden, costosAdicionales]);

  // Persiste el monto final y abre WhatsApp — la navegacion queda en la vista
  const enviarWhatsApp = () => {
    if (!orden) return;
    actualizarOrden(ordenId, {
      whatsappFinalEnviado: true,
      costosAdicionales:   Number(costosAdicionales || 0),
      motivoAdicional,
      costoFinal: desglose.costoFinal,
    });
    const enlace = generarEnlaceMontoFinal(orden, desglose.costoFinal, cliente, moto);
    abrirEnlaceExterno(enlace);
    setWhatsappEnviado(true);
  };

  // Persiste el cierre y avanza el estado — NO navega (la vista llama setView)
  const confirmarPago = () => {
    if (!orden) return;
    const entrada = crearEntradaHistorial(orden.estado, "listo_para_emitir");
    actualizarOrden(ordenId, {
      costosAdicionales: Number(costosAdicionales || 0),
      motivoAdicional,
      costoFinal: desglose.costoFinal,
      estado:     "listo_para_emitir",
      historial:  [...(orden.historial || []), entrada],
    });
  };

  return {
    isLoading: !orden,
    contexto: {
      patente:       moto?.patente   || "",
      clienteNombre: cliente?.nombre || "",
    },
    desglose,
    costosAdicionales, setCostosAdicionales,
    motivoAdicional,   setMotivoAdicional,
    whatsappEnviado,
    enviarWhatsApp,
    confirmarPago,
  };
}
