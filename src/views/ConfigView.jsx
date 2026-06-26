import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Download, LogOut, Trash2, Database, Info, Shield,
  RotateCcw, FileSpreadsheet, ChevronRight, ChevronLeft, BarChart2,
  Settings, HardDrive, Wrench, Plus, Minus, Star,
} from "lucide-react";
import { LS, useCollection, migrateFromRootCollections, forceSyncCacheToFirestore, clearFirestoreData } from "../lib/storage.js";
import { auth, db } from "../firebase.js";
import { deleteUser } from "firebase/auth";
import { createCloudBackup, listCloudBackups, restoreCloudBackup } from "../lib/cloudBackup.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { APP_BUILD } from "../generated/appVersion.js";
import { applyRemoteUpdate, bindInstallPromptCapture, canPromptInstall, ensureNotificationPermission, fetchRemoteVersion, getDisplayModeInfo, isNewerBuild, promptInstallApp, sendTestNotification } from "../lib/appUpdate.js";
import { subscribeToPush, unsubscribeFromPush, getPushStatus, isPushSupported } from "../lib/pushService.js";
import { DEFAULT_SAAS_ADMIN_SETTINGS as DEFAULT_ADMIN_SETTINGS, PLATFORM_ADMIN_EMAILS, PLATFORM_ADMIN_UIDS, actualizarSuscripcionUsuario, crearTicketSoporte, guardarAdminSettings, isPlatformAdminUser, leerAdminSettings, leerUsuarioSaas, normalizeAdminSettings, normalizeDateMs, normalizeSaasUser } from "../services/saasService.js";
import { logAdminAction } from "../services/adminAuditService.js";
import { validateAdminSettings, validateExtraDays, validatePlanKey } from "../services/adminValidationService.js";
import { FREE_PLAN_LIMITS, getFreeUsageStatus } from "../services/usageLimitService.js";
import { formatMoney } from "../utils/format.js";
import MapaPicker from "../components/MapaPicker.jsx";
import { exportarOrdenes, exportarClientes, exportarBalance, exportarRepuestos } from "../utils/export.js";
import { descargarBackup, restaurarDesdeTexto, restaurarAutoBackup, estadoBackup, tiempoDesde } from "../utils/backup.js";
import { runIntegrityCheckFromCache } from "../lib/integrityTest.js";
import { collection, doc, getDoc, getDocs, getDocsFromServer, query, limit, orderBy, where, setDoc } from "firebase/firestore";
import { useTallerConfig } from "../hooks/useTallerConfig.js";
import { useBackupPanel } from "../hooks/useBackupPanel.js";

const DIFICULTADES = [
  { key: "facil",      label: "Fácil",      color: "text-green-500",  bg: "bg-green-50",  border: "border-green-200" },
  { key: "normal",     label: "Normal",     color: "text-orange-500",   bg: "bg-orange-50",   border: "border-orange-200" },
  { key: "dificil",    label: "Difícil",    color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "complicado", label: "Complicado", color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200" },
];

const TABS = [
  { id: "resumen",    label: "Resumen",  Icon: BarChart2 },
  { id: "taller",     label: "Taller",   Icon: Wrench },
  { id: "datos",      label: "Datos",    Icon: HardDrive },
  { id: "sistema",    label: "Sistema",  Icon: Settings },
  { id: "reputacion", label: "Reput.",   Icon: Star },
  { id: "admin",      label: "Admin",    Icon: Shield },
];

// Stepper component
function Stepper({ value, onChange, step = 1, min = 0, max = Infinity, format = v => v, suffix = "" }) {

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-11 h-11 rounded-2xl bg-zinc-100 flex items-center justify-center active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        <Minus size={16} className="text-zinc-600" />
      </button>
      <div className="flex-1 text-center">
        <span className="text-2xl font-black text-zinc-800 tracking-tight">{format(value)}</span>
        {suffix && <span className="text-sm font-bold text-zinc-400 ml-1">{suffix}</span>}
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-11 h-11 rounded-2xl bg-zinc-900 flex items-center justify-center active:scale-95 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-400"
      >
        <Plus size={16} className="text-white" />
      </button>
    </div>
  );
}

// Section card
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white/95 rounded-[1.75rem] shadow-[0_18px_45px_rgba(2,6,23,0.12)] border border-white/70 p-5 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_0_4px_rgba(249,115,22,0.12)]" />
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.18em]">{children}</p>
    </div>
  );
}

