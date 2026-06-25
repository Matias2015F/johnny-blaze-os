import { useMemo, useState } from "react";
import { LS, generateId, useCollection } from "../lib/storage.js";
import { abrirEnlaceExterno } from "../lib/whatsappService.js";

// ── Utilidades de calendario ──────────────────────────────────────────────────

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Tokens semánticos de estado — la vista los mapea a CSS ───────────────────

export const STATUS_TOKEN = {
  confirmado:  { label: "Confirmado",  variant: "success" },
  reprogramar: { label: "Reprogramar", variant: "warning" },
  suspendido:  { label: "Suspendido",  variant: "danger" },
  asistio:     { label: "Asistió",     variant: "success_strong" },
  no_asistio:  { label: "No asistió",  variant: "muted" },
  pendiente:   { label: "Pendiente",   variant: "pending" },
};

// ── Mensaje WhatsApp — lógica de dominio ────────────────────────────────────

function buildWhatsappMessage(appointment, type) {
  const cliente = appointment.clienteNombre || "cliente";
  const fecha   = appointment.fecha;
  const hora    = appointment.hora || "--:--";
  const moto    = appointment.motoPatente || appointment.motoMarca || "moto";

  if (type === "confirm")
    return `Hola ${cliente}, te escribo para confirmar tu turno del ${fecha} a las ${hora} por ${moto}. ¿Vas a asistir, reprogramar o suspender?`;
  if (type === "day_before")
    return `Hola ${cliente}, mañana ${fecha} a las ${hora} tenés tu turno por ${moto}. ¿Vas a asistir al turno o necesitás reprogramarlo?`;
  if (type === "hour_before_confirm")
    return `Hola ${cliente}, falta una hora para tu turno de hoy a las ${hora} por ${moto}. ¿Seguís en camino o querés avisarnos un cambio?`;
  return `Hola ${cliente}, falta una hora para tu turno de hoy a las ${hora} por ${moto}. Te esperamos en el taller.`;
}

// ── Valor inicial del formulario ─────────────────────────────────────────────

