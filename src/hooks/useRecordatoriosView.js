import { useMemo, useState } from "react";
import { LS, useCollection } from "../lib/storage.js";
import { evaluarEstadoRecordatorio, generarMensajeWhatsApp } from "../lib/proximoControl.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { normalizarTelWA } from "../lib/messages.js";
import { abrirEnlaceExterno } from "../lib/whatsappService.js";

const ORDEN_ESTADO = { service_vencido: 0, proximo_service: 1, normal: 2, hecho: 3 };

// Tokens semánticos — la vista los mapea a CSS
export const ESTADO_TOKEN = {
  service_vencido: { label: "Vencido",    variant: "error" },
  proximo_service: { label: "Próximo",    variant: "warning" },
  normal:          { label: "Normal",     variant: "muted" },
  hecho:           { label: "Completado", variant: "success" },
};

export function useRecordatoriosView({ bikes, clients }) {
  const recordatorios = useCollection("recordatorios");
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;

  const [filtro, setFiltro] = useState("activos");
  const [busqueda, setBusqueda] = useState("");

  const enriched = useMemo(() => {
    return recordatorios
      .map((rec) => {
        const moto    = bikes?.find((b) => b.id === rec.motoId);
        const cliente = clients?.find((c) => c.id === rec.clienteId);
        const kmActual = moto?.kilometrajeActual || moto?.km;
        const estadoCalc = rec.estado === "hecho"
          ? "hecho"
          : evaluarEstadoRecordatorio(rec, kmActual);
        const estadoMeta = ESTADO_TOKEN[estadoCalc] || ESTADO_TOKEN.normal;
        return { ...rec, moto, cliente, kmActual: kmActual || 0, estadoCalc, estadoMeta };
      })
      .sort((a, b) =>
        (ORDEN_ESTADO[a.estadoCalc] ?? 4) - (ORDEN_ESTADO[b.estadoCalc] ?? 4) ||
        (b.createdAt || 0) - (a.createdAt || 0)
      );
  }, [recordatorios, bikes, clients]);

  const counts = useMemo(() => ({
    activos:     enriched.filter((r) => r.estado !== "hecho").length,
    todos:       enriched.length,
    completados: enriched.filter((r) => r.estado === "hecho").length,
  }), [enriched]);

  const filtered = useMemo(() => {
    let list = enriched;
    if (filtro === "activos")     list = list.filter((r) => r.estado !== "hecho");
    if (filtro === "completados") list = list.filter((r) => r.estado === "hecho");
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      list = list.filter((r) =>
        r.moto?.patente?.toLowerCase().includes(q) ||
        r.moto?.marca?.toLowerCase().includes(q)   ||
        r.moto?.modelo?.toLowerCase().includes(q)  ||
        r.cliente?.nombre?.toLowerCase().includes(q) ||
        r.descripcion?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [enriched, filtro, busqueda]);

  const marcarHecho = (id) => {
    LS.updateDoc("recordatorios", id, { estado: "hecho" });
  };

  const enviarWhatsApp = (rec) => {
    const msg = generarMensajeWhatsApp(rec.cliente, rec.moto, rec, config);
    const tel = rec.cliente?.whatsapp || rec.cliente?.telefono || rec.cliente?.tel || "";
    abrirEnlaceExterno(`https://wa.me/${normalizarTelWA(tel)}?text=${encodeURIComponent(msg)}`);
    LS.updateDoc("recordatorios", rec.id, { estado: "avisado", enviado: true });
  };

  return {
    filtered,
    counts,
    filtro,  setFiltro,
    busqueda, setBusqueda,
    marcarHecho,
    enviarWhatsApp,
  };
}
