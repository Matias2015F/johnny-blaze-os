import React from "react";
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Plus, MessageCircle, Clock, Bike,
  Trash2, Pencil, CheckCircle2, X,
} from "lucide-react";
import { useAgendaView, STATUS_TOKEN } from "../hooks/useAgendaView.js";

// ── Constantes de display ─────────────────────────────────────────────────────

const WEEK_DAYS = ["D", "L", "M", "M", "J", "V", "S"];

const STATUS_OPTIONS = [
  { value: "pendiente",  label: "Pendiente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "reprogramar",label: "Reprogramar" },
  { value: "suspendido", label: "Suspendido" },
  { value: "asistio",    label: "Asistió" },
  { value: "no_asistio", label: "No asistió" },
];

// Token semántico → clase CSS (lógica de presentación, queda en la vista)
const VARIANT_CHIP = {
  success:        "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  warning:        "bg-orange-500/15 text-orange-300 border-orange-500/30",
  danger:         "bg-rose-500/15 text-rose-300 border-rose-500/30",
  success_strong: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  muted:          "bg-zinc-700 text-zinc-300 border-zinc-600",
  pending:        "bg-yellow-500/15 text-yellow-300 border-yellow-500/30",
};

// Side effect de audio — pertenece a la vista (no tiene lógica de negocio)
function playReminderSound() {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  const ctx = new AudioContextClass();
  [880, 660, 880].forEach((frequency, index) => {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequency;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + index * 0.22;
    const end   = start + 0.16;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.18,  start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.start(start);
    osc.stop(end + 0.03);
  });
  setTimeout(() => ctx.close().catch(() => {}), 1200);
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function AgendaView({ setView }) {
  const {
    clients, filteredBikes,
    dayAppointments, stats,
    currentMonth, calendarMeta,
    selectedDate, selectedDateStr,
    isToday, isSelected, hasAppointment,
    prevMonth, nextMonth, selectDay,
    isModalOpen, openModal, closeModal,
    editingId, clientMode, setClientMode,
    formData, setFormData,
    reminderMenuId, setReminderMenuId,
    handleClientChange, handleBikeChange,
    submitAppointment,
    deleteAppointment,
    updateEstado,
    sendWhatsApp,
    getStatusToken,
  } = useAgendaView();

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">

        <div className="flex items-center gap-3">
          <button onClick={() => setView("home")} className="rounded-2xl border border-white/5 bg-zinc-900 p-3 active:scale-95">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-black text-white">
              <Clock size={20} /> Agenda del taller
            </h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              Turnos, confirmaciones y recordatorios previos
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[1.75rem] border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Turnos</p>
            <p className="mt-1 text-3xl font-black text-orange-400">{stats.total}</p>
          </div>
          <div className="rounded-[1.75rem] border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Confirmados</p>
            <p className="mt-1 text-3xl font-black text-emerald-400">{stats.confirmados}</p>
          </div>
          <div className="rounded-[1.75rem] border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Avisos</p>
            <p className="mt-1 text-3xl font-black text-yellow-400">{stats.recordatorios}</p>
          </div>
        </div>

        {/* Calendario */}
        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/50 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button onClick={prevMonth} className="rounded-full p-2 text-zinc-300 hover:bg-zinc-800 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <p className="text-sm font-black capitalize text-white">{calendarMeta.monthLabel}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Calendario de citas</p>
            </div>
            <button onClick={nextMonth} className="rounded-full p-2 text-zinc-300 hover:bg-zinc-800 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEK_DAYS.map((d, i) => (
              <div key={`${d}-${i}`} className="py-1 text-center text-[10px] font-black text-zinc-500">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {[...Array(calendarMeta.startDay)].map((_, i) => <div key={`e-${i}`} />)}
            {[...Array(calendarMeta.daysInMonth)].map((_, i) => {
              const day = i + 1;
              return (
                <button
                  key={`d-${day}`}
                  onClick={() => selectDay(day)}
                  className={`relative aspect-square rounded-2xl text-sm font-black transition-all ${
                    isSelected(day)
                      ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
                      : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                  } ${isToday(day) && !isSelected(day) ? "border border-orange-500/40 text-orange-300" : ""}`}
                >
                  <span>{day}</span>
                  {hasAppointment(day) && (
                    <span className={`absolute bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isSelected(day) ? "bg-white" : "bg-orange-500"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Turnos del día */}
        <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/40 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Turnos del día</p>
              <p className="mt-1 text-base font-black text-white">
                {selectedDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
            >
              <Plus size={16} /> Nuevo turno
            </button>
          </div>

          {dayAppointments.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-zinc-700 px-5 py-10 text-center">
              <Clock className="mx-auto mb-3 text-zinc-700" size={34} />
              <p className="text-sm font-black text-zinc-400">No hay turnos cargados para este día</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-zinc-600">
                Podés elegir cliente del historial o agregar uno manualmente
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {dayAppointments.map((apt) => {
                const { label, variant } = getStatusToken(apt.estado);
                return (
                  <div key={apt.id} className="rounded-[1.75rem] border border-zinc-800 bg-zinc-950/90 p-4 shadow-xl">
                    <div className="flex items-start gap-4">
                      <div className="min-w-[58px] pt-1 text-lg font-black text-orange-400">{apt.hora || "--:--"}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-black text-white">{apt.clienteNombre}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-black text-zinc-400">
                              <span className="flex items-center gap-1"><Bike size={13} /> {apt.motoPatente || "Sin patente"}</span>
                              <span>{apt.motoMarca || "Moto"} {apt.motoModelo || ""}</span>
                            </div>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${VARIANT_CHIP[variant]}`}>
                            {label}
                          </span>
                        </div>

                        {apt.motivo && (
                          <p className="mt-3 rounded-2xl bg-zinc-900 px-3 py-3 text-[11px] font-bold text-zinc-300">{apt.motivo}</p>
                        )}

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            onClick={() => sendWhatsApp(apt, "confirm")}
                            className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-200 active:scale-95"
                          >
                            <CheckCircle2 size={14} /> Consultar si asiste
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => sendWhatsApp(apt, "day_before")}
                              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-200 active:scale-95"
                            >
                              <MessageCircle size={14} /> 24H
                            </button>
                            <button
                              onClick={() => {
                                playReminderSound();
                                setReminderMenuId((prev) => prev === apt.id ? null : apt.id);
                              }}
                              className="flex items-center justify-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-orange-200 active:scale-95"
                            >
                              <Clock size={14} /> 1H
                            </button>
                          </div>
                        </div>

                        {reminderMenuId === apt.id && (
                          <div className="mt-3 grid grid-cols-1 gap-2 rounded-2xl border border-orange-500/15 bg-zinc-900 p-3 sm:grid-cols-3">
                            <button onClick={playReminderSound} className="rounded-2xl bg-zinc-800 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-200 active:scale-95">
                              Hacer sonar aviso
                            </button>
                            <button onClick={() => sendWhatsApp(apt, "hour_before")} className="rounded-2xl bg-orange-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95">
                              Avisar al cliente
                            </button>
                            <button onClick={() => sendWhatsApp(apt, "hour_before_confirm")} className="rounded-2xl bg-emerald-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95">
                              Preguntar si viene
                            </button>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <button onClick={() => updateEstado(apt.id, "confirmado")} className="rounded-2xl bg-emerald-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95">Confirmó</button>
                          <button onClick={() => updateEstado(apt.id, "reprogramar")} className="rounded-2xl bg-orange-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95">Reprogramar</button>
                          <button onClick={() => openModal(apt)} className="rounded-2xl bg-zinc-800 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-200 active:scale-95"><Pencil size={14} className="inline mr-1" />Editar</button>
                          <button onClick={() => deleteAppointment(apt.id)} className="rounded-2xl bg-rose-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"><Trash2 size={14} className="inline mr-1" />Eliminar</button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={() => openModal()}
        className="fixed bottom-8 right-6 z-30 flex items-center gap-2 rounded-2xl bg-orange-600 px-4 py-4 text-white shadow-2xl shadow-orange-600/20 active:scale-95"
      >
        <Plus size={22} strokeWidth={3} />
        <span className="text-[11px] font-black uppercase tracking-widest">Nuevo turno</span>
      </button>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-[2rem] bg-[#111827] shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">
                  {editingId ? "Editar turno" : "Agendar turno"}
                </p>
                <p className="mt-1 text-base font-black text-white">Calendario conectado al historial</p>
              </div>
              <button onClick={closeModal} className="rounded-2xl bg-zinc-900 p-3 text-zinc-300 active:scale-95">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitAppointment} className="max-h-[78vh] space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setClientMode("historial")} className={`rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest ${clientMode === "historial" ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>Desde historial</button>
                <button type="button" onClick={() => setClientMode("manual")}    className={`rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest ${clientMode === "manual"    ? "bg-orange-600 text-white" : "bg-zinc-900 text-zinc-400"}`}>Agregar cliente</button>
              </div>

              {clientMode === "historial" ? (
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Cliente</span>
                    <select value={formData.clientId} onChange={(e) => handleClientChange(e.target.value)} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none">
                      <option value="">Elegí cliente</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Moto</span>
                    <select value={formData.bikeId} onChange={(e) => handleBikeChange(e.target.value)} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none">
                      <option value="">{filteredBikes.length === 1 ? "Moto autoseleccionada" : "Elegí moto"}</option>
                      {filteredBikes.map((b) => <option key={b.id} value={b.id}>{b.patente} · {b.marca} {b.modelo}</option>)}
                    </select>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nombre cliente</span>
                    <input value={formData.clienteNombre} onChange={(e) => setFormData((p) => ({ ...p, clienteNombre: e.target.value }))} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-zinc-600" placeholder="Juan Pérez" />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">WhatsApp</span>
                    <input value={formData.telefono} onChange={(e) => setFormData((p) => ({ ...p, telefono: e.target.value }))} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-zinc-600" placeholder="549343..." />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Patente</span>
                      <input value={formData.motoPatente} onChange={(e) => setFormData((p) => ({ ...p, motoPatente: e.target.value }))} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-zinc-600" placeholder="ABC123" />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Marca / modelo</span>
                      <input value={formData.motoMarca} onChange={(e) => setFormData((p) => ({ ...p, motoMarca: e.target.value }))} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-zinc-600" placeholder="Honda Wave" />
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Fecha</span>
                  <input type="date" value={formData.fecha} onChange={(e) => setFormData((p) => ({ ...p, fecha: e.target.value }))} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none" />
                </label>
                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hora</span>
                  <input type="time" value={formData.hora} onChange={(e) => setFormData((p) => ({ ...p, hora: e.target.value }))} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Motivo</span>
                <input value={formData.motivo} onChange={(e) => setFormData((p) => ({ ...p, motivo: e.target.value }))} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-zinc-600" placeholder="Ej: service, diagnóstico, control" />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Estado</span>
                <select value={formData.estado} onChange={(e) => setFormData((p) => ({ ...p, estado: e.target.value }))} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none">
                  {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Observaciones</span>
                <textarea value={formData.observaciones} onChange={(e) => setFormData((p) => ({ ...p, observaciones: e.target.value }))} rows={3} className="w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-zinc-600" placeholder="Notas para la secretaria, pedido del cliente, contexto del turno..." />
              </label>

              <div className="rounded-2xl bg-zinc-900 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Avisos previos</p>
                <label className="flex items-center justify-between gap-3 text-sm font-black text-white">
                  <span>Recordatorio un día antes</span>
                  <input type="checkbox" checked={formData.reminderDayBefore} onChange={(e) => setFormData((p) => ({ ...p, reminderDayBefore: e.target.checked }))} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm font-black text-white">
                  <span>Recordatorio una hora antes</span>
                  <input type="checkbox" checked={formData.reminderHourBefore} onChange={(e) => setFormData((p) => ({ ...p, reminderHourBefore: e.target.checked }))} />
                </label>
              </div>

              <button type="submit" className="w-full rounded-2xl bg-orange-600 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-orange-600/20 active:scale-95">
                {editingId ? "Guardar cambios" : "Confirmar turno"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
