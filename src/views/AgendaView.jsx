import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  MessageCircle,
  Clock,
  Bike,
  Trash2,
  Pencil,
  Calendar as CalendarIcon,
  CheckCircle2,
  X,
} from "lucide-react";
import { LS, useCollection, generateId } from "../lib/storage.js";
import { abrirEnlaceExterno } from "../lib/whatsappService.js";

const WEEK_DAYS = ["D", "L", "M", "M", "J", "V", "S"];
const STATUS_OPTIONS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "confirmado", label: "Confirmado" },
  { value: "reprogramar", label: "Reprogramar" },
  { value: "suspendido", label: "Suspendido" },
  { value: "asistio", label: "Asistió" },
  { value: "no_asistio", label: "No asistió" },
];

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStatusMeta(status) {
  switch (status) {
    case "confirmado":
      return { label: "Confirmado", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
    case "reprogramar":
      return { label: "Reprogramar", chip: "bg-blue-500/15 text-blue-300 border-blue-500/30" };
    case "suspendido":
      return { label: "Suspendido", chip: "bg-rose-500/15 text-rose-300 border-rose-500/30" };
    case "asistio":
      return { label: "Asistió", chip: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" };
    case "no_asistio":
      return { label: "No asistió", chip: "bg-slate-700 text-slate-300 border-slate-600" };
    default:
      return { label: "Pendiente", chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" };
  }
}

function buildWhatsappMessage(appointment, type) {
  const cliente = appointment.clienteNombre || "cliente";
  const fecha = appointment.fecha;
  const hora = appointment.hora || "--:--";
  const moto = appointment.motoPatente || appointment.motoMarca || "moto";

  if (type === "confirm") {
    return `Hola ${cliente}, te escribo para confirmar tu turno del ${fecha} a las ${hora} por ${moto}. ¿Vas a asistir, reprogramar o suspender?`;
  }
  if (type === "day_before") {
    return `Hola ${cliente}, mañana ${fecha} a las ${hora} tenés tu turno por ${moto}. ¿Vas a asistir al turno o necesitás reprogramarlo?`;
  }
  if (type === "hour_before_confirm") {
    return `Hola ${cliente}, falta una hora para tu turno de hoy a las ${hora} por ${moto}. ¿Seguís en camino o querés avisarnos un cambio?`;
  }
  return `Hola ${cliente}, falta una hora para tu turno de hoy a las ${hora} por ${moto}. Te esperamos en el taller.`;
}

function playReminderSound() {
  if (typeof window === "undefined") return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const pattern = [880, 660, 880];
  pattern.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + index * 0.22;
    const end = start + 0.16;
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.start(start);
    oscillator.stop(end + 0.03);
  });
  setTimeout(() => ctx.close().catch(() => {}), 1200);
}

export default function AgendaView({ setView }) {
  const clients = useCollection("clientes");
  const bikes = useCollection("motos");
  const appointments = useCollection("agendaTurnos");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [clientMode, setClientMode] = useState("historial");
  const [reminderMenuId, setReminderMenuId] = useState(null);
  const [formData, setFormData] = useState({
    clientId: "",
    bikeId: "",
    clienteNombre: "",
    telefono: "",
    motoPatente: "",
    motoMarca: "",
    motoModelo: "",
    fecha: formatDateKey(new Date()),
    hora: "09:00",
    motivo: "",
    estado: "pendiente",
    observaciones: "",
    reminderDayBefore: true,
    reminderHourBefore: true,
  });

  const daysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const startDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  const selectedDateStr = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  const dayAppointments = useMemo(() => {
    return appointments
      .filter((apt) => apt.fecha === selectedDateStr)
      .sort((a, b) => (a.hora || "").localeCompare(b.hora || ""));
  }, [appointments, selectedDateStr]);

  const stats = useMemo(() => {
    return appointments.reduce(
      (acc, apt) => {
        acc.total += 1;
        if (apt.estado === "confirmado") acc.confirmados += 1;
        if (apt.reminderDayBefore || apt.reminderHourBefore) acc.recordatorios += 1;
        return acc;
      },
      { total: 0, confirmados: 0, recordatorios: 0 }
    );
  }, [appointments]);

  const filteredBikes = useMemo(() => {
    if (!formData.clientId) return bikes;
    return bikes.filter((bike) => bike.clienteId === formData.clientId);
  }, [bikes, formData.clientId]);

  const handlePrevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && currentMonth.getMonth() === today.getMonth() && currentMonth.getFullYear() === today.getFullYear();
  };

  const isSelected = (day) => {
    return day === selectedDate.getDate() && currentMonth.getMonth() === selectedDate.getMonth() && currentMonth.getFullYear() === selectedDate.getFullYear();
  };

  const hasAppointment = (day) => {
    const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return appointments.some((apt) => apt.fecha === dateStr);
  };

  const resetForm = (dateValue) => ({
    clientId: "",
    bikeId: "",
    clienteNombre: "",
    telefono: "",
    motoPatente: "",
    motoMarca: "",
    motoModelo: "",
    fecha: dateValue,
    hora: "09:00",
    motivo: "",
    estado: "pendiente",
    observaciones: "",
    reminderDayBefore: true,
    reminderHourBefore: true,
  });

  const openModal = (appointment = null) => {
    if (appointment) {
      setEditingId(appointment.id);
      setClientMode(appointment.clientId || appointment.bikeId ? "historial" : "manual");
      setFormData({
        clientId: appointment.clientId || "",
        bikeId: appointment.bikeId || "",
        clienteNombre: appointment.clienteNombre || "",
        telefono: appointment.telefono || "",
        motoPatente: appointment.motoPatente || "",
        motoMarca: appointment.motoMarca || "",
        motoModelo: appointment.motoModelo || "",
        fecha: appointment.fecha || selectedDateStr,
        hora: appointment.hora || "09:00",
        motivo: appointment.motivo || "",
        estado: appointment.estado || "pendiente",
        observaciones: appointment.observaciones || "",
        reminderDayBefore: appointment.reminderDayBefore !== false,
        reminderHourBefore: appointment.reminderHourBefore !== false,
      });
    } else {
      setEditingId(null);
      setClientMode("historial");
      setFormData(resetForm(selectedDateStr));
    }
    setIsModalOpen(true);
  };

  const handleClientChange = (clientId) => {
    const client = clients.find((item) => item.id === clientId);
    const clientBikes = bikes.filter((bike) => bike.clienteId === clientId);
    const bike = clientBikes.length === 1 ? clientBikes[0] : null;
    setFormData((prev) => ({
      ...prev,
      clientId,
      bikeId: bike?.id || "",
      clienteNombre: client?.nombre || prev.clienteNombre,
      telefono: client?.telefono || client?.tel || prev.telefono,
      motoPatente: bike?.patente || "",
      motoMarca: bike?.marca || "",
      motoModelo: bike?.modelo || "",
    }));
  };

  const handleBikeChange = (bikeId) => {
    const bike = bikes.find((item) => item.id === bikeId);
    setFormData((prev) => ({
      ...prev,
      bikeId,
      motoPatente: bike?.patente || prev.motoPatente,
      motoMarca: bike?.marca || prev.motoMarca,
      motoModelo: bike?.modelo || prev.motoModelo,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const client = clients.find((item) => item.id === formData.clientId);
    const bike = bikes.find((item) => item.id === formData.bikeId);

    const payload = {
      clientId: formData.clientId || null,
      bikeId: formData.bikeId || null,
      clienteNombre: client?.nombre || formData.clienteNombre || "Cliente sin nombre",
      telefono: client?.telefono || client?.tel || formData.telefono || "",
      motoPatente: bike?.patente || formData.motoPatente || "Sin patente",
      motoMarca: bike?.marca || formData.motoMarca || "",
      motoModelo: bike?.modelo || formData.motoModelo || "",
      fecha: formData.fecha,
      hora: formData.hora,
      motivo: formData.motivo || "Turno de taller",
      estado: formData.estado,
      observaciones: formData.observaciones || "",
      reminderDayBefore: !!formData.reminderDayBefore,
      reminderHourBefore: !!formData.reminderHourBefore,
      updatedAt: Date.now(),
    };

    if (editingId) {
      LS.updateDoc("agendaTurnos", editingId, payload);
    } else {
      LS.setDoc("agendaTurnos", generateId(), { ...payload, createdAt: Date.now() });
    }

    setIsModalOpen(false);
    setEditingId(null);
    setFormData(resetForm(formData.fecha));
  };

  const deleteAppointment = (id) => {
    LS.deleteDoc("agendaTurnos", id);
  };

  const sendWhatsApp = (appointment, type) => {
    const telefono = String(appointment.telefono || "").replace(/\D/g, "");
    if (!telefono) return;
    const message = buildWhatsappMessage(appointment, type);
    abrirEnlaceExterno(`https://wa.me/${telefono}?text=${encodeURIComponent(message)}`);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setView("home")} className="rounded-2xl border border-white/5 bg-slate-900 p-3 active:scale-95">
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-black text-white">
              <Clock size={20} />
              Agenda del taller
            </h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Turnos, confirmaciones y recordatorios previos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Turnos</p>
            <p className="mt-1 text-3xl font-black text-blue-400">{stats.total}</p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Confirmados</p>
            <p className="mt-1 text-3xl font-black text-emerald-400">{stats.confirmados}</p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Avisos</p>
            <p className="mt-1 text-3xl font-black text-yellow-400">{stats.recordatorios}</p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/50 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <button onClick={handlePrevMonth} className="rounded-full p-2 text-slate-300 hover:bg-slate-800 transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="text-center">
              <p className="text-sm font-black capitalize text-white">
                {currentMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
              </p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Calendario de citas</p>
            </div>
            <button onClick={handleNextMonth} className="rounded-full p-2 text-slate-300 hover:bg-slate-800 transition-colors">
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {WEEK_DAYS.map((day, index) => (
              <div key={`${day}-${index}`} className="py-1 text-center text-[10px] font-black text-slate-500">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {[...Array(startDayOfMonth(currentMonth))].map((_, index) => (
              <div key={`empty-${index}`} />
            ))}
            {[...Array(daysInMonth(currentMonth))].map((_, index) => {
              const day = index + 1;
              return (
                <button
                  key={`day-${day}`}
                  onClick={() => setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day))}
                  className={`relative aspect-square rounded-2xl text-sm font-black transition-all ${
                    isSelected(day)
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                      : "bg-slate-950 text-slate-300 hover:bg-slate-800"
                  } ${isToday(day) && !isSelected(day) ? "border border-blue-500/40 text-blue-300" : ""}`}
                >
                  <span>{day}</span>
                  {hasAppointment(day) && (
                    <span className={`absolute bottom-2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full ${isSelected(day) ? "bg-white" : "bg-blue-500"}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[2rem] border border-slate-800 bg-slate-900/40 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Turnos del día</p>
              <p className="mt-1 text-base font-black text-white">
                {selectedDate.toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
              </p>
            </div>
            <button
              onClick={() => openModal()}
              className="flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
            >
              <Plus size={16} /> Nuevo turno
            </button>
          </div>

          {dayAppointments.length === 0 ? (
            <div className="rounded-[1.75rem] border border-dashed border-slate-700 px-5 py-10 text-center">
              <Clock className="mx-auto mb-3 text-slate-700" size={34} />
              <p className="text-sm font-black text-slate-400">No hay turnos cargados para este día</p>
              <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-600">
                Podés elegir cliente del historial o agregar uno manualmente
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {dayAppointments.map((appointment) => {
                const status = getStatusMeta(appointment.estado);
                return (
                  <div key={appointment.id} className="rounded-[1.75rem] border border-slate-800 bg-slate-950/90 p-4 shadow-xl">
                    <div className="flex items-start gap-4">
                      <div className="min-w-[58px] pt-1 text-lg font-black text-blue-400">
                        {appointment.hora || "--:--"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-black text-white">{appointment.clienteNombre}</h3>
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-black text-slate-400">
                              <span className="flex items-center gap-1"><Bike size={13} /> {appointment.motoPatente || "Sin patente"}</span>
                              <span>{appointment.motoMarca || "Moto"} {appointment.motoModelo || ""}</span>
                            </div>
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${status.chip}`}>
                            {status.label}
                          </span>
                        </div>

                        {appointment.motivo && (
                          <p className="mt-3 rounded-2xl bg-slate-900 px-3 py-3 text-[11px] font-bold text-slate-300">
                            {appointment.motivo}
                          </p>
                        )}

                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            onClick={() => sendWhatsApp(appointment, "confirm")}
                            className="flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-200 active:scale-95"
                          >
                            <CheckCircle2 size={14} /> Consultar si asiste
                          </button>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => sendWhatsApp(appointment, "day_before")}
                              className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-200 active:scale-95"
                            >
                              <MessageCircle size={14} /> 24H
                            </button>
                            <button
                              onClick={() => {
                                playReminderSound();
                                setReminderMenuId((prev) => (prev === appointment.id ? null : appointment.id));
                              }}
                              className="flex items-center justify-center gap-2 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-blue-200 active:scale-95"
                            >
                              <Clock size={14} /> 1H
                            </button>
                          </div>
                        </div>

                        {reminderMenuId === appointment.id && (
                          <div className="mt-3 grid grid-cols-1 gap-2 rounded-2xl border border-blue-500/15 bg-slate-900 p-3 sm:grid-cols-3">
                            <button
                              onClick={() => playReminderSound()}
                              className="rounded-2xl bg-slate-800 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-200 active:scale-95"
                            >
                              Hacer sonar aviso
                            </button>
                            <button
                              onClick={() => sendWhatsApp(appointment, "hour_before")}
                              className="rounded-2xl bg-blue-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
                            >
                              Avisar al cliente
                            </button>
                            <button
                              onClick={() => sendWhatsApp(appointment, "hour_before_confirm")}
                              className="rounded-2xl bg-emerald-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
                            >
                              Preguntar si viene
                            </button>
                          </div>
                        )}

                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <button onClick={() => LS.updateDoc("agendaTurnos", appointment.id, { estado: "confirmado", updatedAt: Date.now() })} className="rounded-2xl bg-emerald-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95">Confirmó</button>
                          <button onClick={() => LS.updateDoc("agendaTurnos", appointment.id, { estado: "reprogramar", updatedAt: Date.now() })} className="rounded-2xl bg-blue-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95">Reprogramar</button>
                          <button onClick={() => openModal(appointment)} className="rounded-2xl bg-slate-800 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-200 active:scale-95"><Pencil size={14} className="inline mr-1" />Editar</button>
                          <button onClick={() => deleteAppointment(appointment.id)} className="rounded-2xl bg-rose-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"><Trash2 size={14} className="inline mr-1" />Eliminar</button>
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

      <button
        onClick={() => openModal()}
        className="fixed bottom-8 right-6 z-30 flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-4 text-white shadow-2xl shadow-blue-600/20 active:scale-90"
      >
        <Plus size={22} strokeWidth={3} />
        <span className="text-[11px] font-black uppercase tracking-widest">Nuevo turno</span>
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-[2rem] bg-[#111827] shadow-2xl sm:rounded-[2rem]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">
                  {editingId ? "Editar turno" : "Agendar turno"}
                </p>
                <p className="mt-1 text-base font-black text-white">Calendario conectado al historial</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="rounded-2xl bg-slate-900 p-3 text-slate-300 active:scale-95">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="max-h-[78vh] space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setClientMode("historial")} className={`rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest ${clientMode === "historial" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"}`}>
                  Desde historial
                </button>
                <button type="button" onClick={() => setClientMode("manual")} className={`rounded-2xl py-3 text-[10px] font-black uppercase tracking-widest ${clientMode === "manual" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"}`}>
                  Agregar cliente
                </button>
              </div>

              {clientMode === "historial" ? (
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cliente</span>
                    <select value={formData.clientId} onChange={(e) => handleClientChange(e.target.value)} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none">
                      <option value="">Elegí cliente</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>{client.nombre}</option>
                      ))}
                    </select>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Moto</span>
                    <select value={formData.bikeId} onChange={(e) => handleBikeChange(e.target.value)} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none">
                      <option value="">{filteredBikes.length === 1 ? "Moto autoseleccionada" : "Elegí moto"}</option>
                      {filteredBikes.map((bike) => (
                        <option key={bike.id} value={bike.id}>{bike.patente} · {bike.marca} {bike.modelo}</option>
                      ))}
                    </select>
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre cliente</span>
                    <input value={formData.clienteNombre} onChange={(e) => setFormData((prev) => ({ ...prev, clienteNombre: e.target.value }))} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-slate-600" placeholder="Juan Pérez" />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">WhatsApp</span>
                    <input value={formData.telefono} onChange={(e) => setFormData((prev) => ({ ...prev, telefono: e.target.value }))} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-slate-600" placeholder="549343..." />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Patente</span>
                      <input value={formData.motoPatente} onChange={(e) => setFormData((prev) => ({ ...prev, motoPatente: e.target.value }))} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-slate-600" placeholder="ABC123" />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Marca / modelo</span>
                      <input value={formData.motoMarca} onChange={(e) => setFormData((prev) => ({ ...prev, motoMarca: e.target.value }))} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-slate-600" placeholder="Honda Wave" />
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Fecha</span>
                  <input type="date" value={formData.fecha} onChange={(e) => setFormData((prev) => ({ ...prev, fecha: e.target.value }))} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none" />
                </label>
                <label className="block space-y-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Hora</span>
                  <input type="time" value={formData.hora} onChange={(e) => setFormData((prev) => ({ ...prev, hora: e.target.value }))} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Motivo</span>
                <input value={formData.motivo} onChange={(e) => setFormData((prev) => ({ ...prev, motivo: e.target.value }))} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-slate-600" placeholder="Ej: service, diagnóstico, control" />
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Estado</span>
                <select value={formData.estado} onChange={(e) => setFormData((prev) => ({ ...prev, estado: e.target.value }))} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none">
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <label className="block space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Observaciones</span>
                <textarea value={formData.observaciones} onChange={(e) => setFormData((prev) => ({ ...prev, observaciones: e.target.value }))} rows={3} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-slate-600" placeholder="Notas para la secretaria, pedido del cliente, contexto del turno..." />
              </label>

              <div className="rounded-2xl bg-slate-900 p-4 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Avisos previos</p>
                <label className="flex items-center justify-between gap-3 text-sm font-black text-white">
                  <span>Recordatorio un día antes</span>
                  <input type="checkbox" checked={formData.reminderDayBefore} onChange={(e) => setFormData((prev) => ({ ...prev, reminderDayBefore: e.target.checked }))} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm font-black text-white">
                  <span>Recordatorio una hora antes</span>
                  <input type="checkbox" checked={formData.reminderHourBefore} onChange={(e) => setFormData((prev) => ({ ...prev, reminderHourBefore: e.target.checked }))} />
                </label>
              </div>

              <button type="submit" className="w-full rounded-2xl bg-blue-600 py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-xl shadow-blue-600/20 active:scale-95">
                {editingId ? "Guardar cambios" : "Confirmar turno"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