function emptyForm(fechaStr) {
  return {
    clientId: "", bikeId: "",
    clienteNombre: "", telefono: "",
    motoPatente: "", motoMarca: "", motoModelo: "",
    fecha: fechaStr, hora: "09:00",
    motivo: "", estado: "pendiente", observaciones: "",
    reminderDayBefore: true, reminderHourBefore: true,
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAgendaView() {
  const clients      = useCollection("clientes");
  const bikes        = useCollection("motos");
  const appointments = useCollection("agendaTurnos");

  // Navegación del calendario
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate]  = useState(() => new Date());

  // Estado del modal
  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [editingId,     setEditingId]     = useState(null);
  const [clientMode,    setClientMode]    = useState("historial");
  const [reminderMenuId, setReminderMenuId] = useState(null);
  const [formData,      setFormData]      = useState(() => emptyForm(formatDateKey(new Date())));

  // ── Derivaciones ────────────────────────────────────────────────────────────

  const selectedDateStr = useMemo(() => formatDateKey(selectedDate), [selectedDate]);

  const dayAppointments = useMemo(() =>
    appointments
      .filter((a) => a.fecha === selectedDateStr)
      .sort((a, b) => (a.hora || "").localeCompare(b.hora || "")),
  [appointments, selectedDateStr]);

  const stats = useMemo(() =>
    appointments.reduce((acc, a) => {
      acc.total += 1;
      if (a.estado === "confirmado") acc.confirmados += 1;
      if (a.reminderDayBefore || a.reminderHourBefore) acc.recordatorios += 1;
      return acc;
    }, { total: 0, confirmados: 0, recordatorios: 0 }),
  [appointments]);

  const filteredBikes = useMemo(() =>
    formData.clientId ? bikes.filter((b) => b.clienteId === formData.clientId) : bikes,
  [bikes, formData.clientId]);

  // Metadatos del calendario calculados una vez por mes
  const calendarMeta = useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return {
      daysInMonth: new Date(y, m + 1, 0).getDate(),
      startDay:    new Date(y, m,   1).getDay(),
      monthLabel:  currentMonth.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
    };
  }, [currentMonth]);

  // ── Consultas de calendario ──────────────────────────────────────────────────

  const isToday = (day) => {
    const t = new Date();
    return day === t.getDate()
      && currentMonth.getMonth() === t.getMonth()
      && currentMonth.getFullYear() === t.getFullYear();
  };

  const isSelected = (day) =>
    day === selectedDate.getDate()
    && currentMonth.getMonth() === selectedDate.getMonth()
    && currentMonth.getFullYear() === selectedDate.getFullYear();

  const hasAppointment = (day) => {
    const y = currentMonth.getFullYear();
    const m = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return appointments.some((a) => a.fecha === `${y}-${m}-${d}`);
  };

  // ── Navegación de calendario ─────────────────────────────────────────────────

  const prevMonth = () =>
    setCurrentMonth((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1));
  const nextMonth = () =>
    setCurrentMonth((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1));
  const selectDay = (day) =>
    setSelectedDate(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day));

  // ── Modal ───────────────────────────────────────────────────────────────────

  const openModal = (appointment = null) => {
    if (appointment) {
      setEditingId(appointment.id);
      setClientMode(appointment.clientId || appointment.bikeId ? "historial" : "manual");
      setFormData({
        clientId:          appointment.clientId          || "",
        bikeId:            appointment.bikeId            || "",
        clienteNombre:     appointment.clienteNombre     || "",
        telefono:          appointment.telefono          || "",
        motoPatente:       appointment.motoPatente       || "",
        motoMarca:         appointment.motoMarca         || "",
        motoModelo:        appointment.motoModelo        || "",
        fecha:             appointment.fecha             || selectedDateStr,
        hora:              appointment.hora              || "09:00",
        motivo:            appointment.motivo            || "",
        estado:            appointment.estado            || "pendiente",
        observaciones:     appointment.observaciones     || "",
        reminderDayBefore:  appointment.reminderDayBefore  !== false,
        reminderHourBefore: appointment.reminderHourBefore !== false,
      });
    } else {
      setEditingId(null);
      setClientMode("historial");
      setFormData(emptyForm(selectedDateStr));
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  // ── Selección de cliente/moto en el form ─────────────────────────────────────

  const handleClientChange = (clientId) => {
    const client     = clients.find((c) => c.id === clientId);
    const clientBikes = bikes.filter((b) => b.clienteId === clientId);
    const bike       = clientBikes.length === 1 ? clientBikes[0] : null;
    setFormData((prev) => ({
      ...prev,
      clientId,
      bikeId:        bike?.id        || "",
      clienteNombre: client?.nombre  || prev.clienteNombre,
      telefono:      client?.telefono || client?.tel || prev.telefono,
      motoPatente:   bike?.patente   || "",
      motoMarca:     bike?.marca     || "",
      motoModelo:    bike?.modelo    || "",
    }));
  };

  const handleBikeChange = (bikeId) => {
    const bike = bikes.find((b) => b.id === bikeId);
    setFormData((prev) => ({
      ...prev,
      bikeId,
      motoPatente: bike?.patente || prev.motoPatente,
      motoMarca:   bike?.marca   || prev.motoMarca,
      motoModelo:  bike?.modelo  || prev.motoModelo,
    }));
  };

  // ── CRUD ────────────────────────────────────────────────────────────────────

  const submitAppointment = (e) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === formData.clientId);
    const bike   = bikes.find((b) => b.id === formData.bikeId);

    const payload = {
      clientId:          formData.clientId    || null,
      bikeId:            formData.bikeId      || null,
      clienteNombre:     client?.nombre       || formData.clienteNombre || "Cliente sin nombre",
      telefono:          client?.telefono     || client?.tel || formData.telefono || "",
      motoPatente:       bike?.patente        || formData.motoPatente || "Sin patente",
      motoMarca:         bike?.marca          || formData.motoMarca   || "",
      motoModelo:        bike?.modelo         || formData.motoModelo  || "",
      fecha:             formData.fecha,
      hora:              formData.hora,
      motivo:            formData.motivo      || "Turno de taller",
      estado:            formData.estado,
      observaciones:     formData.observaciones || "",
      reminderDayBefore:  !!formData.reminderDayBefore,
      reminderHourBefore: !!formData.reminderHourBefore,
      updatedAt: Date.now(),
    };

    if (editingId) {
      LS.updateDoc("agendaTurnos", editingId, payload);
    } else {
      LS.setDoc("agendaTurnos", generateId(), { ...payload, createdAt: Date.now() });
    }

    closeModal();
    setFormData(emptyForm(formData.fecha));
  };

  const deleteAppointment = (id) => LS.deleteDoc("agendaTurnos", id);

  const updateEstado = (id, estado) =>
    LS.updateDoc("agendaTurnos", id, { estado, updatedAt: Date.now() });

  const sendWhatsApp = (appointment, type) => {
    const tel = String(appointment.telefono || "").replace(/\D/g, "");
    if (!tel) return;
    const msg = buildWhatsappMessage(appointment, type);
    abrirEnlaceExterno(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`);
  };

  // ── API pública del hook ─────────────────────────────────────────────────────

  return {
    // Datos
    clients, filteredBikes,
    dayAppointments, stats,
    // Calendario
    currentMonth, calendarMeta,
    selectedDate, selectedDateStr,
    isToday, isSelected, hasAppointment,
    prevMonth, nextMonth, selectDay,
    // Modal
    isModalOpen, openModal, closeModal,
    editingId, clientMode, setClientMode,
    formData, setFormData,
    reminderMenuId, setReminderMenuId,
    // Acciones
    handleClientChange, handleBikeChange,
    submitAppointment,
    deleteAppointment,
    updateEstado,
    sendWhatsApp,
    // Token semántico — la vista mapea variant → CSS
    getStatusToken: (estado) => STATUS_TOKEN[estado] || STATUS_TOKEN.pendiente,
  };
}
