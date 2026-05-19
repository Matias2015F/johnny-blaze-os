import React, { useMemo, useState } from "react";
import { ArrowLeft, FileText, Plus, Search } from "lucide-react";
import { formatMoney } from "../utils/format.js";

const ESTADO_LABEL = {
  borrador:   "Borrador",
  enviado:    "Enviado",
  aprobado:   "Aprobado",
  rechazado:  "Rechazado",
  convertido: "Convertido",
};

const ESTADO_CSS = {
  borrador:   "bg-zinc-700/40 text-zinc-300 border-zinc-600/30",
  enviado:    "bg-blue-500/15 text-blue-300 border-blue-500/30",
  aprobado:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rechazado:  "bg-red-500/15 text-red-300 border-red-500/30",
  convertido: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

export default function PresupuestosView({ presupuestos = [], bikes = [], clients = [], setSelectedPresupuestoId, setView }) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");

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

  const estadosDisponibles = ["todos", "borrador", "enviado", "aprobado", "rechazado", "convertido"];

  return (
    <div className="p-4 pb-28 space-y-4 text-left animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <button onClick={() => setView("home")} className="p-3 bg-zinc-900 rounded-2xl border border-white/5 text-white active:scale-90 transition-all">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-2xl font-black text-white tracking-tighter uppercase flex-1">Presupuestos</h1>
        <button
          onClick={() => setView("nuevoPresupuesto")}
          className="flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
        >
          <Plus size={14} /> Nuevo
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
        <input
          className="w-full rounded-2xl border border-white/5 bg-zinc-900 py-3 pl-9 pr-4 text-sm font-bold text-white outline-none placeholder:text-zinc-600 focus:border-orange-600"
          placeholder="Buscar patente, cliente o número..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {estadosDisponibles.map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`flex-shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 ${
              filtroEstado === e
                ? "border-orange-500 bg-orange-600 text-white"
                : "border-zinc-700 bg-zinc-900 text-zinc-400"
            }`}
          >
            {e === "todos" ? "Todos" : ESTADO_LABEL[e]}
          </button>
        ))}
      </div>

      {lista.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <div className="rounded-3xl bg-zinc-900 p-6">
            <FileText size={32} className="text-zinc-600" />
          </div>
          <p className="text-sm font-black uppercase tracking-widest text-zinc-500">
            {busqueda || filtroEstado !== "todos" ? "Sin resultados" : "No hay presupuestos"}
          </p>
          {!busqueda && filtroEstado === "todos" && (
            <button
              onClick={() => setView("nuevoPresupuesto")}
              className="rounded-2xl bg-orange-600 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
            >
              Crear primer presupuesto
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {lista.map((pres) => {
          const bike = bikes.find((b) => b.id === pres.bikeId);
          const client = clients.find((c) => c.id === pres.clientId);
          const estadoCss = ESTADO_CSS[pres.estado] || ESTADO_CSS.borrador;
          const estadoLabel = ESTADO_LABEL[pres.estado] || pres.estado;
          const fecha = pres.createdAt ? new Date(pres.createdAt).toLocaleDateString("es-AR") : "---";

          return (
            <button
              key={pres.id}
              onClick={() => { setSelectedPresupuestoId(pres.id); setView("detallePresupuesto"); }}
              className="w-full rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 text-left transition-all active:scale-[0.98] space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{pres.numeroPresupuesto || "PRE-??????"}</p>
                  <p className="mt-1 text-sm font-black text-white uppercase truncate">
                    {bike?.patente || "Sin patente"} · {bike?.marca} {bike?.modelo}
                  </p>
                  <p className="text-[10px] font-bold text-zinc-400">{client?.nombre || "Sin cliente"}</p>
                </div>
                <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${estadoCss}`}>
                  {estadoLabel}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-zinc-500">{fecha}</p>
                <p className="text-sm font-black text-orange-400">{formatMoney(pres.total || 0)}</p>
              </div>
              {pres.motivoConsulta && (
                <p className="text-[10px] font-bold text-zinc-500 line-clamp-1">{pres.motivoConsulta}</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
