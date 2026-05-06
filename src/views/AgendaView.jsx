import React, { useMemo, useState } from "react";
import { ArrowLeft, Calendar, Bell, CheckCircle2, Clock3, Plus, Phone, Bike, User, XCircle, RotateCcw, MessageSquare } from "lucide-react";
import { LS, useCollection, generateId } from "../lib/storage.js";

const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const ESTADOS = {
  pendiente: { label: "Pendiente", chip: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  confirmado: { label: "Confirmado", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  reprogramar: { label: "Reprogramar", chip: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  suspendido: { label: "Suspendido", chip: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
  asistio: { label: "Asistió", chip: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40" },
  no_asistio: { label: "No asistió", chip: "bg-slate-700 text-slate-300 border-slate-600" },
};

function inicioSemana(baseDate) {
  const fecha = new Date(baseDate);
  const day = fecha.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  fecha.setDate(fecha.getDate() + diff);
  fecha.setHours(0, 0, 0, 0);
  return fecha;
}

function formatFecha(fecha) {
  return fecha.toISOString().split("T")[0];
}

function formatFechaLarga(fechaIso) {
  const fecha = new Date(`${fechaIso}T00:00:00`);
  return `${DIAS[fecha.getDay()]} ${fecha.getDate()}/${fecha.getMonth() + 1}`;
}

function formatHora(hora = "") {
  return hora || "--:--";
}

function estadoConfig(estado) {
  return ESTADOS[estado] || ESTADOS.pendiente;
}

function buildMensaje(turno, cliente, moto, momento) {
  const encabezado = momento === "dia"
    ? "Recordatorio de turno para mañana"
    : "Recordatorio de turno para hoy";
  return `${encabezado}\nCliente: ${cliente?.nombre || turno.clienteNombre || "Cliente"}\nMoto: ${moto?.patente || turno.motoPatente || "Sin patente"}\nFecha: ${formatFechaLarga(turno.fecha)}\nHora: ${formatHora(turno.hora)}\nEstado: ${estadoConfig(turno.estado).label}\n\nResponde: CONFIRMO / REPROGRAMAR / SUSPENDER.`;
}

export default function AgendaView({ setView }) {
  const turnos = useCollection("agendaTurnos");
  const clientes = useCollection("clientes");
  const motos = useCollection("motos");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [form, setForm] = useState({
    fecha: formatFecha(new Date()),
    hora: "09:00",
    clienteId: "",
    motoId: "",
    clienteNombre: "",
    telefono: "",
    motivo: "",
    estado: "pendiente",
    reminderDayBefore: true,
    reminderHourBefore: true,
    observaciones: "",
  });

  const baseSemana = useMemo(() => {
    const base = inicioSemana(new Date());
    base.setDate(base.getDate() + semanaOffset * 7);
    return base;
  }, [semanaOffset]);

  const diasSemana = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const dia = new Date(baseSemana);
      dia.setDate(baseSemana.getDate() + index);
      return dia;
    });
  }, [baseSemana]);

  const turnosFiltrados = useMemo(() => {
    const base = formatFecha(baseSemana);
    const fin = formatFecha(new Date(baseSemana.getFullYear(), baseSemana.getMonth(), baseSemana.getDate() + 6));
    return turnos
      .filter((turno) => turno.fecha >= base && turno.fecha <= fin)
      .filter((turno) => (filtroEstado === "todos" ? true : turno.estado === filtroEstado))
      .sort((a, b) => `${a.fecha} ${a.hora}`.localeCompare(`${b.fecha} ${b.hora}`));
  }, [turnos, baseSemana, filtroEstado]);

  const resumen = useMemo(() => {
    return turnosFiltrados.reduce((acc, turno) => {
      acc.total += 1;
      if (turno.estado === "confirmado") acc.confirmados += 1;
      if (turno.estado === "pendiente") acc.pendientes += 1;
      if (turno.reminderDayBefore || turno.reminderHourBefore) acc.recordatorios += 1;
      return acc;
    }, { total: 0, confirmados: 0, pendientes: 0, recordatorios: 0 });
  }, [turnosFiltrados]);

  const motosCliente = useMemo(() => {
    if (!form.clienteId) return motos;
    return motos.filter((moto) => moto.clienteId === form.clienteId);
  }, [motos, form.clienteId]);

  const agendaPorDia = useMemo(() => {
    return diasSemana.map((dia) => {
      const fecha = formatFecha(dia);
      const items = turnosFiltrados.filter((turno) => turno.fecha === fecha);
      return { dia, fecha, items };
    });
  }, [diasSemana, turnosFiltrados]);

  const guardarTurno = () => {
    if (!form.fecha || !form.hora) return;

    const cliente = clientes.find((item) => item.id === form.clienteId);
    const moto = motos.find((item) => item.id === form.motoId);

    LS.setDoc("agendaTurnos", generateId(), {
      fecha: form.fecha,
      hora: form.hora,
      clienteId: form.clienteId || null,
      motoId: form.motoId || null,
      clienteNombre: cliente?.nombre || form.clienteNombre || "Cliente sin nombre",
      telefono: cliente?.telefono || cliente?.tel || form.telefono || "",
      motoPatente: moto?.patente || "Sin patente",
      motoMarca: moto?.marca || "",
      motoModelo: moto?.modelo || "",
      estado: form.estado,
      motivo: form.motivo || "Revisión / turno de taller",
      reminderDayBefore: !!form.reminderDayBefore,
      reminderHourBefore: !!form.reminderHourBefore,
      observaciones: form.observaciones || "",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    setForm({
      fecha: form.fecha,
      hora: "09:00",
      clienteId: "",
      motoId: "",
      clienteNombre: "",
      telefono: "",
      motivo: "",
      estado: "pendiente",
      reminderDayBefore: true,
      reminderHourBefore: true,
      observaciones: "",
    });
    setMostrarForm(false);
  };

  const cambiarEstado = (turno, estado) => {
    LS.updateDoc("agendaTurnos", turno.id, { estado, updatedAt: Date.now() });
  };

  const eliminarTurno = (turnoId) => {
    LS.deleteDoc("agendaTurnos", turnoId);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] pb-32 text-white animate-in slide-in-from-right duration-300">
      <div className="p-5 space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setView("home")}
            className="rounded-2xl border border-white/5 bg-slate-900 p-3 active:scale-95"
          >
            <ArrowLeft size={16} className="text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-black text-white">
              <Calendar size={20} />
              Agenda del taller
            </h1>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Turnos, confirmaciones y recordatorios previos
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Turnos de la semana</p>
            <p className="mt-1 text-3xl font-black text-blue-400">{resumen.total}</p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Confirmados</p>
            <p className="mt-1 text-3xl font-black text-emerald-400">{resumen.confirmados}</p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pendientes</p>
            <p className="mt-1 text-3xl font-black text-yellow-400">{resumen.pendientes}</p>
          </div>
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Con aviso previo</p>
            <p className="mt-1 text-3xl font-black text-fuchsia-400">{resumen.recordatorios}</p>
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Organización tipo secretaría</p>
              <p className="mt-1 text-sm font-black text-white">Confirmación, suspensión y reprogramación de turnos</p>
            </div>
            <button
              onClick={() => setMostrarForm((prev) => !prev)}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-blue-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
            >
              <Plus size={16} /> Nuevo turno
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { key: "todos", label: "Todos" },
              { key: "pendiente", label: "Pendientes" },
              { key: "confirmado", label: "Confirmados" },
              { key: "reprogramar", label: "Reprogramar" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => setFiltroEstado(item.key)}
                className={`rounded-2xl px-3 py-3 text-[10px] font-black uppercase tracking-widest active:scale-95 ${
                  filtroEstado === item.key ? "bg-blue-600 text-white" : "bg-slate-950 text-slate-400"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-950 p-3">
            <button
              onClick={() => setSemanaOffset((prev) => prev - 1)}
              className="rounded-2xl border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 active:scale-95"
            >
              Semana anterior
            </button>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">
              {formatFechaLarga(formatFecha(diasSemana[0]))} al {formatFechaLarga(formatFecha(diasSemana[6]))}
            </p>
            <button
              onClick={() => setSemanaOffset((prev) => prev + 1)}
              className="rounded-2xl border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 active:scale-95"
            >
              Semana siguiente
            </button>
          </div>
        </div>

        {mostrarForm && (
          <div className="rounded-[2rem] border border-blue-500/20 bg-slate-900 p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">Nuevo turno</p>
                <p className="mt-1 text-sm font-black text-white">Elegí día, hora, cliente y moto</p>
              </div>
              <button
                onClick={() => setMostrarForm(false)}
                className="rounded-2xl border border-white/10 bg-slate-950 p-3 text-slate-300 active:scale-95"
              >
                <XCircle size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Día</span>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((prev) => ({ ...prev, fecha: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none"
                />
              </label>
              <label className="space-y-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Hora</span>
                <input
                  type="time"
                  value={form.hora}
                  onChange={(e) => setForm((prev) => ({ ...prev, hora: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none"
                />
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Cliente del historial</span>
              <select
                value={form.clienteId}
                onChange={(e) => {
                  const clienteId = e.target.value;
                  const cliente = clientes.find((item) => item.id === clienteId);
                  setForm((prev) => ({
                    ...prev,
                    clienteId,
                    clienteNombre: cliente?.nombre || "",
                    telefono: cliente?.telefono || cliente?.tel || "",
                    motoId: "",
                  }));
                }}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none"
              >
                <option value="">Elegir cliente</option>
                {clientes.map((cliente) => (
                  <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2 block">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Moto del historial</span>
              <select
                value={form.motoId}
                onChange={(e) => setForm((prev) => ({ ...prev, motoId: e.target.value }))}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none"
              >
                <option value="">Elegir moto</option>
                {motosCliente.map((moto) => (
                  <option key={moto.id} value={moto.id}>{moto.patente} · {moto.marca} {moto.modelo}</option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2 block">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Motivo / tipo de cita</span>
                <input
                  value={form.motivo}
                  onChange={(e) => setForm((prev) => ({ ...prev, motivo: e.target.value }))}
                  placeholder="Ej: service, control, diagnóstico"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-slate-600"
                />
              </label>
              <label className="space-y-2 block">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Estado inicial</span>
                <select
                  value={form.estado}
                  onChange={(e) => setForm((prev) => ({ ...prev, estado: e.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none"
                >
                  <option value="pendiente">Pendiente de confirmar</option>
                  <option value="confirmado">Confirmado</option>
                  <option value="reprogramar">A reprogramar</option>
                </select>
              </label>
            </div>

            <label className="space-y-2 block">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Observaciones</span>
              <textarea
                value={form.observaciones}
                onChange={(e) => setForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                rows={3}
                placeholder="Indicaciones para la secretaria, notas del turno, pedido del cliente..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-black text-white outline-none placeholder:text-slate-600"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-slate-950 p-4 space-y-3">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Avisos previos</p>
              <label className="flex items-center justify-between gap-3 text-sm font-black text-white">
                <span>Enviar recordatorio un día antes</span>
                <input
                  type="checkbox"
                  checked={form.reminderDayBefore}
                  onChange={(e) => setForm((prev) => ({ ...prev, reminderDayBefore: e.target.checked }))}
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm font-black text-white">
                <span>Enviar recordatorio una hora antes</span>
                <input
                  type="checkbox"
                  checked={form.reminderHourBefore}
                  onChange={(e) => setForm((prev) => ({ ...prev, reminderHourBefore: e.target.checked }))}
                />
              </label>
            </div>

            <button
              onClick={guardarTurno}
              className="w-full rounded-2xl bg-emerald-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
            >
              Guardar turno
            </button>
          </div>
        )}

        <div className="space-y-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Calendario semanal</p>
          {agendaPorDia.map(({ dia, fecha, items }) => {
            const esHoy = fecha === formatFecha(new Date());
            return (
              <div
                key={fecha}
                className={`rounded-[1.75rem] border p-4 space-y-3 ${esHoy ? "border-blue-500/30 bg-blue-500/5" : "border-slate-800 bg-slate-900/30"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-black ${esHoy ? "text-blue-400" : "text-slate-200"}`}>
                      {DIAS[dia.getDay()]} {dia.getDate()}/{dia.getMonth() + 1}
                    </span>
                    {esHoy && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-black uppercase text-white">Hoy</span>
                    )}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                    {items.length} turno{items.length === 1 ? "" : "s"}
                  </span>
                </div>

                {items.length === 0 && (
                  <p className="text-[11px] font-bold text-slate-600">Sin turnos cargados para este día.</p>
                )}

                {items.map((turno) => {
                  const cliente = clientes.find((item) => item.id === turno.clienteId);
                  const moto = motos.find((item) => item.id === turno.motoId);
                  const estado = estadoConfig(turno.estado);
                  return (
                    <div key={turno.id} className="rounded-[1.5rem] border border-white/10 bg-slate-950/90 p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 text-sm font-black text-white">
                            <Clock3 size={14} className="text-blue-400" />
                            {formatHora(turno.hora)}
                          </div>
                          <p className="text-sm font-black text-white">{turno.motivo || "Turno de taller"}</p>
                          <div className="flex flex-wrap items-center gap-2 text-[11px] font-black text-slate-300">
                            <span className="flex items-center gap-1"><User size={12} /> {cliente?.nombre || turno.clienteNombre}</span>
                            <span className="flex items-center gap-1"><Bike size={12} /> {moto?.patente || turno.motoPatente}</span>
                          </div>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-widest ${estado.chip}`}>
                          {estado.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-black text-slate-400">
                        <div className="rounded-2xl bg-slate-900 px-3 py-3">
                          <p className="uppercase tracking-widest text-slate-500">Recordatorio</p>
                          <p className="mt-1 text-white">
                            {turno.reminderDayBefore && turno.reminderHourBefore
                              ? "1 día antes + 1 hora antes"
                              : turno.reminderDayBefore
                                ? "1 día antes"
                                : turno.reminderHourBefore
                                  ? "1 hora antes"
                                  : "Sin aviso"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-900 px-3 py-3">
                          <p className="uppercase tracking-widest text-slate-500">Contacto</p>
                          <p className="mt-1 text-white">{turno.telefono || "Sin teléfono"}</p>
                        </div>
                      </div>

                      {turno.observaciones && (
                        <div className="rounded-2xl border border-white/10 bg-slate-900 px-3 py-3 text-[11px] font-bold text-slate-300">
                          {turno.observaciones}
                        </div>
                      )}

                      <div className="rounded-2xl border border-blue-500/15 bg-blue-500/5 p-3 space-y-2">
                        <p className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-300">
                          <MessageSquare size={12} /> Mensaje sugerido para la secretaria
                        </p>
                        <p className="whitespace-pre-line text-[11px] font-bold leading-relaxed text-slate-200">
                          {buildMensaje(turno, cliente, moto, turno.reminderDayBefore ? "dia" : "hora")}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <button
                          onClick={() => cambiarEstado(turno, "confirmado")}
                          className="rounded-2xl bg-emerald-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
                        >
                          Confirmó
                        </button>
                        <button
                          onClick={() => cambiarEstado(turno, "reprogramar")}
                          className="rounded-2xl bg-blue-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
                        >
                          Reprogramar
                        </button>
                        <button
                          onClick={() => cambiarEstado(turno, "suspendido")}
                          className="rounded-2xl bg-rose-600 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
                        >
                          Suspender
                        </button>
                        <button
                          onClick={() => cambiarEstado(turno, "asistio")}
                          className="rounded-2xl bg-slate-800 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-200 active:scale-95"
                        >
                          Asistió
                        </button>
                        <button
                          onClick={() => cambiarEstado(turno, "no_asistio")}
                          className="rounded-2xl bg-slate-800 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-200 active:scale-95"
                        >
                          No asistió
                        </button>
                        <button
                          onClick={() => eliminarTurno(turno.id)}
                          className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 active:scale-95"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {turnosFiltrados.length > 0 && (
          <div className="rounded-[1.75rem] border border-slate-800 bg-slate-900/40 p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Control de secretaría</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-950 p-4 text-[11px] font-bold text-slate-300">
                <p className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-yellow-300"><Bell size={12} /> Avisos previos</p>
                <p className="mt-2">La agenda ya guarda si el aviso sale un día antes y una hora antes. Queda lista para automatizar el envío después.</p>
              </div>
              <div className="rounded-2xl bg-slate-950 p-4 text-[11px] font-bold text-slate-300">
                <p className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-emerald-300"><CheckCircle2 size={12} /> Confirmación de asistencia</p>
                <p className="mt-2">Cada turno puede pasar por pendiente, confirmado, reprogramar, suspendido, asistió o no asistió.</p>
              </div>
              <div className="rounded-2xl bg-slate-950 p-4 text-[11px] font-bold text-slate-300">
                <p className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-blue-300"><Phone size={12} /> Contacto</p>
                <p className="mt-2">Si el cliente ya existe en historial, la agenda toma su teléfono y su moto automáticamente.</p>
              </div>
              <div className="rounded-2xl bg-slate-950 p-4 text-[11px] font-bold text-slate-300">
                <p className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-rose-300"><RotateCcw size={12} /> Reprogramación</p>
                <p className="mt-2">Si cambia el turno, se puede pasar a reprogramar o suspender sin perder el registro de la cita original.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
