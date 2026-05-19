import React, { useState, useEffect, useCallback } from "react";
import {
  ArrowLeft, CheckCircle2, ClipboardList, MessageCircle, Pause, Play,
  Plus, ThumbsDown, ThumbsUp, Trash2, Wrench, X,
} from "lucide-react";
import { LS } from "../lib/storage.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { formatMoney } from "../utils/format.js";
import { generarMensajePresupuestoConDatos, abrirWhatsApp, normalizarTelWA } from "../lib/messages.js";
import { iniciarCronometro, pausarCronometro, obtenerTiempoActual, formatTiempo, formatTiempoCorto } from "../lib/timer.js";

const ESTADO_LABEL = {
  borrador:   "Borrador",
  enviado:    "Enviado al cliente",
  aprobado:   "Aprobado",
  rechazado:  "Rechazado",
  convertido: "Convertido a OT",
};

const ESTADO_CSS = {
  borrador:   "bg-zinc-700/40 text-zinc-300 border-zinc-600/30",
  enviado:    "bg-blue-500/15 text-blue-300 border-blue-500/30",
  aprobado:   "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  rechazado:  "bg-red-500/15 text-red-300 border-red-500/30",
  convertido: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

function Separador() {
  return <div className="border-t border-zinc-800" />;
}

function LineaItem({ nombre, detalle, monto }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-black text-white truncate">{nombre}</p>
        {detalle && <p className="text-[10px] font-bold text-zinc-500">{detalle}</p>}
      </div>
      <p className="text-xs font-black text-orange-400 flex-shrink-0">{formatMoney(monto)}</p>
    </div>
  );
}

// ── Cronómetro display ────────────────────────────────────────────────────────
function CronDisplay({ pres }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!pres.cronometroActivo) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [pres.cronometroActivo]);
  const horas = obtenerTiempoActual(pres);
  return <span>{formatTiempo(horas)}</span>;
}

