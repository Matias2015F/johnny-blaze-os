import React, { useState, useMemo } from "react";
import { ArrowLeft, Bell, CheckCircle, MessageCircle } from "lucide-react";
import { LS, useCollection } from "../lib/storage.js";
import { evaluarEstadoRecordatorio, generarMensajeWhatsApp } from "../lib/proximoControl.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { normalizarTelWA } from "../lib/messages.js";
import { abrirEnlaceExterno } from "../lib/whatsappService.js";

const FILTROS = [
  { id: "activos",     label: "Activos" },
  { id: "todos",       label: "Todos" },
  { id: "completados", label: "Listos" },
];

const ESTADO_META = {
  service_vencido: { label: "Vencido",    chip: "bg-red-500/20 text-red-300 border-red-500/30" },
  proximo_service: { label: "Próximo",    chip: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  normal:          { label: "Normal",     chip: "bg-zinc-700 text-zinc-400 border-zinc-600" },
  hecho:           { label: "Completado", chip: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
};

const ORDEN_ESTADO = { service_vencido: 0, proximo_service: 1, normal: 2, hecho: 3 };

export default function RecordatoriosView({ setView, showToast, bikes, clients }) {
  const recordatorios = useCollection("recordatorios");
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const [filtro, setFiltro] = useState("activos");
  const [busqueda, setBusqueda] = useState("");

  const enriched = useMemo(() => {
    return recordatorios
      .map((rec) => {
        const moto = bikes?.find((b) => b.id === rec.motoId);
        const cliente = clients?.find((c) => c.id === rec.clienteId);
        const kmActual = moto?.kilometrajeActual || moto?.km;
        const estadoCalc = rec.estado === "hecho"
          ? "hecho"
          : evaluarEstadoRecordatorio(rec, kmActual);
        return { ...rec, moto, cliente, kmActual: kmActual || 0, estadoCalc };
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
        r.moto?.marca?.toLowerCase().includes(q) ||
        r.moto?.modelo?.toLowerCase().includes(q) ||
        r.cliente?.nombre?.toLowerCase().includes(q) ||
        r.descripcion?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [enriched, filtro, busqueda]);

  const marcarHecho = (id) => {
    LS.updateDoc("recordatorios", id, { estado: "hecho" });
    showToast("Marcado como completado");
  };

  const enviarWhatsApp = (rec) => {
    const msg = generarMensajeWhatsApp(rec.cliente, rec.moto, rec, config);
    const tel = rec.cliente?.whatsapp || rec.cliente?.telefono || rec.cliente?.tel || "";
    abrirEnlaceExterno(`https://wa.me/${normalizarTelWA(tel)}?text=${encodeURIComponent(msg)}`);
    LS.updateDoc("recordatorios", rec.id, { estado: "avisado", enviado: true });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0A] pb-28 animate-in slide-in-from-right duration-300">

      {/* Header */}
      <div className="px-4 pt-6 pb-4 bg-zinc-950 flex items-center gap-3">
        <button
          onClick={() => setView("home")}
          className="p-2.5 rounded-2xl bg-zinc-800 active:scale-95 text-zinc-300 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-xl font-black text-white uppercase tracking-tight">Recordatorios</h1>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
            Próximos controles · Historial
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
        {FILTROS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setFiltro(id)}
            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
              filtro === id ? "bg-orange-600 text-white" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {label}
            <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${
              filtro === id ? "bg-white/20 text-white" : "bg-zinc-700 text-zinc-500"
            }`}>
              {counts[id]}
            </span>
          </button>
        ))}
      </div>

      {/* Buscador */}
      <div className="px-4 pb-4">
        <input
          type="text"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar patente, cliente, tipo de control..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-orange-500/60 transition-all"
        />
      </div>

      {/* Lista */}
      <div className="flex-1 px-4 space-y-3">
        {filtered.length === 0 && (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <Bell size={28} className="mx-auto mb-3 text-zinc-600" />
            <p className="text-sm font-black text-zinc-300">
              {filtro === "activos" ? "Sin recordatorios activos" : "Sin resultados"}
            </p>
            <p className="text-[10px] font-bold text-zinc-600 mt-1 max-w-[220px] mx-auto leading-relaxed">
              Los recordatorios se generan al configurar el próximo control en un trabajo
            </p>
          </div>
        )}

        {filtered.map((rec) => {
          const meta = ESTADO_META[rec.estadoCalc] || ESTADO_META.normal;
          const isActive = rec.estado !== "hecho";

          return (
            <div
              key={rec.id}
              className={`rounded-3xl border p-4 space-y-3 transition-all ${
                isActive
                  ? "border-zinc-700 bg-zinc-900"
                  : "border-zinc-800 bg-zinc-950 opacity-60"
              }`}
            >
              {/* Info principal */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-white uppercase">
                      {rec.moto?.patente || "---"} · {rec.moto?.marca || ""} {rec.moto?.modelo || ""}
                    </p>
                    <span className={`border rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${meta.chip}`}>
                      {meta.label}
                    </span>
                    {rec.testMode && (
                      <span className="border border-purple-500/30 rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-purple-400">
                        Test
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-xs text-zinc-400 font-bold">
                    {rec.cliente?.nombre || "Cliente desconocido"}
                  </p>
                  <p className="mt-1.5 text-[11px] font-black text-zinc-200 uppercase tracking-wide">
                    {rec.descripcion}
                  </p>

                  {rec.kmObjetivo > 0 && (
                    <p className="mt-2 text-[10px] text-zinc-500 font-bold">
                      Km actual:{" "}
                      <span className="text-zinc-300 font-black">
                        {rec.kmActual.toLocaleString("es-AR")}
                      </span>
                      {"  /  "}Objetivo:{" "}
                      <span className="text-zinc-300 font-black">
                        {rec.kmObjetivo.toLocaleString("es-AR")} km
                      </span>
                    </p>
                  )}

                  {rec.fechaObjetivo && (
                    <p className="mt-2 text-[10px] text-zinc-500 font-bold">
                      Fecha objetivo:{" "}
                      <span className="text-zinc-300 font-black">
                        {new Date(rec.fechaObjetivo).toLocaleDateString("es-AR")}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              {/* Acciones */}
              {isActive && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => enviarWhatsApp(rec)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
                  >
                    <MessageCircle size={13} /> WhatsApp
                  </button>
                  <button
                    onClick={() => marcarHecho(rec.id)}
                    className="flex items-center justify-center gap-1.5 rounded-2xl bg-zinc-800 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 active:scale-95 transition-all"
                  >
                    <CheckCircle size={13} /> Listo
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
