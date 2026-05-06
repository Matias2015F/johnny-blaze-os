import React, { useMemo } from "react";
import { ArrowLeft, Calendar } from "lucide-react";
import { LS } from "../lib/storage.js";
import { formatMoney } from "../utils/format.js";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ESTADOS_ACTIVOS = ["diagnostico", "presupuesto", "aprobacion", "reparacion", "finalizada", "listo_para_emitir"];

function calcularHorasEstimadas(orden) {
  return (orden.tareas || []).reduce((s, t) => s + (t.horasBase || 1), 0);
}

export default function AgendaView({ setView }) {
  const ordenes = LS.getAll("trabajos") || [];
  const clientes = LS.getAll("clientes") || [];
  const motos = LS.getAll("motos") || [];

  const hoy = new Date();

  const semana = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(hoy);
      dia.setDate(hoy.getDate() + i);
      return dia;
    });
  }, []);

  const ordenesActivas = useMemo(
    () => ordenes.filter((o) => ESTADOS_ACTIVOS.includes(o.estado)),
    [ordenes]
  );

  const horasPorDia = useMemo(() => {
    return semana.map((dia) => {
      const fechaStr = dia.toISOString().split("T")[0];
      const deEseDia = ordenesActivas.filter(
        (o) => (o.fechaIngreso || "").startsWith(fechaStr)
      );
      const horas = deEseDia.reduce((s, o) => s + calcularHorasEstimadas(o), 0);
      return { dia, horas, ordenes: deEseDia };
    });
  }, [semana, ordenesActivas]);

  const totalHorasComprometidas = ordenesActivas.reduce(
    (s, o) => s + calcularHorasEstimadas(o),
    0
  );

  const colorOcupacion = (horas) => {
    if (horas >= 7) return { bar: "bg-red-500", label: "text-red-400", badge: "bg-red-500/20 text-red-300" };
    if (horas >= 4) return { bar: "bg-yellow-500", label: "text-yellow-400", badge: "bg-yellow-500/20 text-yellow-300" };
    return { bar: "bg-emerald-500", label: "text-emerald-400", badge: "bg-emerald-500/20 text-emerald-300" };
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("home")}
            className="p-3 rounded-2xl bg-slate-900 border border-white/5 active:scale-95"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <h1 className="flex items-center gap-2 text-xl font-black text-white">
            <Calendar size={20} />
            Agenda semanal
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Órdenes activas</p>
            <p className="text-3xl font-black text-blue-400 mt-1">{ordenesActivas.length}</p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Horas comprometidas</p>
            <p className="text-3xl font-black text-yellow-400 mt-1">{totalHorasComprometidas.toFixed(0)}h</p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Esta semana</p>
          {horasPorDia.map(({ dia, horas, ordenes: ords }, i) => {
            const col = colorOcupacion(horas);
            const pct = Math.min((horas / 8) * 100, 100);
            const esHoy = i === 0;
            return (
              <div
                key={i}
                className={`rounded-[1.75rem] border p-4 space-y-2 ${
                  esHoy ? "border-blue-500/30 bg-blue-500/5" : "border-slate-800 bg-slate-900/30"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black ${esHoy ? "text-blue-400" : "text-slate-300"}`}>
                      {DIAS[dia.getDay()]} {dia.getDate()}/{dia.getMonth() + 1}
                    </span>
                    {esHoy && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-black uppercase text-white">
                        Hoy
                      </span>
                    )}
                  </div>
                  <span className={`text-xs font-black ${col.label}`}>{horas.toFixed(1)}h</span>
                </div>
                <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${col.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {ords.length > 0 && (
                  <div className="space-y-1">
                    {ords.map((o) => {
                      const moto = motos.find((m) => m.id === o.bikeId);
                      const cli = clientes.find((c) => c.id === o.clientId);
                      return (
                        <div key={o.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">{moto?.patente || "—"} · {cli?.nombre || "—"}</span>
                          <span className="text-slate-500">{calcularHorasEstimadas(o).toFixed(1)}h</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {ords.length === 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-600">Sin órdenes</span>
                    <button
                      onClick={() => setView("nuevaOrden")}
                      className="text-[10px] font-black text-blue-500 active:scale-90"
                    >
                      + Agregar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {ordenesActivas.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Órdenes activas</p>
            {ordenesActivas.map((o) => {
              const moto = motos.find((m) => m.id === o.bikeId);
              const cli = clientes.find((c) => c.id === o.clientId);
              return (
                <div key={o.id} className="rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-black text-white">{moto?.patente || "—"}</p>
                    <p className="text-xs text-slate-400">{cli?.nombre || "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-slate-300 capitalize">{o.estado}</p>
                    <p className="text-xs text-slate-500">{calcularHorasEstimadas(o).toFixed(1)}h est.</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