// ── Modal rechazo ─────────────────────────────────────────────────────────────
function ModalRechazo({ presupuesto, bike, client, config, onConfirm, onCancel }) {
  const [motivo, setMotivo] = useState("");

  const tiempoHoras = obtenerTiempoActual(presupuesto);
  const { tareas = [], repuestos = [], insumos = [], fletes = [], total = 0, numeroPresupuesto } = presupuesto;

  const generarComprobante = () => {
    const nombreTaller = config.nombreTaller || "Moto Gestión";
    const fecha = new Date().toLocaleString("es-AR");
    const patente = bike?.patente || "---";
    const motoLabel = `${bike?.marca || ""} ${bike?.modelo || ""}`.trim() || "Moto";
    const clienteNombre = client?.nombre || "Cliente";
    const tiempoLabel = tiempoHoras > 0 ? formatTiempoCorto(tiempoHoras) : null;

    let msg = `*${numeroPresupuesto || "Presupuesto"} — RECHAZADO*`;
    msg += `\n${fecha}`;
    msg += `\n\n*Taller:* ${nombreTaller}`;
    msg += `\n*Cliente:* ${clienteNombre}`;
    msg += `\n*Moto:* ${motoLabel} (${patente})`;

    if (tareas.length) {
      msg += `\n\n*Trabajos evaluados:*`;
      tareas.forEach(t => { msg += `\n— ${t.nombre}${t.monto ? ` · ${formatMoney(t.monto)}` : ""}`; });
    }
    if (repuestos.length) {
      msg += `\n\n*Repuestos relevados:*`;
      repuestos.forEach(r => { msg += `\n— ${r.nombre}${r.cantidad > 1 ? ` x${r.cantidad}` : ""}${r.monto ? ` · ${formatMoney(r.monto * (r.cantidad || 1))}` : ""}`; });
    }
    if (insumos.length) {
      msg += `\n\n*Insumos:*`;
      insumos.forEach(r => { msg += `\n— ${r.nombre}${r.cantidad > 1 ? ` x${r.cantidad}` : ""}${r.monto ? ` · ${formatMoney(r.monto * (r.cantidad || 1))}` : ""}`; });
    }

    if (total > 0) msg += `\n\n*Total presupuestado:* ${formatMoney(total)}`;
    if (tiempoLabel) msg += `\n*Tiempo de diagnóstico/presupuesto:* ${tiempoLabel}`;
    if (motivo.trim()) msg += `\n\n*Motivo del rechazo:* ${motivo.trim()}`;

    msg += `\n\nEl cliente declara haber recibido y rechazado el presente presupuesto. El taller queda eximido de responsabilidad sobre el estado del vehículo en caso de no realizar los trabajos indicados.`;
    msg += `\n\n_${nombreTaller}_`;
    return msg;
  };

  const handleCompartir = () => {
    const tel = client?.whatsapp || client?.tel || client?.telefono || "";
    const telNorm = normalizarTelWA(tel);
    if (telNorm) abrirWhatsApp(telNorm, generarComprobante());
    onConfirm(motivo.trim());
  };

  const handleSoloRegistrar = () => {
    onConfirm(motivo.trim());
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-h-[90vh] overflow-y-auto rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto max-w-[440px] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-red-400">Registrar rechazo</h3>
            <button onClick={onCancel} className="rounded-xl bg-zinc-800 p-2 text-zinc-400 active:scale-90">
              <X size={18} />
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-700 bg-zinc-800 p-4 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Resumen a registrar</p>
            <p className="text-xs font-black text-white">{bike?.patente} · {bike?.marca} {bike?.modelo}</p>
            <p className="text-[10px] font-bold text-zinc-400">{client?.nombre}</p>
            {tareas.length > 0 && <p className="text-[10px] font-bold text-zinc-500">{tareas.length} trabajo{tareas.length !== 1 ? "s" : ""} evaluado{tareas.length !== 1 ? "s" : ""}</p>}
            {(repuestos.length + insumos.length) > 0 && <p className="text-[10px] font-bold text-zinc-500">{repuestos.length + insumos.length} repuesto/insumo relevado{repuestos.length + insumos.length !== 1 ? "s" : ""}</p>}
            {total > 0 && <p className="text-[10px] font-bold text-zinc-500">Total cotizado: {formatMoney(total)}</p>}
            {tiempoHoras > 0.01 && <p className="text-[10px] font-bold text-zinc-500">Tiempo invertido: {formatTiempoCorto(tiempoHoras)}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Motivo del rechazo (opcional)</label>
            <textarea
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm font-bold text-white outline-none focus:border-red-500 resize-none"
              rows={3}
              placeholder="Ej: precio, plazo, cliente decide no reparar..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
          </div>

          <button
            onClick={handleCompartir}
            className="w-full flex items-center justify-center gap-2 rounded-[2rem] bg-emerald-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
          >
            <MessageCircle size={15} /> Registrar y enviar comprobante por WhatsApp
          </button>
          <button
            onClick={handleSoloRegistrar}
            className="w-full rounded-[2rem] border border-zinc-700 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-400 active:scale-95"
          >
            Solo registrar (sin WhatsApp)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function PresupuestoDetailView({
  presupuesto,
  bike,
  client,
  onConvertirAOT,
  onEliminar,
  setView,
  showToast,
}) {
  const [confirm, setConfirm] = useState(null);
  const [showRechazoModal, setShowRechazoModal] = useState(false);
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;

  if (!presupuesto) return null;

  const { id, numeroPresupuesto, estado, tareas = [], repuestos = [], insumos = [], fletes = [], total = 0, motivoConsulta, validezDias, createdAt } = presupuesto;

  const totalMO  = tareas.reduce((s, t) => s + (t.monto || 0), 0);
  const totalRep = repuestos.reduce((s, r) => s + (r.monto || 0) * (r.cantidad || 1), 0);
  const totalIns = insumos.reduce((s, i) => s + (i.monto || 0) * (i.cantidad || 1), 0);
  const totalFle = fletes.reduce((s, f) => s + (f.monto || 0), 0);

  // ── Cronómetro ──────────────────────────────────────────────────────────────
  const toggleCronometro = () => {
    if (presupuesto.cronometroActivo) {
      const updated = pausarCronometro(presupuesto);
      LS.updateDoc("presupuestos", id, {
        cronometroActivo: false,
        inicioCronometro: null,
        tiempoReal: updated.tiempoReal,
        updatedAt: Date.now(),
      });
    } else {
      const updated = iniciarCronometro(presupuesto);
      LS.updateDoc("presupuestos", id, {
        cronometroActivo: true,
        inicioCronometro: updated.inicioCronometro,
        updatedAt: Date.now(),
      });
    }
  };

  const cambiarEstado = (nuevoEstado, extra = {}) => {
    // Pausar cronometro al cerrar el presupuesto
    const pausaExtra = {};
    if (presupuesto.cronometroActivo) {
      const updated = pausarCronometro(presupuesto);
      pausaExtra.cronometroActivo = false;
      pausaExtra.inicioCronometro = null;
      pausaExtra.tiempoReal = updated.tiempoReal;
    }
    LS.updateDoc("presupuestos", id, { estado: nuevoEstado, ...pausaExtra, ...extra, updatedAt: Date.now() });
    showToast(`Presupuesto marcado como ${ESTADO_LABEL[nuevoEstado]}`);
  };

  const handleRechazoConfirmado = (motivo) => {
    setShowRechazoModal(false);
    cambiarEstado("rechazado", {
      motivoRechazo: motivo || "",
      fechaRechazo: Date.now(),
    });
  };

  const compartirWhatsApp = () => {
    const tel = client?.whatsapp || client?.tel || client?.telefono || "";
    const telNorm = normalizarTelWA(tel);
    if (!telNorm) { showToast("El cliente no tiene número de contacto"); return; }

    const presupuestoConfig = config.presupuestoConfig || CONFIG_DEFAULT.presupuestoConfig;
    const datosCobro = {
      titular: config.titular || config.nombreTaller || "",
      alias: config.alias || "",
      cbu: config.cbu || "",
    };
    const incluirDatos = presupuestoConfig.incluirAlias || presupuestoConfig.incluirCBU;

    const msg = generarMensajePresupuestoConDatos({
      client, bike, tareas, repuestos, total,
      adelantoPct: presupuestoConfig.adelantoPct || 0,
      incluirDatos, datosCobro,
      nombreTaller: config.nombreTaller || "",
    });

    abrirWhatsApp(telNorm, msg);
    if (estado === "borrador") {
      LS.updateDoc("presupuestos", id, { estado: "enviado", updatedAt: Date.now() });
    }
  };

  const confirmar = (mensaje, onOk) => setConfirm({ mensaje, onOk });

  const fecha = createdAt ? new Date(createdAt).toLocaleDateString("es-AR") : "---";
  const estadoCss = ESTADO_CSS[estado] || ESTADO_CSS.borrador;
  const estadoLabel = ESTADO_LABEL[estado] || estado;
  const yaFinalizado = estado === "convertido" || estado === "rechazado";
  const tiempoAcumulado = obtenerTiempoActual(presupuesto);

  return (
    <div className="p-4 pb-28 space-y-4 text-left animate-in fade-in duration-300">

      {confirm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-xs rounded-[2rem] border border-zinc-700 bg-zinc-900 p-6 space-y-5">
            <p className="text-sm font-black text-white text-center">{confirm.mensaje}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setConfirm(null)} className="rounded-2xl border border-zinc-700 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 active:scale-95">
                Cancelar
              </button>
              <button onClick={() => { confirm.onOk(); setConfirm(null); }} className="rounded-2xl bg-red-600 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showRechazoModal && (
        <ModalRechazo
          presupuesto={presupuesto}
          bike={bike}
          client={client}
          config={config}
          onConfirm={handleRechazoConfirmado}
          onCancel={() => setShowRechazoModal(false)}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => setView("presupuestos")} className="p-3 bg-zinc-900 rounded-2xl border border-white/5 text-white active:scale-90 transition-all">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{numeroPresupuesto || "PRE-??????"}</p>
          <h1 className="text-xl font-black text-white tracking-tighter uppercase truncate">
            {bike?.patente || "Sin patente"} · {bike?.marca} {bike?.modelo}
          </h1>
        </div>
        <span className={`flex-shrink-0 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${estadoCss}`}>
          {estadoLabel}
        </span>
      </div>

      {/* Cronómetro */}
      {!yaFinalizado && (
        <div className={`rounded-[2rem] border p-5 flex items-center justify-between gap-4 ${
          presupuesto.cronometroActivo
            ? "border-orange-500/30 bg-orange-500/10"
            : "border-zinc-800 bg-zinc-900"
        }`}>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Tiempo diagnóstico / presupuesto</p>
            <p className={`text-2xl font-black tabular-nums mt-1 ${presupuesto.cronometroActivo ? "text-orange-400" : "text-zinc-400"}`}>
              <CronDisplay pres={presupuesto} />
            </p>
          </div>
          <button
            onClick={toggleCronometro}
            className={`flex items-center gap-2 rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all ${
              presupuesto.cronometroActivo
                ? "bg-orange-600 text-white"
                : "bg-zinc-800 text-zinc-300"
            }`}
          >
            {presupuesto.cronometroActivo ? <><Pause size={14} /> Pausar</> : <><Play size={14} /> Iniciar</>}
          </button>
        </div>
      )}

      {/* Info cliente / moto */}
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 space-y-2">
        <div className="flex justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-500">Cliente</span>
          <span className="text-[10px] font-black text-white">{client?.nombre || "---"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-500">Teléfono</span>
          <span className="text-[10px] font-black text-white">{client?.tel || client?.telefono || "---"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-500">Fecha</span>
          <span className="text-[10px] font-black text-white">{fecha}</span>
        </div>
        {validezDias && (
          <div className="flex justify-between">
            <span className="text-[10px] font-black uppercase text-zinc-500">Validez</span>
            <span className="text-[10px] font-black text-white">{validezDias} días</span>
          </div>
        )}
        {presupuesto.motivoRechazo && (
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Motivo de rechazo</p>
            <p className="text-xs font-bold text-red-300">{presupuesto.motivoRechazo}</p>
          </div>
        )}
        {motivoConsulta && (
          <div className="pt-2 border-t border-zinc-800">
            <p className="text-[10px] font-black uppercase text-zinc-500 mb-1">Consulta</p>
            <p className="text-xs font-bold text-zinc-300">{motivoConsulta}</p>
          </div>
        )}
      </div>

      {/* Detalle de items */}
      <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900 p-5 space-y-1">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Detalle</p>
          {!yaFinalizado && (
            <button
              onClick={() => setView("gestionarPresupuesto")}
              className="flex items-center gap-1.5 rounded-xl bg-zinc-800 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-300 active:scale-95"
            >
              <Plus size={11} /> Agregar items
            </button>
          )}
        </div>

        {tareas.length > 0 && (
          <>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 pt-1">Mano de obra</p>
            {tareas.map((t, i) => <LineaItem key={i} nombre={t.nombre} monto={t.monto || 0} />)}
          </>
        )}
        {repuestos.length > 0 && (
          <>
            <Separador />
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 pt-1">Repuestos</p>
            {repuestos.map((r, i) => <LineaItem key={i} nombre={r.nombre} detalle={r.cantidad > 1 ? `x${r.cantidad}` : undefined} monto={(r.monto || 0) * (r.cantidad || 1)} />)}
          </>
        )}
        {insumos.length > 0 && (
          <>
            <Separador />
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 pt-1">Insumos</p>
            {insumos.map((r, i) => <LineaItem key={i} nombre={r.nombre} detalle={r.cantidad > 1 ? `x${r.cantidad}` : undefined} monto={(r.monto || 0) * (r.cantidad || 1)} />)}
          </>
        )}
        {fletes.length > 0 && (
          <>
            <Separador />
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 pt-1">Fletes</p>
            {fletes.map((f, i) => <LineaItem key={i} nombre={f.nombre || "Flete"} monto={f.monto || 0} />)}
          </>
        )}

        {tareas.length === 0 && repuestos.length === 0 && insumos.length === 0 && fletes.length === 0 && (
          <p className="text-center py-4 text-[10px] font-bold text-zinc-600">
            Sin items. Toca "Agregar items" para cargar trabajos y repuestos.
          </p>
        )}

        <Separador />
        <div className="flex items-center justify-between pt-2">
          <span className="text-xs font-black uppercase tracking-widest text-white">Total</span>
          <span className="text-lg font-black text-orange-400">{formatMoney(total)}</span>
        </div>
        {total > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {totalMO > 0 && <p className="text-[9px] font-bold text-zinc-600">MO: {formatMoney(totalMO)}</p>}
            {totalRep > 0 && <p className="text-[9px] font-bold text-zinc-600">Rep: {formatMoney(totalRep)}</p>}
          </div>
        )}
        {tiempoAcumulado > 0.01 && (
          <p className="text-[9px] font-bold text-zinc-600 pt-1">
            Tiempo invertido: {formatTiempoCorto(tiempoAcumulado)}
          </p>
        )}
      </div>

      {/* Acciones por estado */}
      {!yaFinalizado && (
        <button
          onClick={compartirWhatsApp}
          className="w-full flex items-center justify-center gap-3 rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 py-5 text-[11px] font-black uppercase tracking-widest text-emerald-300 active:scale-95 transition-all"
        >
          <MessageCircle size={18} /> Compartir por WhatsApp
        </button>
      )}

      {estado === "borrador" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cambiarEstado("enviado")}
            className="flex items-center justify-center gap-2 rounded-[2rem] border border-blue-500/30 bg-blue-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-blue-300 active:scale-95"
          >
            <ClipboardList size={14} /> Marcar enviado
          </button>
          <button
            onClick={() => cambiarEstado("aprobado")}
            className="flex items-center justify-center gap-2 rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-300 active:scale-95"
          >
            <ThumbsUp size={14} /> Aprobar
          </button>
        </div>
      )}

      {estado === "enviado" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => cambiarEstado("aprobado")}
            className="flex items-center justify-center gap-2 rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-emerald-300 active:scale-95"
          >
            <ThumbsUp size={14} /> Aprobado
          </button>
          <button
            onClick={() => setShowRechazoModal(true)}
            className="flex items-center justify-center gap-2 rounded-[2rem] border border-red-500/30 bg-red-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-red-300 active:scale-95"
          >
            <ThumbsDown size={14} /> Rechazado
          </button>
        </div>
      )}

      {estado === "borrador" && (
        <button
          onClick={() => setShowRechazoModal(true)}
          className="w-full flex items-center justify-center gap-2 rounded-[2rem] border border-red-500/20 py-3 text-[10px] font-black uppercase tracking-widest text-red-400/60 active:scale-95"
        >
          <ThumbsDown size={13} /> Registrar rechazo
        </button>
      )}

      {estado === "aprobado" && (
        <button
          onClick={() => confirmar("¿Convertir este presupuesto a una Orden de Trabajo?", onConvertirAOT)}
          className="w-full flex items-center justify-center gap-3 rounded-[2rem] bg-orange-600 py-5 text-[11px] font-black uppercase tracking-widest text-white shadow-xl shadow-orange-600/20 active:scale-[0.98] transition-all"
        >
          <Wrench size={18} /> Convertir a Orden de Trabajo
        </button>
      )}

      {estado === "rechazado" && (
        <div className="rounded-[2rem] border border-red-500/20 bg-red-500/5 p-5 space-y-2 text-center">
          <p className="text-xs font-black uppercase tracking-widest text-red-400">Presupuesto rechazado</p>
          {presupuesto.fechaRechazo && (
            <p className="text-[10px] font-bold text-zinc-500">
              {new Date(presupuesto.fechaRechazo).toLocaleString("es-AR")}
            </p>
          )}
          {tiempoAcumulado > 0.01 && (
            <p className="text-[10px] font-bold text-zinc-500">Tiempo invertido: {formatTiempoCorto(tiempoAcumulado)}</p>
          )}
        </div>
      )}

      {estado === "convertido" && (
        <div className="rounded-[2rem] border border-orange-500/20 bg-orange-500/5 p-5 text-center space-y-2">
          <CheckCircle2 size={24} className="text-orange-400 mx-auto" />
          <p className="text-xs font-black uppercase tracking-widest text-orange-400">Convertido a OT</p>
          <p className="text-[10px] font-bold text-zinc-500">Este presupuesto tiene una Orden de Trabajo asociada.</p>
          {presupuesto.trabajoId && (
            <button
              onClick={() => setView("ordenes")}
              className="mt-2 rounded-2xl border border-orange-500/30 px-5 py-2 text-[10px] font-black uppercase tracking-widest text-orange-400 active:scale-95"
            >
              Ver en Trabajos
            </button>
          )}
        </div>
      )}

      {(estado === "borrador" || estado === "rechazado") && (
        <button
          onClick={() => confirmar("¿Eliminar este presupuesto? Esta acción no se puede deshacer.", onEliminar)}
          className="w-full flex items-center justify-center gap-2 rounded-[2rem] border border-zinc-800 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-600 active:scale-95"
        >
          <Trash2 size={13} /> Eliminar presupuesto
        </button>
      )}
    </div>
  );
}
