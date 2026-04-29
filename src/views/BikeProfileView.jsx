import React, { useState } from "react";
import { ArrowLeft, PlusCircle, ChevronDown, Bell, MessageCircle, X } from "lucide-react";
import { formatMoney } from "../utils/format.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { LS, useCollection } from "../lib/storage.js";
import { evaluarEstadoRecordatorio, generarMensajeWhatsApp } from "../lib/proximoControl.js";

export default function BikeProfileView({ bikeId, orders, bikes, clients, setView, handleStartNewService }) {
  const b = bikes.find((x) => x.id === bikeId);
  const c = clients.find((x) => x.id === b?.clienteId);
  const history = orders
    .filter((o) => o.bikeId === bikeId)
    .sort((a, z) => z.fechaIngreso.localeCompare(a.fechaIngreso));
  const [expandedId, setExpandedId] = useState(null);
  const recordatorios = useCollection("recordatorios");
  const config = LS.getDoc("config", "global") || {};

  const kmActual = b?.kilometrajeActual || b?.km;

  const alertasMoto = (recordatorios || [])
    .filter(r => r.motoId === bikeId && (r.estado === "pendiente" || r.estado === "avisado"))
    .map(r => ({ ...r, estadoAlerta: evaluarEstadoRecordatorio(r, kmActual) }))
    .filter(r => r.estadoAlerta !== "normal")
    .sort((a, b) => (a.estadoAlerta === "service_vencido" ? -1 : 1));

  if (!b) return null;

  return (
    <div className="min-h-screen bg-slate-100 text-left animate-in slide-in-from-right duration-300 pb-32">
      <div className="bg-slate-900 p-8 text-white">
        <button onClick={() => setView("historial")} className="mb-6 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
          <ArrowLeft size={16} /> Historial
        </button>
        <div className="flex justify-between items-start">
          <div className="text-left">
            <h2 className="text-5xl font-black tracking-tighter leading-none mb-2">{b.patente}</h2>
            <p className="text-xs font-bold text-blue-500 uppercase tracking-[0.2em]">{b.marca} {b.modelo}</p>
            <div className="flex gap-4 mt-4">
              <div className="bg-white/10 px-4 py-2 rounded-2xl">
                <p className="text-[8px] font-black uppercase text-slate-400">Cliente</p>
                <p className="text-xs font-black">{c?.nombre || "---"}</p>
              </div>
              <div className="bg-white/10 px-4 py-2 rounded-2xl">
                <p className="text-[8px] font-black uppercase text-slate-400">Km Actual</p>
                <p className="text-xs font-black">{b.km} KM</p>
              </div>
            </div>
          </div>
          <button onClick={() => handleStartNewService(b, c)} className="bg-blue-600 text-white p-4 rounded-3xl shadow-xl active:scale-95 transition-all">
            <PlusCircle size={32} />
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4">

        {/* Alertas de próximo service */}
        {alertasMoto.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] font-black text-yellow-600 uppercase tracking-widest flex items-center gap-2">
              <Bell size={12} /> Próximo control sugerido
            </p>
            {alertasMoto.map(r => (
              <div key={r.id} className={`rounded-[2rem] p-5 border space-y-3 ${r.estadoAlerta === "service_vencido" ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800 uppercase">{r.descripcion}</p>
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg inline-block mt-1 ${r.estadoAlerta === "service_vencido" ? "bg-red-500 text-white" : "bg-yellow-400 text-black"}`}>
                      {r.estadoAlerta === "service_vencido" ? "Vencido" : "Próximo"}
                    </span>
                    {r.testMode && (
                      <span className="bg-purple-500 text-white text-[8px] font-black px-2 py-0.5 rounded ml-1 inline-block uppercase">PRUEBA</span>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      const msg = generarMensajeWhatsApp(c, b, r, config);
                      const tel = c?.whatsapp || c?.telefono || c?.tel || "";
                      window.open(`https://wa.me/${tel.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`, "_blank");
                      LS.updateDoc("recordatorios", r.id, { estado: "avisado", enviado: true });
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-2xl font-black text-[9px] uppercase flex items-center gap-1 active:scale-95 flex-shrink-0"
                  >
                    <MessageCircle size={12} /> WhatsApp
                  </button>
                </div>
                {r.kmObjetivo != null && (
                  <div className="bg-white/60 rounded-xl p-3 space-y-1">
                    <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                      <span>Km actual</span><span>{(kmActual || 0).toLocaleString("es-AR")} km</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase">
                      <span>Avisar desde</span><span>{(r.kmAviso || 0).toLocaleString("es-AR")} km</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-black text-slate-700 uppercase border-t border-slate-200 pt-1 mt-1">
                      <span>Objetivo</span><span>{(r.kmObjetivo || 0).toLocaleString("es-AR")} km</span>
                    </div>
                  </div>
                )}
                {r.fechaObjetivo && !r.kmObjetivo && (
                  <p className="text-[9px] font-bold text-slate-500">Fecha objetivo: {r.fechaObjetivo}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => LS.updateDoc("recordatorios", r.id, { estado: "hecho" })}
                    className="flex-1 py-2.5 rounded-xl bg-slate-200 text-slate-700 text-[9px] font-black uppercase active:scale-95"
                  >
                    Marcar hecho
                  </button>
                  {r.testMode && (
                    <button
                      onClick={() => LS.deleteDoc("recordatorios", r.id)}
                      className="py-2.5 px-3 rounded-xl bg-red-100 text-red-500 text-[9px] font-black uppercase active:scale-95 flex items-center gap-1"
                    >
                      <X size={12} /> Eliminar prueba
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest px-2">Historial de Servicios</h3>
        {history.length === 0 && (
          <p className="text-center py-10 text-slate-400 font-bold uppercase text-[10px]">Sin servicios registrados</p>
        )}
        {history.map((order) => {
          const isExpanded = expandedId === order.id;
          const totalOrden = calcularResultadosOrden(order).total;
          return (
            <div key={order.id} className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
              <div onClick={() => setExpandedId(isExpanded ? null : order.id)} className="p-6 flex justify-between items-center cursor-pointer active:bg-slate-50">
                <div className="text-left">
                  <p className="text-xs font-black text-slate-400 uppercase mb-1 tracking-widest">{order.fechaIngreso}</p>
                  <p className="text-xl font-black text-black leading-none">{formatMoney(totalOrden)}</p>
                  <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase">Kilometraje: {order.km} km</p>
                </div>
                <div className={`transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}>
                  <ChevronDown size={24} className="text-slate-300" />
                </div>
              </div>
              {isExpanded && (
                <div className="px-6 pb-6 pt-2 border-t border-slate-50 space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-3">
                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Trabajos realizados y repuestos</p>
                    <div className="space-y-1">
                      {order.tareas?.map((t, i) => (
                        <div key={i} className="text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {t.nombre}
                        </div>
                      ))}
                      {order.repuestos?.map((r, i) => (
                        <div key={i} className="text-xs font-bold text-blue-700 uppercase flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> <span className="truncate">{r.nombre} ({r.cantidad || 1}x)</span>
                          </div>
                          <span className="text-[10px] text-blue-500 flex-shrink-0">{formatMoney((r.monto || 0) * (r.cantidad || 1))}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {(order.repuestos?.length > 0 || order.insumos?.length > 0) && (
                    <div className="space-y-3">
                      {order.repuestos?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Historial de repuestos</p>
                          {order.repuestos.map((r, i) => (
                            <div key={i} className="bg-blue-50 p-3 rounded-2xl border border-blue-100 text-xs">
                              <div className="flex justify-between gap-3">
                                <span className="font-black text-blue-900 uppercase">{r.nombre}</span>
                                <span className="font-black text-blue-600">{formatMoney(r.monto || 0)}</span>
                              </div>
                              <div className="flex justify-between gap-3 mt-1 text-[10px] font-bold text-blue-500 uppercase">
                                <span>Cantidad: {r.cantidad || 1}</span>
                                <span>Unitario: {formatMoney(r.monto || 0)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {order.insumos?.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Historial de gastos e insumos</p>
                          {order.insumos.map((ins, i) => (
                            <div key={i} className="bg-orange-50 p-3 rounded-2xl border border-orange-100 text-xs">
                              <div className="flex justify-between gap-3">
                                <span className="font-black text-orange-900 uppercase">{ins.nombre}</span>
                                <span className="font-black text-orange-600">{formatMoney((ins.monto || 0) * (ins.cantidad || 1))}</span>
                              </div>
                              <div className="flex justify-between gap-3 mt-1 text-[10px] font-bold text-orange-500 uppercase">
                                <span>Cantidad: {ins.cantidad || 1}</span>
                                <span>Unitario: {formatMoney(ins.monto || 0)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {order.diagnostico && (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="text-[8px] font-black uppercase text-slate-400 mb-1">Diagnóstico</p>
                      <p className="text-xs font-bold italic text-slate-600">"{order.diagnostico}"</p>
                    </div>
                  )}
                  {order.observacionesProxima && (
                    <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                      <p className="text-[8px] font-black uppercase text-blue-400 mb-1">Notas para la próxima visita</p>
                      <p className="text-xs font-bold italic text-blue-900">"{order.observacionesProxima}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