import { PantallaAdmin, PLAN_LABELS } from "./AdminPanelView.jsx";
import { isAdminSurface } from "../lib/surfaces.js";
function PantallaResumen({ orders, caja }) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const ordenesMes = useMemo(() => orders.filter(o => (o.fechaIngreso || "").startsWith(mesActual)), [orders, mesActual]);
  const { totalMes, gananciaMes } = useMemo(() => ({
    totalMes:    ordenesMes.reduce((s, o) => s + (o.total || 0), 0),
    gananciaMes: ordenesMes.reduce((s, o) => s + calcularResultadosOrden(o).gananciaEstimada, 0),
  }), [ordenesMes]);
  const balance = useMemo(() => caja.reduce((acc, m) => (m.tipo === "ingreso" ? acc + m.monto : acc - m.monto), 0), [caja]);

  const mes = new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });
  const balancePositivo = balance >= 0;
  const gananciaPositiva = gananciaMes >= 0;

  return (
    <div className="space-y-4">
      {/* Caja */}
      <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0f2435] via-[#102f46] to-[#071927] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-300">Dinero en caja</p>
            <p className="mt-1 text-xs font-bold capitalize text-slate-300">{mes}</p>
          </div>
          <div className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${balancePositivo ? "bg-emerald-400/15 text-emerald-300" : "bg-rose-400/15 text-rose-300"}`}>
            {balancePositivo ? "Al día" : "Revisar"}
          </div>
        </div>

        <p className={`mt-5 break-words text-[clamp(2.35rem,11vw,4rem)] font-black leading-none tracking-tight ${balancePositivo ? "text-emerald-300" : "text-rose-300"}`}>
          {formatMoney(balance)}
        </p>
        <p className="mt-3 max-w-[20rem] text-sm font-semibold leading-relaxed text-slate-300">
          Resumen rápido para saber cómo viene el taller hoy.
        </p>
      </div>

      {/* Stats del mes */}
      <Card className="space-y-4">
        <SectionTitle>Este mes</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-[1.35rem] border border-orange-100 bg-orange-50/90 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">Trabajos</p>
            <p className="mt-2 text-4xl font-black leading-none tracking-tight text-slate-900">{ordenesMes.length}</p>
            <p className="mt-1 text-[11px] font-bold text-slate-500">órdenes del mes</p>
          </div>
          <div className="rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Cobrado</p>
            <p className="mt-2 break-words text-[clamp(1.05rem,5.2vw,1.6rem)] font-black leading-tight text-slate-900">{formatMoney(totalMes)}</p>
            <p className="mt-1 text-[11px] font-bold text-slate-500">ingresos</p>
          </div>
          <div className="col-span-2 rounded-[1.35rem] border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700">Ganancia estimada</p>
                <p className="mt-2 break-words text-[clamp(1.35rem,7vw,2.35rem)] font-black leading-tight text-slate-950">
                  {formatMoney(gananciaMes)}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${gananciaPositiva ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                {gananciaPositiva ? "Positiva" : "Negativa"}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// PANTALLA: Taller
function PantallaTaller({ cfg, setCfg, showToast }) {
  const { margen, horaCliente, setPrecioConfig, guardar, setFactor } = useTallerConfig({ cfg, setCfg });

  const [editUbicacion, setEditUbicacion] = React.useState(false);
  const [draftLatLng, setDraftLatLng] = React.useState(() => ({
    lat: cfg.lat ?? null,
    lng: cfg.lng ?? null,
  }));

  React.useEffect(() => {
    if (editUbicacion) return;
    setDraftLatLng({ lat: cfg.lat ?? null, lng: cfg.lng ?? null });
  }, [cfg.lat, cfg.lng, editUbicacion]);

  React.useEffect(() => {
    const loginEmail = auth.currentUser?.email;
    if (!cfg.emailNotificacion && loginEmail) {
      setCfg(prev => ({ ...prev, emailNotificacion: loginEmail }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGuardar = () => {
    guardar();
    showToast("Cambios guardados.");
  };

  return (
    <div className="space-y-4">
      {/* Datos del taller */}
      <Card>
        <SectionTitle>Datos del Taller</SectionTitle>
        <div className="space-y-3">
          {[
            ["nombreTaller",        "Nombre del Taller", "text"],
            ["mecanicoResponsable", "Responsable",       "text"],
            ["dniMecanico",         "DNI",               "text"],
            ["direccionTaller",     "Dirección",         "text"],
            ["telefonoTaller",      "Telefono",          "tel"],
            ["emailNotificacion",   "Mail del taller",   "email"],
          ].map(([field, label, type]) => (
            <div key={field}>
              <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">{label}</label>
              <input
                type={type}
                value={cfg[field] ?? ""}
                onChange={e => setCfg({ ...cfg, [field]: e.target.value })}
                className="w-full border-2 border-zinc-100 rounded-2xl px-4 py-3 font-bold text-zinc-800 outline-none focus:border-orange-500 transition-colors bg-zinc-50"
              />
            </div>
          ))}

          {/* Email de notificaciones — sincronizado al doc de suscripción */}
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Email para notificaciones</label>
            <input
              type="email"
              value={cfg.emailNotificacion ?? ""}
              onChange={e => setCfg({ ...cfg, emailNotificacion: e.target.value })}
              placeholder={auth.currentUser?.email || "tu@email.com"}
              className="w-full border-2 border-zinc-100 rounded-2xl px-4 py-3 font-bold text-zinc-800 outline-none focus:border-orange-500 transition-colors bg-zinc-50"
            />
            <p className="text-[10px] text-zinc-400 font-bold mt-1 ml-1">
              Recibís recibos de pago, alertas de vencimiento y cambios de plan.
              {auth.currentUser?.email && cfg.emailNotificacion === auth.currentUser.email && (
                <span className="text-green-600"> - Mismo mail de login</span>
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Ubicacion del taller — ciudad, provincia y pin en mapa */}
      <Card>
        <SectionTitle>Ubicación del taller</SectionTitle>
        <p className="text-[10px] text-zinc-400 font-bold mb-4">
          Tocá el mapa para colocar el pin o arrastralo. Esta posición aparece en el mapa público de MotoGestión.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Ciudad</label>
            <input
              type="text"
              value={cfg.ciudadTaller ?? ""}
              onChange={e => setCfg({ ...cfg, ciudadTaller: e.target.value })}
              placeholder="Ej: Gualeguaychú"
              className="w-full border-2 border-zinc-100 rounded-2xl px-4 py-3 font-bold text-zinc-800 outline-none focus:border-orange-500 transition-colors bg-zinc-50"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Provincia</label>
            <input
              type="text"
              value={cfg.provinciaTaller ?? ""}
              onChange={e => setCfg({ ...cfg, provinciaTaller: e.target.value })}
              placeholder="Ej: Entre Ríos"
              className="w-full border-2 border-zinc-100 rounded-2xl px-4 py-3 font-bold text-zinc-800 outline-none focus:border-orange-500 transition-colors bg-zinc-50"
            />
          </div>
        </div>
        <MapaPicker
          lat={draftLatLng.lat}
          lng={draftLatLng.lng}
          editable={editUbicacion}
          onChange={(la, lo) => setDraftLatLng({ lat: la, lng: lo })}
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          {editUbicacion ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setCfg((prev) => {
                    const next = { ...prev, lat: draftLatLng.lat ?? null, lng: draftLatLng.lng ?? null };
                    // Si el usuario no completó Dirección, usamos ciudad/provincia como default seguro.
                    if (!String(next.direccionTaller || "").trim()) {
                      const c = String(next.ciudadTaller || "").trim();
                      const p = String(next.provinciaTaller || "").trim();
                      if (c || p) next.direccionTaller = [c, p].filter(Boolean).join(", ");
                    }
                    return next;
                  });
                  setEditUbicacion(false);
                  showToast("Ubicación guardada");
                }}
                className="w-full rounded-2xl bg-zinc-900 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
              >
                Guardar pin
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftLatLng({ lat: cfg.lat ?? null, lng: cfg.lng ?? null });
                  setEditUbicacion(false);
                  showToast("Cambios descartados");
                }}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 active:scale-95 transition-all"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setEditUbicacion(true)}
                className="col-span-2 w-full rounded-2xl border border-zinc-200 bg-white py-3 text-[10px] font-black uppercase tracking-widest text-zinc-900 active:scale-95 transition-all"
              >
                Cambiar ubicación
              </button>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            if (!navigator.geolocation) { showToast("Geolocalización no disponible en este dispositivo"); return; }
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                const la = Math.round(pos.coords.latitude  * 1e6) / 1e6;
                const lo = Math.round(pos.coords.longitude * 1e6) / 1e6;
                setEditUbicacion(true);
                setDraftLatLng({ lat: la, lng: lo });
                showToast("Ubicación detectada");
              },
              () => showToast("No se pudo obtener la ubicación. Activá el GPS o tocá el mapa directamente.")
            );
          }}
          className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 active:scale-95 transition-all"
        >
          Usar mi ubicación actual (GPS)
        </button>
        {draftLatLng.lat && draftLatLng.lng && (
          <p className="text-[10px] text-zinc-400 font-bold mt-2 ml-1">
            Pin: {Number(draftLatLng.lat).toFixed(5)}, {Number(draftLatLng.lng).toFixed(5)} {editUbicacion ? "(sin guardar)" : ""}
          </p>
        )}
      </Card>

      {/* Mano de obra — card unificada con cadena de cálculo */}
      <Card>
        <SectionTitle>Mano de Obra</SectionTitle>

        {/* 1. Costo base */}
        <div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-1">Costo por hora</p>
          <p className="text-[9px] text-zinc-400 font-bold mb-3">Gastos fijos ÷ horas trabajadas al mes</p>
          <Stepper
            value={cfg.valorHoraInterno}
            onChange={v => setPrecioConfig({ ...cfg, valorHoraInterno: v })}
            step={500}
            min={0}
            format={formatMoney}
          />
        </div>

        <div className="h-px bg-zinc-100 my-5" />

        {/* 2. Margen */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Margen de ganancia</p>
            <span className="text-2xl font-black text-orange-600">{margen}%</span>
          </div>
          <input
            type="range" min="5" max="120" step="5"
            value={margen}
            onChange={e => setPrecioConfig({ ...cfg, margenPolitica: Number(e.target.value) })}
            className="w-full accent-orange-600"
          />
          <div className="flex justify-between text-[9px] text-zinc-400 font-bold mt-1">
            <span>5%</span><span>60%</span><span>120%</span>
          </div>
        </div>

        {/* 3. Resultado: precio hora al cliente */}
        <div className="mt-4 bg-zinc-900 rounded-2xl p-4">
          <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-2">Precio hora al cliente</p>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-zinc-400 font-bold">
              {formatMoney(cfg.valorHoraInterno)} × {(1 + margen / 100).toFixed(2)}
            </p>
            <p className="text-2xl font-black text-orange-400">{formatMoney(horaCliente)}</p>
          </div>
        </div>

        <div className="h-px bg-zinc-100 my-5" />

        {/* 4. Multiplicadores por dificultad */}
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Multiplicadores por Dificultad</p>
        <div className="space-y-3">
          {DIFICULTADES.map(({ key, label, color, bg, border }) => {
            const factor = cfg.factorDificultad?.[key] ?? CONFIG_DEFAULT.factorDificultad[key];
            const precioFinal = Math.round(horaCliente * factor);
            return (
              <div key={key} className={`${bg} border ${border} rounded-2xl p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className={`text-sm font-black ${color}`}>{label}</span>
                    <p className="text-[10px] text-zinc-500 font-bold mt-0.5">
                      {formatMoney(horaCliente)} × {factor.toFixed(1)}
                    </p>
                  </div>
                  <span className={`text-lg font-black ${color}`}>
                    {formatMoney(precioFinal)}/h
                  </span>
                </div>
                <Stepper
                  value={factor}
                  onChange={v => setFactor(key, v)}
                  step={0.1}
                  min={0.5}
                  max={5}
                  format={v => `${v.toFixed(1)}x`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Plantilla WhatsApp */}
      <Card>
        <SectionTitle>Plantilla WhatsApp - Próximo control</SectionTitle>
        <p className="text-[10px] text-zinc-400 font-bold mb-3 leading-relaxed">
          Variables: {"{nombreCliente}"} {"{nombreTaller}"} {"{marca}"} {"{modelo}"} {"{patente}"} {"{tipoControl}"}
        </p>
        <textarea
          rows="5"
          value={cfg.whatsappPlantillas?.recordatorioService ?? "Hola {nombreCliente}, te escribimos de {nombreTaller}.\n\nTu moto {marca} {modelo} patente {patente} puede estar cerca del proximo control recomendado: {tipoControl}.\n\nSi queres, podes pasar por el taller y la revisamos para verificarlo."}
          onChange={e => setCfg({ ...cfg, whatsappPlantillas: { ...(cfg.whatsappPlantillas || {}), recordatorioService: e.target.value } })}
          className="w-full border-2 border-zinc-100 rounded-2xl p-4 font-bold text-xs text-zinc-800 bg-zinc-50 outline-none focus:border-orange-500 resize-none"
        />
      </Card>

      {/* Datos de Cobro */}
      <Card>
        <SectionTitle>Datos de Cobro</SectionTitle>
        <p className="text-[10px] text-zinc-400 font-bold mb-4">Se usan para generar mensajes de presupuesto automáticamente</p>
        <div className="space-y-3">
          {[
            ["datosCobro.titular",    "Titular de cuenta", "text"],
            ["datosCobro.banco",      "Banco / Billetera", "text"],
            ["datosCobro.alias",      "Alias",             "text"],
            ["datosCobro.cbu",        "CBU / CVU",         "text"],
            ["datosCobro.cuit",       "CUIT / CUIL",       "text"],
            ["datosCobro.tipoCuenta", "Tipo de cuenta",    "text"],
          ].map(([field, label, type]) => {
            const [parent, child] = field.split(".");
            const val = cfg[parent]?.[child] ?? "";
            return (
              <div key={field}>
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">{label}</label>
                <input
                  type={type}
                  value={val}
                  onChange={e => setCfg({ ...cfg, [parent]: { ...(cfg[parent] || {}), [child]: e.target.value } })}
                  className="w-full border-2 border-zinc-100 rounded-2xl px-4 py-3 font-bold text-zinc-800 outline-none focus:border-orange-500 transition-colors bg-zinc-50"
                />
              </div>
            );
          })}
          {(cfg.datosCobro?.alias || cfg.datosCobro?.cbu) && (
            <div className="flex gap-2 pt-1">
              {cfg.datosCobro?.alias && (
                <button
                  onClick={() => { navigator.clipboard?.writeText(cfg.datosCobro.alias); }}
                  className="flex-1 py-2.5 rounded-2xl bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase active:scale-95"
                >
                  Copiar alias
                </button>
              )}
              {cfg.datosCobro?.cbu && (
                <button
                  onClick={() => { navigator.clipboard?.writeText(cfg.datosCobro.cbu); }}
                  className="flex-1 py-2.5 rounded-2xl bg-zinc-100 text-zinc-600 text-[10px] font-black uppercase active:scale-95"
                >
                  Copiar CBU
                </button>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Configuracion de Presupuestos */}
      <Card>
        <SectionTitle>Configuracion de Presupuestos</SectionTitle>
        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-3">Adelanto predeterminado</label>
            <div className="grid grid-cols-4 gap-2">
              {[0, 25, 30, 50, 70].map(pct => (
                <button
                  key={pct}
                  onClick={() => setCfg({ ...cfg, presupuestoConfig: { ...(cfg.presupuestoConfig || {}), adelantoPct: pct } })}
                  className={`py-3 rounded-2xl text-sm font-black uppercase transition-all active:scale-95 ${
                    (cfg.presupuestoConfig?.adelantoPct ?? 30) === pct
                      ? "bg-orange-600 text-white"
                      : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
          {[
            ["incluirAlias",       "Incluir alias en el mensaje"],
            ["incluirCBU",         "Incluir CBU en el mensaje"],
            ["advertenciaAbierto", "Mostrar advertencia de presupuesto abierto"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm font-bold text-zinc-700">{label}</span>
              <button
                onClick={() => setCfg({ ...cfg, presupuestoConfig: { ...(cfg.presupuestoConfig || {}), [key]: !(cfg.presupuestoConfig?.[key] ?? true) } })}
                className={`w-12 h-6 rounded-full transition-all ${(cfg.presupuestoConfig?.[key] ?? true) ? "bg-orange-600" : "bg-zinc-300"}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${(cfg.presupuestoConfig?.[key] ?? true) ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Descuento por Calificación */}
      <Card>
        <SectionTitle>Descuento por Calificación</SectionTitle>
        <p className="text-[10px] text-zinc-400 font-bold mb-4">
          El cliente recibe este beneficio al calificar una atención. Se aplica automáticamente en la próxima atención del mismo vehículo.
        </p>
        <div>
          <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">
            Porcentaje de descuento
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min="0"
              max="50"
              value={cfg.descuentoCalificacionPct ?? 15}
              onChange={e => {
                const v = Math.max(0, Math.min(50, Number(e.target.value) || 0));
                setCfg({ ...cfg, descuentoCalificacionPct: v });
              }}
              className="w-28 border-2 border-zinc-100 rounded-2xl px-4 py-3 text-2xl font-black text-orange-600 text-center outline-none focus:border-orange-500 transition-colors bg-zinc-50"
            />
            <span className="text-2xl font-black text-zinc-400">%</span>
            <span className="text-xs text-zinc-400 leading-tight">sobre el total<br/>del trabajo</span>
          </div>
          <div className="flex gap-2 mt-3">
            {[5, 10, 15, 20, 25].map(v => (
              <button
                key={v}
                onClick={() => setCfg({ ...cfg, descuentoCalificacionPct: v })}
                className={`flex-1 py-2 rounded-xl text-xs font-black uppercase transition-all active:scale-95 ${
                  (cfg.descuentoCalificacionPct ?? 15) === v
                    ? "bg-orange-600 text-white"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {v}%
              </button>
            ))}
          </div>
        </div>
      </Card>

      <button
        onClick={handleGuardar}
        className="w-full bg-orange-600 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
      >
        Guardar cambios
      </button>
    </div>
  );
}

// PANTALLA: Datos
function PantallaDatos({ orders, bikes, clients, cfg, showToast, bkpEstado, setBkpEstado, fileInputRef, handleRestaurarArchivo, handleRestaurarAuto }) {
  const {
    backups, loadingBackups, guardandoBkp, restaurando, restoreStateInfo,
    cargarBackups, guardarEnNube, ejecutarRestauracion,
  } = useBackupPanel();

  const [cloudRestoreConfirm, setCloudRestoreConfirm] = React.useState(null);
  const [confirmText,         setConfirmText]         = React.useState("");
  const [integrityResult,     setIntegrityResult]     = React.useState(null);
  const [datosView,           setDatosView]           = React.useState("menu");

  React.useEffect(() => {
    cargarBackups().then((err) => { if (err) showToast(err); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGuardarEnNube = async () => {
    const { mensaje } = await guardarEnNube();
    showToast(mensaje);
  };

  const handleRestaurarNube = (backup) => {
    setCloudRestoreConfirm(backup);
    setConfirmText("");
  };

  const ejecutarRestauracionNube = async () => {
    const backup = cloudRestoreConfirm;
    setCloudRestoreConfirm(null);
    setConfirmText("");
    const { ok, mensaje } = await ejecutarRestauracion(backup);
    showToast(mensaje);
    if (ok) setTimeout(() => window.location.reload(), 1500);
  };

  const SubHeader = ({ title, onBack }) => (
    <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 font-black text-[10px] uppercase tracking-widest mb-4 active:opacity-60 transition-opacity">
      <ChevronLeft size={14} /> {title}
    </button>
  );

  if (datosView === "backups") return (
    <div className="space-y-4">
      <SubHeader title="Volver" onBack={() => setDatosView("menu")} />

      {/* Backup local */}
      <Card>
        <SectionTitle>Copia de seguridad local</SectionTitle>
        <p className="text-[10px] text-zinc-400 font-bold mb-3 leading-relaxed">
          Guardá una copia completa de la información del taller en este dispositivo. Incluye clientes, motos, trabajos, presupuestos, caja, repuestos, turnos, recordatorios y configuración.
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Última copia local</p>
            <p className="text-xs font-black text-zinc-700">{tiempoDesde(bkpEstado.ultimoManual) || "Nunca"}</p>
          </div>
          <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Copia automática</p>
            <p className="text-xs font-black text-zinc-700">{tiempoDesde(bkpEstado.ultimoAuto) || "Nunca"}</p>
          </div>
        </div>
        <div className="space-y-2">
          <button
            onClick={() => { descargarBackup(); setBkpEstado(estadoBackup()); showToast("Copia descargada. Guardá ese archivo en un lugar seguro."); }}
            className="w-full flex items-center justify-between bg-orange-600 text-white rounded-2xl p-5 active:scale-[0.98] transition-all shadow-md"
          >
            <div className="text-left">
              <p className="text-sm font-black uppercase">Descargar copia completa</p>
              <p className="text-[10px] font-bold text-orange-100 mt-0.5">Archivo .json verificable para recuperar los datos del taller si algo falla.</p>
            </div>
            <Download size={20} />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between bg-zinc-900 text-white rounded-2xl p-5 active:scale-[0.98] transition-all"
          >
            <div className="text-left">
              <p className="text-sm font-black uppercase">Restaurar desde archivo local</p>
              <p className="text-[10px] font-bold text-zinc-400 mt-0.5">Usá esta opción solo si necesitás recuperar información desde una copia anterior.</p>
            </div>
            <RotateCcw size={20} />
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestaurarArchivo} className="hidden" />
          {bkpEstado.tieneAuto && (
            <button
              onClick={handleRestaurarAuto}
              className="w-full flex items-center justify-between bg-zinc-50 border border-zinc-200 text-zinc-700 rounded-2xl p-4 active:scale-[0.98] transition-all"
            >
              <div className="text-left">
                <p className="text-sm font-black">Restaurar auto-guardado</p>
                <p className="text-[10px] text-zinc-400 font-bold mt-0.5">Guardado {tiempoDesde(bkpEstado.ultimoAuto)}</p>
              </div>
              <RotateCcw size={16} className="text-zinc-500" />
            </button>
          )}
        </div>
      </Card>

      {/* Backup en la nube */}
      <Card>
        <SectionTitle>Copias en la nube</SectionTitle>
        <p className="text-[10px] text-zinc-400 font-bold mb-3 leading-relaxed">
          Las copias en la nube protegen la información del taller y permiten recuperarla desde otro dispositivo. La app puede crear una copia automática una vez por día.
        </p>
        <button
          onClick={handleGuardarEnNube}
          disabled={guardandoBkp}
          className="w-full flex items-center justify-between bg-orange-600 text-white rounded-2xl p-5 active:scale-[0.98] transition-all shadow-md mb-3 disabled:opacity-50"
        >
          <div className="text-left">
            <p className="text-sm font-black uppercase">{guardandoBkp ? "Guardando..." : "Guardar copia en la nube"}</p>
            <p className="text-[10px] font-bold text-orange-100 mt-0.5">Crea una copia completa y verificable en la nube.</p>
          </div>
          <HardDrive size={20} />
        </button>
        {loadingBackups ? (
          <p className="text-center text-[10px] text-zinc-400 font-bold py-4">Cargando copias...</p>
        ) : backups.length === 0 ? (
          <p className="text-center text-[10px] text-zinc-400 font-bold py-4">Todavía no hay copias guardadas en la nube.</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-2">Copias disponibles (últimas {backups.length})</p>
            {backups.map((b) => {
              const integ = b.integrity;
              const hasErrors = integ && !integ.ok;
              const hasWarnings = integ && integ.ok && integ.warnings?.length > 0;
              return (
                <div key={b.id} className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black text-zinc-800">{new Date(b.fecha).toLocaleString("es-AR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[9px] font-bold text-zinc-400">{b.total} registros</p>
                        {hasErrors && <span className="text-[9px] font-black text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">No restaurable</span>}
                        {hasWarnings && <span className="text-[9px] font-black text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{integ.warnings.length} advert.</span>}
                        {integ && !hasErrors && !hasWarnings && <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">Sin errores</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRestaurarNube(b)}
                      disabled={restaurando === b.id}
                      className="bg-zinc-800 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all disabled:opacity-50 shrink-0 ml-3"
                    >
                      {restaurando === b.id ? "..." : "Ver / Restaurar"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {restoreStateInfo && (
        <div className={`rounded-2xl border p-3 ${restoreStateInfo.status === "completed" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
          <p className={`text-[9px] font-black uppercase tracking-widest ${restoreStateInfo.status === "completed" ? "text-emerald-700" : "text-red-700"}`}>Última restauración</p>
          {restoreStateInfo.status === "completed" ? (
            <>
              <p className="text-xs font-black text-emerald-900 mt-1">Completada el {new Date(restoreStateInfo.completedAt).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              <p className="text-[10px] font-bold text-emerald-700 mt-0.5">{restoreStateInfo.restoredCount} registros recuperados</p>
            </>
          ) : (
            <>
              <p className="text-xs font-black text-red-900 mt-1">Fallida — {restoreStateInfo.failedAt ? new Date(restoreStateInfo.failedAt).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "fecha desconocida"}</p>
              <p className="text-[10px] font-bold text-red-700 mt-0.5">{restoreStateInfo.error || "Error desconocido"}</p>
            </>
          )}
        </div>
      )}

      {cloudRestoreConfirm && (
        <div className="fixed inset-0 bg-black/80 z-[200] flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] p-6 w-full max-w-sm space-y-4 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div>
              <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mb-1">Restaurar copia de seguridad</p>
              <p className="text-sm font-black text-zinc-900 leading-snug">Esta acción reemplaza la información actual del taller por la información guardada en la copia seleccionada.</p>
            </div>
            <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-zinc-500 font-bold">Fecha</span><span className="text-zinc-800 font-black">{new Date(cloudRestoreConfirm.fecha).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500 font-bold">Registros</span><span className="text-zinc-800 font-black">{cloudRestoreConfirm.total}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500 font-bold">Errores críticos</span><span className={`font-black ${(cloudRestoreConfirm.integrity?.errors?.length || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>{cloudRestoreConfirm.integrity?.errors?.length || 0}</span></div>
              <div className="flex justify-between"><span className="text-zinc-500 font-bold">Advertencias</span><span className={`font-black ${(cloudRestoreConfirm.integrity?.warnings?.length || 0) > 0 ? "text-amber-600" : "text-zinc-800"}`}>{cloudRestoreConfirm.integrity?.warnings?.length || 0}</span></div>
            </div>
            {!cloudRestoreConfirm.integrity?.ok ? (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-3">
                <p className="text-xs font-black text-red-700">Esta copia no se puede restaurar porque tiene errores críticos. La información actual no fue modificada.</p>
              </div>
            ) : (
              <>
                {cloudRestoreConfirm.integrity?.warnings?.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                    <p className="text-xs font-black text-amber-700">Esta copia tiene advertencias. Podés restaurarla, pero conviene revisar el detalle.</p>
                  </div>
                )}
                <p className="text-[10px] text-zinc-500 font-bold">Antes de restaurar, el sistema intentará crear una copia de seguridad del estado actual.</p>
                <div>
                  <p className="text-[10px] font-black text-zinc-700 uppercase tracking-widest mb-2">Para confirmar, escribí RESTAURAR:</p>
                  <input type="text" value={confirmText} onChange={(e) => setConfirmText(e.target.value.toUpperCase())} placeholder="RESTAURAR" autoCapitalize="characters" className="w-full border-2 border-zinc-200 rounded-2xl px-4 py-3 text-sm font-black text-center uppercase tracking-widest focus:border-orange-400 outline-none" />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { setCloudRestoreConfirm(null); setConfirmText(""); }} className="bg-zinc-100 text-zinc-700 py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95">Cancelar</button>
              <button disabled={!cloudRestoreConfirm.integrity?.ok || confirmText !== "RESTAURAR"} onClick={ejecutarRestauracionNube} className="bg-orange-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 disabled:opacity-40">Restaurar datos</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (datosView === "exportaciones") return (
    <div className="space-y-4">
      <SubHeader title="Volver" onBack={() => setDatosView("menu")} />
      <Card>
        <SectionTitle>Exportar datos</SectionTitle>
        <button
          onClick={() => { exportarOrdenes(orders, bikes, clients); showToast("Preparando archivo CSV..."); }}
          className="w-full flex items-center justify-between bg-green-600 text-white rounded-2xl p-5 active:scale-[0.98] transition-all shadow-md mb-4"
        >
          <div className="text-left">
            <p className="text-sm font-black uppercase">Exportar trabajos (CSV)</p>
            <p className="text-[10px] font-bold text-green-100 mt-0.5">Todos los trabajos con detalle</p>
          </div>
          <FileSpreadsheet size={22} />
        </button>
        <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Exportaciones disponibles</p>
        <div className="space-y-2">
          {[
            { label: "Clientes",             sub: `${clients.length} registros`,   fn: () => { exportarClientes(clients, orders); showToast("Preparando archivo de clientes..."); } },
            { label: "Balance mensual",      sub: "Totales por mes",               fn: () => { exportarBalance(orders);           showToast("Preparando balance mensual..."); } },
            { label: "Repuestos utilizados", sub: "Ranking por uso",               fn: () => { exportarRepuestos(orders);         showToast("Preparando archivo de repuestos..."); } },
          ].map(({ label, sub, fn }) => (
            <button key={label} onClick={fn} className="w-full flex items-center justify-between bg-zinc-50 border border-zinc-100 rounded-2xl p-4 active:scale-[0.98] transition-all">
              <div className="text-left">
                <p className="text-sm font-black text-zinc-800">{label}</p>
                <p className="text-[10px] text-zinc-400 font-bold">{sub}</p>
              </div>
              <Download size={16} className="text-orange-500" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );

  if (datosView === "integridad") return (
    <div className="space-y-4">
      <SubHeader title="Volver" onBack={() => setDatosView("menu")} />
      <Card>
        <SectionTitle>Integridad de datos</SectionTitle>
        <p className="text-[10px] text-zinc-400 font-bold mb-3 leading-relaxed">
          Revisá si la información actual está completa, correctamente vinculada y lista para respaldarse o restaurarse.
        </p>
        <button
          onClick={() => setIntegrityResult(runIntegrityCheckFromCache())}
          className="w-full flex items-center justify-center gap-2 bg-zinc-50 border border-zinc-200 text-zinc-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
        >
          <Shield size={14} /> Verificar integridad actual
        </button>
        {integrityResult && (
          <div className={`mt-3 rounded-2xl border p-4 space-y-2 ${integrityResult.ok ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center justify-between">
              <p className={`text-[9px] font-black uppercase tracking-widest ${integrityResult.ok ? "text-emerald-700" : "text-red-700"}`}>
                {integrityResult.ok ? "Estado: Correcto" : "Estado: Errores encontrados"}
              </p>
              <p className="text-[9px] font-bold text-zinc-500">{integrityResult.total} registros</p>
            </div>
            {integrityResult.errors.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-red-700 uppercase">Errores ({integrityResult.errors.length})</p>
                {integrityResult.errors.slice(0, 5).map((e, i) => <p key={i} className="text-[9px] text-red-600">{e}</p>)}
              </div>
            )}
            {integrityResult.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-[9px] font-black text-amber-700 uppercase">Advertencias ({integrityResult.warnings.length})</p>
                {integrityResult.warnings.slice(0, 5).map((w, i) => <p key={i} className="text-[9px] text-amber-600">{w}</p>)}
                {integrityResult.warnings.length > 5 && <p className="text-[9px] text-zinc-400">...y {integrityResult.warnings.length - 5} más</p>}
              </div>
            )}
            {integrityResult.ok && integrityResult.warnings.length === 0 && (
              <p className="text-xs font-black text-emerald-700">Sin errores ni advertencias.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );

  // menu (default)
  return (
    <div className="space-y-4">
      {/* Menú principal */}
      <Card>
        <SectionTitle>Datos y seguridad</SectionTitle>
        <div className="space-y-2">
          {[
            {
              icon: <HardDrive size={18} className="text-orange-500" />,
              label: "Copias de seguridad",
              sub: bkpEstado.ultimoManual ? `Última copia local ${tiempoDesde(bkpEstado.ultimoManual)}` : "Sin copias locales todavía",
              view: "backups",
            },
            {
              icon: <FileSpreadsheet size={18} className="text-green-500" />,
              label: "Exportaciones",
              sub: "CSV de trabajos, clientes, balance y repuestos",
              view: "exportaciones",
            },
            {
              icon: <Shield size={18} className="text-zinc-500" />,
              label: "Integridad de datos",
              sub: integrityResult ? (integrityResult.ok ? `Sin errores · ${integrityResult.total} registros` : `${integrityResult.errors.length} errores encontrados`) : "Verificá el estado de la información",
              view: "integridad",
            },
          ].map(({ icon, label, sub, view }) => (
            <button
              key={view}
              onClick={() => setDatosView(view)}
              className="w-full flex items-center gap-4 bg-zinc-50 border border-zinc-100 rounded-2xl p-4 active:scale-[0.98] transition-all text-left"
            >
              <div className="shrink-0">{icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-zinc-800">{label}</p>
                <p className="text-[10px] text-zinc-400 font-bold truncate">{sub}</p>
              </div>
              <ChevronRight size={16} className="text-zinc-300 shrink-0" />
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

// PANTALLA: Sistema
function PantallaSuscripcion({ showToast }) {
  const [loading, setLoading] = React.useState(true);
  const [account, setAccount] = React.useState(null);
  const [settings, setSettings] = React.useState(DEFAULT_ADMIN_SETTINGS);
  const [invoices, setInvoices] = React.useState([]);
  const [paymentResult, setPaymentResult] = React.useState(null); // ok | error | pendiente | null
  const [lastAttempt, setLastAttempt] = React.useState(null); // { invoiceId, preferenceId, mode, planKey, at }
  const [note, setNote] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [checkoutPlanKey, setCheckoutPlanKey] = React.useState(null);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [cancelReasonCode, setCancelReasonCode] = React.useState("caro");
  const [cancelReasonText, setCancelReasonText] = React.useState("");
  const [cancelComment, setCancelComment] = React.useState("");
  const uid = auth.currentUser?.uid;

  const cargar = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      // Cargar settings y usuario de forma independiente a las facturas
      const [usuario, global] = await Promise.all([
        leerUsuarioSaas(uid),
        leerAdminSettings(),
      ]);
      setAccount(usuario);
      setSettings(global);
    } catch (error) {
      console.error(error);
      showToast("No se pudo cargar la suscripción");
    } finally {
      setLoading(false);
    }
    // Facturas en subcollection del usuario — falla silencioso para no bloquear settings
    try {
      const invoicesSnap = await getDocs(
        query(collection(db, "usuarios", uid, "billingInvoices"), orderBy("fecha", "desc"), limit(5))
      );
      setInvoices(invoicesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.warn("No se pudieron cargar facturas:", e.message);
    }
  };

  React.useEffect(() => {
    cargar();
  }, [uid]);

  React.useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search || "");
      const pago = params.get("pago");
      const cs = params.get("collection_status");
      let result = null;
      if (pago === "ok" || pago === "error" || pago === "pendiente") {
        result = pago;
      } else if (cs === "approved") {
        result = "ok";
      } else if (cs === "rejected" || cs === "cancelled") {
        result = "error";
      } else if (cs === "pending" || cs === "in_process") {
        result = "pendiente";
      }
      setPaymentResult(result);
    } catch {
      setPaymentResult(null);
    }

    try {
      const raw = window.localStorage.getItem("jbos_last_mp_attempt");
      setLastAttempt(raw ? JSON.parse(raw) : null);
    } catch {
      setLastAttempt(null);
    }
  }, []);

  const planKey = String(account?.currentPlanKey || account?.plan || "base");
  const planLabel =
    account?.estado === "trial"
      ? "Prueba"
      : settings?.plans?.[planKey]?.label ||
        (planKey === "pro" ? "Trimestral" : planKey === "full" ? "Anual" : "Mensual");
  const estadoLabel = account?.estado === "activo" ? "Activa" : account?.estado === "trial" ? "En prueba" : "Vencida";
  const activoHasta = normalizeDateMs(account?.activoHasta || account?.trialEndsAt || account?.nextBillingAt);
  const previousPlanKey = account?.previousPlanKey || "";
  const latestInvoiceAttempt = React.useMemo(() => {
    const latest = invoices[0];
    if (!latest) return null;
    return {
      invoiceId: latest.invoiceId || latest.id || null,
      preferenceId: latest.preferenceId || null,
      mode: latest.mpMode || null,
      tokenMode: latest.mercadoPagoTokenMode || null,
      planKey: latest.planKey || null,
      at: normalizeDateMs(latest.updatedAt) || normalizeDateMs(latest.createdAt) || null,
      status: latest.status || null,
      errorMessage: latest.errorMessage || latest.errorText || null,
      mpStatus: latest.errorHttpStatus || null,
    };
  }, [invoices]);
  const activeAttempt = React.useMemo(() => {
    if (!lastAttempt) return latestInvoiceAttempt;
    if (!latestInvoiceAttempt) return lastAttempt;
    const localAt = Number(lastAttempt.at || 0);
    const invoiceAt = Number(latestInvoiceAttempt.at || 0);
    return invoiceAt >= localAt ? latestInvoiceAttempt : lastAttempt;
  }, [lastAttempt, latestInvoiceAttempt]);
  const checkoutPlan = checkoutPlanKey ? (settings.plans?.[checkoutPlanKey] ?? { label: PLAN_LABELS[checkoutPlanKey] || checkoutPlanKey }) : null;
  const checkoutPrice = settings.plans?.[checkoutPlanKey]?.price ?? settings.precios?.[checkoutPlanKey] ?? 0;

  const persistPaymentAttempt = (attempt) => {
    if (!attempt?.invoiceId && !attempt?.preferenceId) return;
    const normalized = {
      invoiceId: attempt.invoiceId || null,
      preferenceId: attempt.preferenceId || null,
      mode: attempt.mode || null,
      tokenMode: attempt.tokenMode || null,
      planKey: attempt.planKey || null,
      at: attempt.at || Date.now(),
      status: attempt.status || null,
      errorMessage: attempt.errorMessage || null,
      mpStatus: attempt.mpStatus || null,
    };
    try {
      window.localStorage.setItem("jbos_last_mp_attempt", JSON.stringify(normalized));
    } catch {
      // ignore
    }
    setLastAttempt(normalized);
  };

  const abrirConfirmacionPago = (planKey) => {
    setCheckoutPlanKey(planKey);
  };

  const cerrarConfirmacionPago = () => {
    setCheckoutPlanKey(null);
  };

  const irAPagar = async (planKey) => {
    try {
      setSending(true);
      setCheckoutPlanKey(null);
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/mp-create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          uid,
          plan: planKey,
          planLabel: settings.plans?.[planKey]?.label || planKey,
          planPrice: settings.precios?.[planKey] ?? 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        const statusLine = res?.status ? `HTTP ${res.status}` : "";
        const hint = String(data.error || data.mpMessage || "").includes("MP_ACCESS_TOKEN")
          ? " (configuración del servidor)"
          : "";
        persistPaymentAttempt({
          invoiceId: data.invoiceId || null,
          preferenceId: data.preferenceId || null,
          planKey,
          tokenMode: data.tokenMode || null,
          at: Date.now(),
          status: "error",
          errorMessage: [data.mpMessage, data.error, statusLine ? `${statusLine}${hint}` : ""].filter(Boolean).join(" · ") || null,
          mpStatus: data.mpStatus || null,
        });
        await cargar();
        throw new Error([data.error, data.mpMessage, statusLine ? `${statusLine}${hint}` : ""].filter(Boolean).join(" · ") || "No se pudo generar el pago");
      }

      persistPaymentAttempt({
        invoiceId: data.invoiceId || null,
        preferenceId: data.preferenceId || null,
        mode: data.mode || null,
        tokenMode: data.tokenMode || null,
        planKey,
        at: Date.now(),
      });
      if (data.mode === "sandbox") {
        showToast("Pago en modo SANDBOX: entra con usuario COMPRADOR de prueba y usá tarjeta de prueba.");
      }
      window.location.href = data.url;
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo iniciar el pago");
      setSending(false);
    }
  };

  const guardarPedido = async (patch, okMessage) => {
    try {
      setSending(true);
      await actualizarSuscripcionUsuario(uid, patch);
      showToast(okMessage);
      await cargar();
    } catch (error) {
      console.error(error);
      showToast("No se pudo guardar el pedido");
    } finally {
      setSending(false);
    }
  };

  const cancelarConFeedback = async () => {
    try {
      setSending(true);
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/cancel-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          reasonCode: cancelReasonCode,
          reasonText: cancelReasonText,
          comment: cancelComment,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cancelar");
      setCancelOpen(false);
      showToast("Cancelación registrada. Te enviamos un correo con una opción para reactivar.");
      await cargar();
    } catch (e) {
      console.error(e);
      showToast(e.message || "No se pudo cancelar");
    } finally {
      setSending(false);
    }
  };

  const enviarReclamo = async () => {
    if (!note.trim()) {
      showToast("Escribí el reclamo antes de enviarlo");
      return;
    }
    try {
      setSending(true);
      await crearTicketSoporte({
        uid,
        email: auth.currentUser?.email || "",
        tipo: "reclamo_suscripcion",
        mensaje: note.trim(),
        currentPlanKey: account?.currentPlanKey || "",
      });
      setNote("");
      showToast("Reclamo enviado al administrador");
    } catch (error) {
      console.error(error);
      showToast("No se pudo enviar el reclamo");
    } finally {
      setSending(false);
    }
  };

  const diagnosticarPago = async () => {
    try {
      setSending(true);
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/mp-diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({
          preferenceId: activeAttempt?.preferenceId || null,
          invoiceId: activeAttempt?.invoiceId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo diagnosticar");

      const payment = Array.isArray(data.payments) && data.payments.length ? data.payments[0] : null;
      const status = payment?.status || payment?.status_detail || null;
      const detail = payment?.status_detail || null;

      if (!payment) {
        const invoiceError = data.invoice?.errorMessage || data.invoice?.errorText || data.preferenceError || data.paymentsError;
        if (invoiceError) {
          showToast(String(invoiceError).slice(0, 180));
          return;
        }
        if (data.preference) {
          showToast("Preferencia creada, pero Mercado Pago no registro pago. Revisa que el comprador sea usuario test distinto.");
          return;
        }
        showToast("Sin pagos asociados todavía. Proba de nuevo en 30s.");
        return;
      }

      showToast(`MP: ${String(status || "sin estado")} ${detail ? `(${detail})` : ""}`.trim());
    } catch (error) {
      console.error(error);
      showToast(error.message || "No se pudo diagnosticar el pago");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <SectionTitle>Suscripción</SectionTitle>
        <p className="text-sm font-black text-zinc-500">Cargando estado actual...</p>
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle>Suscripción</SectionTitle>
      <div className="space-y-3">
        {paymentResult === "error" && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-rose-700">Pago rechazado</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-rose-800">
              Mercado Pago devolvió un error. En sandbox, lo más común es:
            </p>
            <ul className="mt-2 space-y-1 text-[11px] font-bold text-rose-800">
              <li>Estás logueado con el usuario vendedor (tu cuenta) en vez de un comprador de prueba.</li>
              <li>Comprador y vendedor son el mismo usuario (no se puede).</li>
              <li>La tarjeta es de prueba, pero el comprador no es de prueba.</li>
            </ul>
            {activeAttempt?.invoiceId && (
              <div className="mt-3 bg-white/70 border border-rose-200 rounded-xl p-3">
                <p className="text-[9px] font-black uppercase tracking-widest text-rose-700">Último intento</p>
                <p className="mt-1 text-[10px] font-black text-rose-900">Invoice: {activeAttempt.invoiceId}</p>
                {activeAttempt.preferenceId && (
                  <p className="text-[10px] font-black text-rose-900">Preference: {activeAttempt.preferenceId}</p>
                )}
                {activeAttempt.errorMessage && (
                  <p className="mt-1 text-[10px] font-bold text-rose-800 break-all">{String(activeAttempt.errorMessage).slice(0, 180)}</p>
                )}
              </div>
            )}
            <button
              onClick={diagnosticarPago}
              disabled={sending || (!activeAttempt?.invoiceId && !activeAttempt?.preferenceId)}
              className="mt-3 w-full rounded-2xl bg-zinc-900 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
            >
              {sending ? "Consultando..." : "Diagnosticar pago"}
            </button>
          </div>
        )}

        {paymentResult === "ok" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700">Pago aprobado</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-emerald-800">
              Perfecto. Si el plan no cambia en unos segundos, recargá esta pantalla.
            </p>
          </div>
        )}

        {paymentResult === "pendiente" && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Pago pendiente</p>
            <p className="mt-1 text-[11px] font-bold leading-relaxed text-amber-800">
              Mercado Pago informó que el pago quedó pendiente. Revisalo en unos minutos.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Estado actual</p>
              <p className="mt-1 text-lg font-black text-zinc-800">{estadoLabel}</p>
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Plan actual</p>
              <p className="mt-1 text-lg font-black text-zinc-800">{planLabel}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Vigente hasta</p>
              <p className="mt-1 text-sm font-black text-zinc-700">
                {activoHasta ? new Date(activoHasta).toLocaleString("es-AR") : "Sin fecha"}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Tu token de identificación</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="flex-1 rounded-2xl bg-white px-3 py-3 text-[11px] font-black text-zinc-700 break-all">{uid || "Sin UID"}</p>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(uid || "");
                      showToast("Token copiado");
                    } catch (error) {
                      console.error(error);
                      showToast("No se pudo copiar el token");
                    }
                  }}
                  className="rounded-2xl bg-zinc-900 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white"
                >
                  Copiar
                </button>
              </div>
              <p className="mt-2 text-[10px] font-bold text-zinc-400">
                Usalo para soporte o verificaciones. Es tu identificador único dentro de MotoGestión.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => abrirConfirmacionPago("base")}
            disabled={sending}
            className="rounded-2xl bg-orange-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
          >
            {sending ? "Procesando..." : `${planKey === "base" ? "Renovar" : "Cambiar a"} ${PLAN_LABELS.base} ${formatMoney(settings.precios?.base || 0)}`}
          </button>
          <button
            onClick={() => abrirConfirmacionPago("pro")}
            disabled={sending}
            className="rounded-2xl bg-zinc-900 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
          >
            {sending ? "Procesando..." : `${planKey === "pro" ? "Renovar" : "Cambiar a"} ${PLAN_LABELS.pro} ${formatMoney(settings.precios?.pro || 0)}`}
          </button>
          <button
            onClick={() => abrirConfirmacionPago("full")}
            disabled={sending}
            className="col-span-2 rounded-2xl bg-zinc-800 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
          >
            {sending ? "Procesando..." : `${planKey === "full" ? "Renovar" : "Cambiar a"} ${PLAN_LABELS.full} ${formatMoney(settings.precios?.full || 0)}`}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setCancelOpen(true)}
            disabled={sending}
            className="rounded-2xl bg-red-50 border border-red-100 py-4 text-[10px] font-black uppercase tracking-widest text-red-600 active:scale-95 disabled:opacity-50"
          >
            Cancelar al vencer
          </button>
          <button
            onClick={() => guardarPedido({ requestedAction: "change_plan", requestedPlanKey: previousPlanKey || "base" }, "Pedido enviado para volver al plan anterior")}
            disabled={sending || !previousPlanKey}
            className="rounded-2xl bg-zinc-50 border border-zinc-200 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-700 active:scale-95 disabled:opacity-50"
          >
            Volver al plan anterior
          </button>
        </div>

        {cancelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-[420px] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-2xl">
              <div className="px-5 pt-5 pb-4 border-b border-zinc-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-600">Cancelar al vencer</p>
                <h3 className="mt-1 text-lg font-black text-zinc-900">Ayudanos a mejorar</h3>
                <p className="mt-1 text-xs font-bold text-zinc-500">
                  Esto no cancela ahora. Solo marca tu plan para que no se renueve al vencer.
                </p>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Motivo principal</p>
                  <select
                    value={cancelReasonCode}
                    onChange={(e) => setCancelReasonCode(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-black text-zinc-800 outline-none focus:border-orange-500"
                  >
                    <option value="caro">Está caro</option>
                    <option value="no_uso">No lo estoy usando</option>
                    <option value="funciones">Le faltan funciones</option>
                    <option value="errores">Tuve errores/problemas</option>
                    <option value="competencia">Me paso a otra app</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Detalle (opcional)</p>
                  <input
                    value={cancelReasonText}
                    onChange={(e) => setCancelReasonText(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-bold text-zinc-800 outline-none focus:border-orange-500"
                    placeholder="Ej: necesito multiusuario, integración, etc."
                    maxLength={120}
                  />
                </div>
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Comentario (opcional)</p>
                  <textarea
                    rows={3}
                    value={cancelComment}
                    onChange={(e) => setCancelComment(e.target.value)}
                    className="mt-2 w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs font-bold text-zinc-800 outline-none resize-none focus:border-orange-500"
                    placeholder="Contanos qué pasó y qué te haría volver."
                    maxLength={800}
                  />
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-700">Oferta por única vez</p>
                  <p className="mt-1 text-[11px] font-bold text-amber-800 leading-relaxed">
                    Al confirmar te enviamos un mail con un link de reactivación con descuento (válido por 72hs).
                  </p>
                </div>
              </div>

              <div className="px-5 pb-5 pt-3 border-t border-zinc-100 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setCancelOpen(false)}
                  disabled={sending}
                  className="rounded-2xl bg-zinc-100 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-700 active:scale-95 disabled:opacity-50"
                >
                  Volver
                </button>
                <button
                  onClick={cancelarConFeedback}
                  disabled={sending}
                  className="rounded-2xl bg-red-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
                >
                  {sending ? "Procesando..." : "Confirmar cancelación"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Reclamo, consulta o sugerencia</p>
          <textarea
            rows="4"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Contanos un problema, una duda o una sugerencia de mejora. Tu participación ayuda a que la app sea más eficiente."
            className="mt-3 w-full rounded-2xl border border-zinc-200 p-4 text-xs font-bold text-zinc-700 outline-none resize-none"
          />
          <button
            onClick={enviarReclamo}
            disabled={sending}
            className="mt-3 w-full rounded-2xl bg-emerald-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
          >
            Enviar mensaje al administrador
          </button>
        </div>

        <div className="rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Últimos cobros</p>
          <div className="mt-3 space-y-2">
            {invoices.length === 0 && <p className="text-[11px] font-bold text-zinc-500">Todavía no hay cobros registrados.</p>}
            {invoices.map((item) => (
              <div key={item.id} className="rounded-2xl border border-zinc-100 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-black text-zinc-800">{item.planLabel || item.plan || "Plan"}</p>
                    <p className="text-[10px] font-bold text-zinc-500">{item.status || "pendiente"}</p>
                  </div>
                  <p className="text-sm font-black text-zinc-800">{formatMoney(item.amountPaid || item.amount || 0)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {checkoutPlanKey && checkoutPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/75 p-4 backdrop-blur-sm">
            <div className="flex max-h-[82svh] w-full max-w-[420px] flex-col overflow-hidden rounded-3xl border border-orange-200 bg-white shadow-2xl">
              <div className="flex-1 overflow-y-auto px-4 pb-3 pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-orange-500">Bases y condiciones</p>
                <h3 className="mt-1 text-xl font-black text-zinc-900">
                  {checkoutPlan.label || (checkoutPlanKey === "pro" ? "Trimestral" : "Mensual")}
                </h3>
                <p className="mt-1 text-xs font-bold leading-relaxed text-zinc-600">
                  Antes de ir a Mercado Pago, revisá el plan elegido y el monto a contratar.
                </p>

                <div className="mt-4 rounded-2xl border border-zinc-100 bg-zinc-50 p-4">
                  <div className="grid grid-cols-1 gap-3 text-sm min-[360px]:grid-cols-2">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Monto</p>
                      <p className="mt-1 text-base font-black text-zinc-900">{formatMoney(checkoutPrice)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Duración</p>
                      <p className="mt-1 text-base font-black text-zinc-900">
                        {checkoutPlan.billingDays || 0} días
                      </p>
                    </div>
                    <div className="col-span-full">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Detalle</p>
                      <p className="mt-1 text-[11px] font-bold leading-relaxed text-zinc-700">
                        La suscripción se actualiza cuando Mercado Pago confirme el cobro. Si el pago no se aprueba, el estado actual se mantiene.
                      </p>
                    </div>
                    <div className="col-span-full">
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Importante</p>
                      <ul className="mt-1 space-y-1 text-[11px] font-bold leading-relaxed text-zinc-700">
                        <li>Verificá que el monto coincida con el plan elegido.</li>
                        <li>Al aprobarse, la app se actualiza automáticamente al volver.</li>
                        <li>Si cancelás o el pago falla, conservás el estado actual.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-zinc-100 bg-white p-3 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
                <button
                  onClick={cerrarConfirmacionPago}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 py-4 text-[10px] font-black uppercase tracking-widest text-zinc-700"
                >
                  Volver
                </button>
                <button
                  onClick={() => irAPagar(checkoutPlanKey)}
                  disabled={sending}
                  className="rounded-2xl bg-orange-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
                >
                  {sending ? "Procesando..." : "Ir a Mercado Pago"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function PantallaSistema({ loadDemoData, clearAllData, handleLogout, showToast, cfg, setCfg }) {
  const [migrando, setMigrando] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState("");
  const [deletingAccount, setDeletingAccount] = React.useState(false);

  const handleEliminarCuenta = async () => {
    if (deleteConfirmText !== "ELIMINAR") return;
    setDeletingAccount(true);
    try {
      const uid = auth.currentUser?.uid;
      if (uid) await clearFirestoreData(uid).catch(() => {});
      await deleteUser(auth.currentUser);
    } catch (e) {
      if (e.code === "auth/requires-recent-login") {
        showToast("Cerrá sesión, volvé a ingresar y repetí la operación");
      } else {
        showToast("No se pudo eliminar la cuenta. Intentá de nuevo.");
      }
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
      setDeleteConfirmText("");
    }
  };
  const [remoteBuild, setRemoteBuild] = React.useState(null);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [updatingApp, setUpdatingApp] = React.useState(false);
  const [installAvailable, setInstallAvailable] = React.useState(false);
  const [pushStatus, setPushStatus] = React.useState("inactive");
  const displayMode = getDisplayModeInfo();
  const permissionLabel =
    typeof window !== "undefined" && "Notification" in window ? window.Notification.permission : "no soportado";
  const alertasActivas = cfg.alertasNavegadorActivas ?? true;
  const permisoTexto =
    permissionLabel === "granted"
      ? "Permitido"
      : permissionLabel === "denied"
        ? "Bloqueado"
        : permissionLabel === "default"
          ? "Falta activar"
          : "No disponible";
  const hasRemoteUpdate = isNewerBuild(APP_BUILD, remoteBuild);

  React.useEffect(() => {
    const unbind = bindInstallPromptCapture();
    const syncInstallState = () => setInstallAvailable(canPromptInstall());
    syncInstallState();
    window.addEventListener("jbos-install-available", syncInstallState);
    const checkRemoteBuild = async () => {
      try {
        const remote = await fetchRemoteVersion();
        setRemoteBuild(remote);
      } catch (error) {
        console.error(error);
      }
    };

    checkRemoteBuild();
    getPushStatus().then(setPushStatus).catch(() => {});
    return () => {
      unbind();
      window.removeEventListener("jbos-install-available", syncInstallState);
    };
  }, []);

  const handleMigrarRaiz = async () => {
    setMigrando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Sin sesion");
      const n = await migrateFromRootCollections(uid);
      showToast(n > 0 ? `Migracion completa: ${n} registros movidos` : "Sin datos en colecciones raiz");
    } catch (e) {
      showToast("Error: " + e.message);
    } finally {
      setMigrando(false);
    }
  };

  const handleForzarSync = async () => {
    setMigrando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Sin sesion");
      const n = await forceSyncCacheToFirestore(uid);
      showToast(n > 0 ? `Sincronizado: ${n} registros guardados en la nube` : "No hay datos en memoria para sincronizar");
    } catch (e) {
      showToast("Error: " + e.message);
    } finally {
      setMigrando(false);
    }
  };

  const toggleTestMode = () => {
    const nuevo = { ...cfg, testModeRecordatorios: !cfg.testModeRecordatorios };
    setCfg(nuevo);
    LS.setDoc("config", "global", nuevo);
    showToast(nuevo.testModeRecordatorios ? "Modo prueba activado" : "Modo prueba desactivado");
  };

  const toggleAlertasNavegador = async () => {
    const activar = !(cfg.alertasNavegadorActivas ?? true);
    const uid = auth.currentUser?.uid;
    if (activar) {
      const permiso = await ensureNotificationPermission();
      if (permiso !== "granted") {
        showToast("El navegador no dio permiso para notificar");
      } else if (uid && isPushSupported()) {
        subscribeToPush(uid)
          .then(() => getPushStatus().then(setPushStatus))
          .catch(console.error);
      }
    } else if (uid) {
      unsubscribeFromPush(uid)
        .then(() => setPushStatus("inactive"))
        .catch(console.error);
    }
    const nuevo = { ...cfg, alertasNavegadorActivas: activar };
    setCfg(nuevo);
    LS.setDoc("config", "global", nuevo);
    showToast(activar ? "Alertas del navegador activadas" : "Alertas del navegador desactivadas");
  };

  const probarNotificacion = async () => {
    const result = await sendTestNotification();
    if (result.ok) {
      showToast("Notificación de prueba enviada.");
      return;
    }
    if (result.permission === "denied") {
      showToast("El navegador bloqueo las notificaciones");
      return;
    }
    showToast("No se pudo enviar la notificacion de prueba");
  };

  const toggleAnalytics = () => {
    const nuevo = { ...cfg, analyticsEnabled: !(cfg.analyticsEnabled ?? true) };
    setCfg(nuevo);
    LS.setDoc("config", "global", nuevo);
    showToast(nuevo.analyticsEnabled ? "Analítica activada" : "Analítica desactivada");
  };

  const buscarActualizacion = async () => {
    setCheckingUpdate(true);
    try {
      const remote = await fetchRemoteVersion();
      setRemoteBuild(remote);
      showToast(isNewerBuild(APP_BUILD, remote) ? "Hay una versión nueva lista para instalar" : "Esta app ya tiene la última versión");
    } catch (error) {
      console.error(error);
      showToast("No se pudo consultar la última versión");
    } finally {
      setCheckingUpdate(false);
    }
  };

  const instalarActualizacion = async () => {
    setUpdatingApp(true);
    try {
      const remote = remoteBuild || await fetchRemoteVersion();
      await applyRemoteUpdate(remote);
    } catch (error) {
      console.error(error);
      setUpdatingApp(false);
      showToast("No se pudo instalar la actualizacion");
    }
  };

  const instalarApp = async () => {
    const result = await promptInstallApp();
    if (result.ok) {
      setInstallAvailable(false);
      showToast("Instalacion iniciada");
      return;
    }
    if (result.reason === "unavailable") {
      showToast("El instalador no esta disponible en este navegador o dispositivo");
      return;
    }
    showToast("La instalacion fue cancelada");
  };

  return (
    <div className="space-y-4">
      <PantallaSuscripcion showToast={showToast} />

      <Card>
        <SectionTitle>Analítica del producto</SectionTitle>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-zinc-800">Medición de uso</p>
            <p className="text-[10px] text-zinc-400 font-bold mt-0.5">
              Registra pantallas, acciones clave y friccion para mejorar la app.
            </p>
          </div>
          <button
            onClick={toggleAnalytics}
            className={`relative w-14 h-7 rounded-full transition-all duration-200 active:scale-95 ${(cfg.analyticsEnabled ?? true) ? "bg-emerald-500" : "bg-zinc-200"}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${(cfg.analyticsEnabled ?? true) ? "left-8" : "left-1"}`} />
          </button>
        </div>
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
          <p className="text-[9px] font-black text-emerald-700 uppercase tracking-wider">
            Estado actual: {(cfg.analyticsEnabled ?? true) ? "Activo" : "Pausado"}
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>Alertas del navegador</SectionTitle>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-black text-zinc-800">Avisos de proximo service</p>
            <p className="text-[10px] text-zinc-400 font-bold mt-0.5">La app te avisa antes de un control o service para que no se te pase.</p>
          </div>
          <button
            onClick={toggleAlertasNavegador}
            className={`relative w-14 h-7 rounded-full transition-all duration-200 active:scale-95 ${alertasActivas ? "bg-orange-500" : "bg-zinc-200"}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${alertasActivas ? "left-8" : "left-1"}`} />
          </button>
        </div>
        <div className={`mt-3 rounded-2xl border p-4 ${permissionLabel === "granted" ? "border-emerald-200 bg-emerald-50" : permissionLabel === "denied" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}>
          <p className={`text-[9px] font-black uppercase tracking-wider ${permissionLabel === "granted" ? "text-emerald-700" : permissionLabel === "denied" ? "text-rose-700" : "text-amber-700"}`}>
            Estado del permiso: {permisoTexto}
          </p>
          <p className={`mt-2 text-[11px] font-bold leading-relaxed ${permissionLabel === "granted" ? "text-emerald-800" : permissionLabel === "denied" ? "text-rose-800" : "text-amber-800"}`}>
            {permissionLabel === "granted"
              ? "Listo. Este dispositivo ya puede mostrar avisos reales."
              : permissionLabel === "denied"
                ? "Este navegador las bloqueó. Tenés que habilitarlas en la configuración del navegador y volver a entrar."
                : "Activá este interruptor y aceptá el permiso cuando el navegador lo pida."}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3">
          <button
            onClick={toggleAlertasNavegador}
            className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all ${alertasActivas ? "bg-zinc-100 border border-zinc-200 text-zinc-700" : "bg-orange-600 text-white"}`}
          >
            {alertasActivas ? "Desactivar avisos" : "Activar avisos"}
          </button>
          <button
            onClick={probarNotificacion}
            className="w-full bg-zinc-900 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
          >
            Probar aviso ahora
          </button>
        </div>
        <div className="mt-3 bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <p className="text-[9px] font-black text-orange-600 uppercase tracking-wider">
            Cómo usarlo
          </p>
          <div className="mt-2 space-y-1 text-[11px] font-bold leading-relaxed text-orange-800">
            <p>1. Activá los avisos y aceptá el permiso.</p>
            <p>2. Tocá "Probar aviso ahora".</p>
            <p>3. Si no aparece nada, revisá que el navegador no las tenga bloqueadas.</p>
          </div>
        </div>

        {isPushSupported() && (
          <div className={`mt-3 rounded-2xl border p-4 ${pushStatus === "active" ? "border-emerald-200 bg-emerald-50" : "border-zinc-200 bg-zinc-50"}`}>
            <p className={`text-[9px] font-black uppercase tracking-wider ${pushStatus === "active" ? "text-emerald-700" : "text-zinc-500"}`}>
              Push en segundo plano
            </p>
            <p className={`mt-1 text-[11px] font-bold leading-relaxed ${pushStatus === "active" ? "text-emerald-800" : "text-zinc-600"}`}>
              {pushStatus === "active"
                ? "Activo — recibís avisos aunque la app esté cerrada."
                : "Inactivo — activá los avisos arriba para habilitarlo."}
            </p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Modo prueba de recordatorios</SectionTitle>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-zinc-800">Modo prueba</p>
            <p className="text-[10px] text-zinc-400 font-bold mt-0.5">Permite crear alertas rapidas para probar recordatorios y WhatsApp</p>
          </div>
          <button
            onClick={toggleTestMode}
            className={`relative w-14 h-7 rounded-full transition-all duration-200 active:scale-95 ${cfg.testModeRecordatorios ? "bg-purple-500" : "bg-zinc-200"}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${cfg.testModeRecordatorios ? "left-8" : "left-1"}`} />
          </button>
        </div>
        {cfg.testModeRecordatorios && (
          <div className="mt-3 bg-purple-50 border border-purple-200 rounded-2xl p-3">
            <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider">
              Modo prueba activo. Las opciones de test aparecen en Próximo control al cargar un trabajo.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Versión de la app</SectionTitle>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-black text-zinc-800">Moto Gestión</span>
          <span className="bg-orange-50 text-orange-600 text-[10px] font-black px-3 py-1 rounded-full border border-orange-100">{APP_BUILD.version}</span>
        </div>
        <div className="space-y-3 mb-4">
          <p className="text-[10px] text-zinc-400 font-bold">
            Si la app instalada se queda vieja, buscá la última versión e instalala desde acá.
          </p>
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Modo de uso</p>
            <p className="text-xs font-black text-zinc-700 mt-1">{displayMode.label}</p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Instalador PWA</p>
            <p className="text-xs font-black text-zinc-700 mt-1">
              {installAvailable ? "Disponible para instalar en este navegador" : "No disponible ahora"}
            </p>
          </div>
          <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-3">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Última compilación local</p>
            <p className="text-xs font-black text-zinc-700 mt-1">{new Date(APP_BUILD.buildTime).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            {APP_BUILD.sha && APP_BUILD.sha !== "dev" && (
              <p className="text-[10px] font-bold text-zinc-400 mt-0.5">{APP_BUILD.sha}</p>
            )}
          </div>
          <div className={`rounded-2xl border p-3 ${hasRemoteUpdate ? "bg-amber-50 border-amber-200" : "bg-zinc-50 border-zinc-200"}`}>
            <p className={`text-[9px] font-black uppercase tracking-wider ${hasRemoteUpdate ? "text-amber-700" : "text-zinc-500"}`}>Último deploy detectado</p>
            <p className={`text-xs font-black mt-1 ${hasRemoteUpdate ? "text-amber-900" : "text-zinc-700"}`}>
              {remoteBuild?.buildTime
                ? new Date(remoteBuild.buildTime).toLocaleString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                : "Sin dato"}
            </p>
            {remoteBuild?.sha && remoteBuild.sha !== "dev" && (
              <p className="text-[10px] font-bold text-zinc-400 mt-0.5">{remoteBuild.sha}</p>
            )}
            <p className={`mt-2 text-[10px] font-black ${hasRemoteUpdate ? "text-amber-700" : "text-emerald-600"}`}>
              {hasRemoteUpdate ? "Hay una actualización pendiente para esta app instalada." : "Esta app ya está al día."}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={buscarActualizacion}
            disabled={checkingUpdate || updatingApp}
            className="w-full bg-zinc-50 border border-zinc-200 text-zinc-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            {checkingUpdate ? "Buscando..." : "Buscar actualización"}
          </button>
          <button
            onClick={hasRemoteUpdate ? instalarActualizacion : () => window.location.reload()}
            disabled={checkingUpdate || updatingApp}
            className={`w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 ${hasRemoteUpdate ? "bg-orange-600 text-white" : "bg-zinc-900 text-white"}`}
          >
            {updatingApp ? "Actualizando..." : hasRemoteUpdate ? "Instalar versión nueva" : "Recargar app"}
          </button>
        </div>
        {!displayMode.installed && (
          <button
            onClick={instalarApp}
            disabled={!installAvailable}
            className={`mt-3 w-full py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 ${installAvailable ? "bg-emerald-600 text-white" : "bg-zinc-200 text-zinc-500"}`}
          >
            Instalar app
          </button>
        )}
      </Card>

      <Card>
        <SectionTitle>Datos del sistema</SectionTitle>
        <div className="space-y-2">
          {loadDemoData && (
            <button
              onClick={() => { loadDemoData(); showToast("Demo cargado"); }}
              className="w-full bg-zinc-50 border border-zinc-200 text-zinc-700 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              Cargar datos de prueba
            </button>
          )}

          <button
            onClick={handleForzarSync}
            disabled={migrando}
            className="w-full flex items-center justify-center gap-2 bg-orange-50 border border-orange-100 text-orange-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            <Database size={14} /> {migrando ? "Sincronizando..." : "Forzar sincronizacion a la nube"}
          </button>

          <button
            onClick={handleMigrarRaiz}
            disabled={migrando}
            className="w-full flex items-center justify-center gap-2 bg-zinc-50 border border-zinc-200 text-zinc-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            <Database size={14} /> {migrando ? "Migrando..." : "Migrar datos legado"}
          </button>

          {clearAllData && (
            <button
              onClick={clearAllData}
              className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-100 text-red-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              <Trash2 size={14} /> Borrar todos los datos
            </button>
          )}
        </div>
      </Card>

      {handleLogout && (
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
        >
          <LogOut size={16} /> Cerrar sesion
        </button>
      )}

      <button
        onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmText(""); }}
        className="w-full flex items-center justify-center gap-2 text-red-600/60 hover:text-red-500 transition-colors py-3 font-black text-[10px] uppercase tracking-widest"
      >
        <Trash2 size={13} /> Eliminar mi cuenta
      </button>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-900 rounded-3xl border border-red-900/40 p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="text-4xl">⚠️</div>
              <p className="text-white font-black text-base">Eliminar cuenta</p>
              <p className="text-zinc-400 text-xs leading-relaxed">
                Esta acción es <strong className="text-red-400">irreversible</strong>.
                Se borrarán tu cuenta y todos tus datos del taller (clientes, motos, órdenes, historial).
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Escribí <span className="text-red-400">ELIMINAR</span> para confirmar
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={e => setDeleteConfirmText(e.target.value)}
                placeholder="ELIMINAR"
                className="w-full bg-black border border-zinc-700 rounded-2xl px-4 py-3 text-white text-sm font-black placeholder-zinc-700 outline-none focus:border-red-500 transition-colors"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(""); }}
                className="flex-1 bg-zinc-800 text-zinc-300 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={handleEliminarCuenta}
                disabled={deleteConfirmText !== "ELIMINAR" || deletingAccount}
                className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-30 text-white py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all"
              >
                {deletingAccount ? "Eliminando..." : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// PANTALLA: Reputacion
const CATS_REP = [
  { key: "scoreAtencion",     label: "Atencion" },
  { key: "scoreClaridad",     label: "Claridad ppto." },
  { key: "scoreTrabajo",      label: "Calidad trabajo" },
  { key: "scoreCumplimiento", label: "Plazos" },
];

function StarBar({ score }) {
  if (!score) return <span className="text-zinc-600 text-xs">—</span>;
  const n = Math.round(score);
  return (
    <span className="text-orange-500 tracking-tight text-sm">
      {"★".repeat(n)}
      <span className="text-zinc-700">{"★".repeat(5 - n)}</span>
      <span className="text-zinc-400 text-[10px] ml-1">{Number(score).toFixed(1)}</span>
    </span>
  );
}

function PublicarRedCard({ aprobados }) {
  const [publicando, setPublicando] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const [err, setErr] = React.useState("");
  const [showDisclaimer, setShowDisclaimer] = React.useState(false);

  const uid = auth.currentUser?.uid;
  const perfilUrl = uid ? `https://app.motogestion.ar/taller/${uid}` : null;

  const publicar = async () => {
    if (publicando) return;
    setPublicando(true);
    setShowDisclaimer(false);
    setErr("");
    setResultado(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const cfgActual = LS.getDoc("config", "global") || {};
      const res = await fetch("/api/publish-workshop", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ciudadTaller:    cfgActual.ciudadTaller    || "",
          provinciaTaller: cfgActual.provinciaTaller || "",
          lat: typeof cfgActual.lat === "number" ? cfgActual.lat : null,
          lng: typeof cfgActual.lng === "number" ? cfgActual.lng : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo publicar.");
      setResultado(data);
    } catch (e) {
      setErr(e.message || "Error al publicar.");
    } finally {
      setPublicando(false);
    }
  };

  return (
    <>
      {/* Modal disclaimer */}
      {showDisclaimer && (
        <div className="fixed inset-0 z-[300] flex items-end justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-700 bg-zinc-900 p-6 space-y-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Antes de publicar — leé esto</p>
            <p className="text-sm font-black text-white leading-snug">Tu taller aparecerá públicamente en motogestion.ar y puede ser indexado por Google.</p>
            <div className="space-y-2 text-xs text-zinc-400 leading-relaxed">
              <p>• Las calificaciones de clientes son generadas por terceros. MotoGestión no las edita ni garantiza su veracidad.</p>
              <p>• MotoGestión no se responsabiliza por comentarios negativos, reputación baja ni por las consecuencias de tu presencia pública en internet.</p>
              <p>• Si considerás que una calificación es injusta o falsa, podés reportarla al soporte para que sea revisada por el equipo.</p>
              <p>• Podés despublicar tu perfil en cualquier momento desde esta sección.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => setShowDisclaimer(false)}
                className="rounded-2xl border border-zinc-700 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-400 active:scale-95"
              >
                Cancelar
              </button>
              <button
                onClick={publicar}
                className="rounded-2xl bg-orange-600 py-3 text-[10px] font-black uppercase tracking-widest text-white active:scale-95"
              >
                Acepto y publico
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-[2rem] bg-zinc-900 border border-zinc-800 p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-[10px] font-black text-white">MG</div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-500">Red MotoGestión</p>
            <p className="text-sm font-black text-white">Publicar perfil público del taller</p>
          </div>
        </div>

        {aprobados.length === 0 ? (
          <p className="text-xs text-zinc-400 leading-relaxed">
            Podés publicar tu taller en la red aunque todavía no tengas calificaciones. Aparecerás en el mapa y los clientes podrán encontrarte. Las calificaciones se van sumando a medida que emitís comprobantes y tus clientes califican.
          </p>
        ) : (
          <p className="text-xs text-zinc-400 leading-relaxed">
            Publicá tu perfil con {aprobados.length} calificación{aprobados.length !== 1 ? "es" : ""} verificada{aprobados.length !== 1 ? "s" : ""}. Tu taller aparece en el mapa y en la red pública de MotoGestión.
          </p>
        )}

        {resultado && (
          <div className="rounded-2xl border border-green-800 bg-green-900/30 p-3 space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-green-400">Perfil publicado</p>
            <p className="text-xs text-zinc-300 break-all">{perfilUrl}</p>
            <button
              onClick={() => { if (perfilUrl) navigator.clipboard?.writeText(perfilUrl); }}
              className="text-[10px] font-black uppercase text-orange-400 active:scale-95 transition-all"
            >
              Copiar enlace
            </button>
          </div>
        )}

        {err && <p className="text-xs font-bold text-red-400">{err}</p>}

        <button
          onClick={() => setShowDisclaimer(true)}
          disabled={publicando}
          className="w-full rounded-2xl bg-orange-600 py-3 text-[11px] font-black uppercase tracking-widest text-white transition-all active:scale-95 disabled:opacity-40"
        >
          {publicando ? "Publicando..." : resultado ? "Actualizar perfil" : "Publicar en la red"}
        </button>
      </div>
    </>
  );
}

function PantallaReputacion() {
  const [ratings, setRatings] = React.useState(null);
  const [err, setErr] = React.useState(null);

  const ratingTime = (rating) => {
    const value = rating?.createdAt;
    if (!value) return 0;
    if (typeof value === "number") return value;
    if (typeof value === "string") return new Date(value).getTime() || 0;
    return value?.toMillis?.() || value?.seconds * 1000 || 0;
  };

  React.useEffect(() => {
    if (!auth.currentUser) return;

    const run = async () => {
      try {
        // Prefer server-side ordering/limit. If Firestore requires a composite index, fall back gracefully.
        const snap = await getDocsFromServer(query(
          collection(db, "ratings"),
          where("uidTaller", "==", auth.currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(60),
        ));
        setRatings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        const msg = e?.message || String(e || "");
        // Firestore missing composite index usually surfaces as:
        // - code: "failed-precondition"
        // - message: "The query requires an index ..."
        const isMissingIndex =
          e?.code === "failed-precondition" ||
          msg.toLowerCase().includes("requires an index");
        if (isMissingIndex) {
          try {
            const snap2 = await getDocsFromServer(query(
              collection(db, "ratings"),
              where("uidTaller", "==", auth.currentUser.uid),
            ));
            const docs = snap2.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .sort((a, b) => ratingTime(b) - ratingTime(a))
              .slice(0, 60);
            setRatings(docs);
            return;
          } catch (e2) {
            setErr(e2?.message || String(e2 || ""));
            return;
          }
        }
        setErr(msg);
      }
    };

    run();
  }, []);

  if (ratings === null && !err) {
    return (
      <div className="p-6 flex items-center gap-2 text-zinc-400 text-sm">
        <Star size={16} className="animate-pulse text-orange-500" /> Cargando calificaciones...
      </div>
    );
  }
  if (err) {
    return <div className="p-6 text-red-400 text-xs">Error al cargar: {err}</div>;
  }

  if (!ratings.length) {
    return (
      <div className="p-6 animate-in fade-in space-y-4">
        <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Reputación MotoGestión</h2>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-5">
          <Star size={24} className="text-orange-500 mb-3" />
          <p className="text-sm font-bold text-zinc-300 mb-1">Todavía no hay validaciones registradas</p>
          <p className="text-xs text-zinc-500">Cada comprobante verificable que emitas incluye un QR. Cuando el cliente lo escanea, valida el mantenimiento de su moto y puede calificar el servicio. La calificación queda asociada al comprobante real.</p>
        </div>
      </div>
    );
  }

  const avg = (key) => {
    const vals = ratings.filter((r) => r[key] > 0).map((r) => r[key]);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  const genAvg = () => {
    const avgs = CATS_REP.map((c) => avg(c.key)).filter((v) => v !== null);
    return avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  };
  const pctRecomienda = () => {
    const con = ratings.filter((r) => r.recomienda !== undefined && r.recomienda !== null);
    if (!con.length) return null;
    return Math.round((con.filter((r) => r.recomienda === true || r.recomienda === "si").length / con.length) * 100);
  };
  const pendientes = ratings.filter((r) => !r.status || r.status === "pendiente_validacion").length;
  const ga = genAvg();
  const pr = pctRecomienda();

  return (
    <div className="animate-in fade-in pb-32 space-y-4">
      <h2 className="text-3xl font-black uppercase tracking-tighter text-white px-2">Reputación MotoGestión</h2>

      {/* Resumen top */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Total</p>
          <p className="text-2xl font-black text-white mt-1">{ratings.length}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">recibidas</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Promedio</p>
          <p className="text-2xl font-black text-orange-500 mt-1">{ga !== null ? ga.toFixed(1) : "—"}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">de 5 estrellas</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Recomienda</p>
          <p className="text-2xl font-black text-green-500 mt-1">{pr !== null ? `${pr}%` : "—"}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">de los clientes</p>
        </div>
        <div className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 text-center">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Pendientes</p>
          <p className="text-2xl font-black text-yellow-500 mt-1">{pendientes}</p>
          <p className="text-[9px] text-zinc-500 mt-0.5">por validar</p>
        </div>
      </div>

      {/* Promedios por categoria */}
      <div className="rounded-[2rem] bg-zinc-900 border border-zinc-800 p-5 space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Por categoria</p>
        {CATS_REP.map((c) => {
          const val = avg(c.key);
          const pct = val ? (val / 5) * 100 : 0;
          return (
            <div key={c.key}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide">{c.label}</span>
                <span className="text-[11px] font-black text-orange-500">{val !== null ? val.toFixed(1) : "—"}</span>
              </div>
              <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-orange-500 transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Publicar en Red MotoGestión */}
      <PublicarRedCard aprobados={ratings.filter(r => r.status === "aprobado")} />

      {/* Lista de calificaciones */}
      <div className="space-y-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">Historial</p>
        {ratings.map((r) => {
          const fecha = r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-AR") : "";
          const aprobada = r.status === "aprobado";
          return (
            <div key={r.id} className="rounded-2xl bg-zinc-900 border border-zinc-800 p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {CATS_REP.map((c) => r[c.key] ? (
                    <div key={c.key}>
                      <p className="text-[8px] text-zinc-500 uppercase tracking-widest">{c.label}</p>
                      <StarBar score={r[c.key]} />
                    </div>
                  ) : null)}
                </div>
                <span className={`text-[8px] font-black uppercase px-2 py-1 rounded-full flex-shrink-0 ${aprobada ? "bg-green-900/60 text-green-400" : "bg-yellow-900/60 text-yellow-400"}`}>
                  {aprobada ? "Aprobada" : "Pendiente"}
                </span>
              </div>
              {r.comentario ? (
                <p className="text-[11px] text-zinc-400 italic border-l-2 border-orange-500 pl-3 leading-relaxed">"{r.comentario}"</p>
              ) : null}
              <div className="flex items-center justify-between">
                {r.recomienda !== undefined && (
                  <p className="text-[9px] font-black uppercase text-zinc-500">
                    {r.recomienda === true || r.recomienda === "si" ? "✓ Recomienda" : "✗ No recomienda"}
                  </p>
                )}
                <p className="text-[8px] text-zinc-600 ml-auto">{r.numeroComprobante ? `${r.numeroComprobante} · ` : ""}{fecha}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ConfigView({ setView, showToast, orders = [], bikes = [], clients = [], handleLogout, loadDemoData, clearAllData }) {
  const [activeTab, setActiveTab] = useState(() => window.localStorage.getItem("jbos_config_tab") || "resumen");
  const [cfg, setCfg] = useState(() => LS.getDoc("config", "global") || CONFIG_DEFAULT);
  const [bkpEstado, setBkpEstado] = useState(() => estadoBackup());
  const fileInputRef = useRef(null);
  const scrollRef = useRef(null);
  const caja = useCollection("caja");
  const canSeeAdminTab =
    isAdminSurface() && (
      PLATFORM_ADMIN_EMAILS.includes((auth.currentUser?.email || "").toLowerCase()) ||
      PLATFORM_ADMIN_UIDS.includes(auth.currentUser?.uid || "")
    );
  const visibleTabs = canSeeAdminTab ? TABS : TABS.filter((tab) => tab.id !== "admin");

  useEffect(() => {
    const tabPermitida = visibleTabs.some((tab) => tab.id === activeTab);
    if (!tabPermitida) {
      setActiveTab("resumen");
      window.localStorage.setItem("jbos_config_tab", "resumen");
    }
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    window.localStorage.setItem("jbos_config_tab", activeTab);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeTab]);

  const handleRestaurarArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const resultado = restaurarDesdeTexto(ev.target.result);
      if (resultado.ok) {
        showToast(`Restauración completa. ${resultado.restaurados} colecciones recuperadas. La app se va a recargar.`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        showToast(`No se restauró la copia. Motivo: ${resultado.error}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRestaurarAuto = () => {
    const resultado = restaurarAutoBackup();
    if (resultado.ok) {
      showToast("Restauración completa desde auto-guardado. La app se va a recargar.");
      setTimeout(() => window.location.reload(), 1500);
    } else {
      showToast(`No se restauró la copia. Motivo: ${resultado.error}`);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "resumen": return <PantallaResumen orders={orders} caja={caja} />;
      case "taller":  return <PantallaTaller cfg={cfg} setCfg={setCfg} showToast={showToast} />;
      case "datos":   return <PantallaDatos orders={orders} bikes={bikes} clients={clients} cfg={cfg} showToast={showToast} bkpEstado={bkpEstado} setBkpEstado={setBkpEstado} fileInputRef={fileInputRef} handleRestaurarArchivo={handleRestaurarArchivo} handleRestaurarAuto={handleRestaurarAuto} />;
      case "sistema":    return <PantallaSistema loadDemoData={loadDemoData} clearAllData={clearAllData} handleLogout={handleLogout} showToast={showToast} cfg={cfg} setCfg={setCfg} />;
      case "reputacion": return <PantallaReputacion />;
      case "admin":      return canSeeAdminTab ? <PantallaAdmin showToast={showToast} scrollRef={scrollRef} /> : <PantallaResumen orders={orders} caja={caja} />;
      default: return <PantallaResumen orders={orders} caja={caja} />;
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#071d2e] animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 bg-gradient-to-b from-[#08243a] to-[#071d2e]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-300">MotoGestion</p>
            <h1 className="mt-1 text-[2rem] font-black leading-none tracking-tight text-white uppercase">Cuenta</h1>
            <p className="mt-2 text-sm font-semibold text-slate-300">Números, taller y sistema en un solo lugar.</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="px-4 pb-3 bg-[#071d2e]">
        <div className="flex gap-1 overflow-x-auto rounded-[1.35rem] border border-white/10 bg-white/8 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          {visibleTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`min-h-[52px] min-w-[72px] flex-1 cursor-pointer rounded-2xl px-2 py-2.5 transition-all focus:outline-none focus:ring-2 focus:ring-orange-300 ${
                activeTab === id
                  ? "bg-orange-500 text-slate-950 shadow-[0_10px_24px_rgba(249,115,22,0.32)]"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              <span className="flex flex-col items-center gap-1">
                <Icon size={16} strokeWidth={2.4} />
                <span className="text-[9px] font-black uppercase tracking-[0.12em]">
                  {label}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-4 bg-[#071d2e]">
        {renderContent()}
      </div>
    </div>
  );
}
