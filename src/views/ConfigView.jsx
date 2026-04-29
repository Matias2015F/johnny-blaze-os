import React, { useState, useMemo, useRef } from "react";
import {
  Download, LogOut, Trash2, Database, Info, Shield,
  RotateCcw, FileSpreadsheet, ChevronRight, BarChart2,
  Settings, HardDrive, Wrench, Plus, Minus,
} from "lucide-react";
import { LS, useCollection, migrateFromRootCollections, forceSyncCacheToFirestore } from "../lib/storage.js";
import { auth } from "../firebase.js";
import { createCloudBackup, listCloudBackups, restoreCloudBackup } from "../lib/cloudBackup.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { formatMoney } from "../utils/format.js";
import { exportarOrdenes, exportarClientes, exportarBalance, exportarRepuestos } from "../utils/export.js";
import { descargarBackup, restaurarDesdeTexto, restaurarAutoBackup, estadoBackup, tiempoDesde } from "../utils/backup.js";

const APP_VERSION = "1.0.0";

const DIFICULTADES = [
  { key: "facil",      label: "Fácil",       color: "text-green-500",  bg: "bg-green-50",  border: "border-green-200" },
  { key: "normal",     label: "Normal",      color: "text-blue-500",   bg: "bg-blue-50",   border: "border-blue-200" },
  { key: "dificil",    label: "Difícil",     color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  { key: "complicado", label: "Complicado",  color: "text-red-500",    bg: "bg-red-50",    border: "border-red-200" },
];

const TABS = [
  { id: "resumen", label: "Resumen",  Icon: BarChart2 },
  { id: "taller",  label: "Taller",   Icon: Wrench },
  { id: "datos",   label: "Datos",    Icon: HardDrive },
  { id: "sistema", label: "Sistema",  Icon: Settings },
];

// ── Stepper component ──────────────────────────────────────────────────────────
function Stepper({ value, onChange, step = 1, min = 0, max = Infinity, format = v => v, suffix = "" }) {

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-11 h-11 rounded-2xl bg-slate-100 flex items-center justify-center active:scale-90 transition-all"
      >
        <Minus size={16} className="text-slate-600" />
      </button>
      <div className="flex-1 text-center">
        <span className="text-2xl font-black text-slate-800 tracking-tight">{format(value)}</span>
        {suffix && <span className="text-sm font-bold text-slate-400 ml-1">{suffix}</span>}
      </div>
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-11 h-11 rounded-2xl bg-slate-900 flex items-center justify-center active:scale-90 transition-all"
      >
        <Plus size={16} className="text-white" />
      </button>
    </div>
  );
}

// ── Section card ───────────────────────────────────────────────────────────────
function Card({ children, className = "" }) {
  return (
    <div className={`bg-white rounded-3xl shadow-sm border border-slate-100 p-6 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{children}</p>;
}

// ── PANTALLA: Resumen ──────────────────────────────────────────────────────────
function PantallaResumen({ orders, caja }) {
  const mesActual = new Date().toISOString().slice(0, 7);
  const ordenesMes = useMemo(() => orders.filter(o => (o.fechaIngreso || "").startsWith(mesActual)), [orders, mesActual]);
  const { totalMes, gananciaMes } = useMemo(() => ({
    totalMes:    ordenesMes.reduce((s, o) => s + (o.total || 0), 0),
    gananciaMes: ordenesMes.reduce((s, o) => s + calcularResultadosOrden(o).margen, 0),
  }), [ordenesMes]);
  const balance = useMemo(() => caja.reduce((acc, m) => (m.tipo === "ingreso" ? acc + m.monto : acc - m.monto), 0), [caja]);

  const mes = new Date().toLocaleString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Caja */}
      <Card>
        <SectionTitle>Caja actual</SectionTitle>
        <p className={`text-5xl font-black tracking-tighter ${balance >= 0 ? "text-green-500" : "text-red-500"}`}>
          {formatMoney(balance)}
        </p>
        <p className="text-xs text-slate-400 font-bold mt-1 capitalize">{mes}</p>
      </Card>

      {/* Stats del mes */}
      <Card>
        <SectionTitle>Este mes</SectionTitle>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
            <p className="text-3xl font-black text-blue-500">{ordenesMes.length}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Trabajos</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
            <p className="text-xl font-black text-slate-800">{formatMoney(totalMes)}</p>
            <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Cobrado</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
            <p className={`text-xl font-black ${gananciaMes >= 0 ? "text-green-500" : "text-red-500"}`}>
              {formatMoney(gananciaMes)}
            </p>
            <p className="text-[9px] font-black text-slate-400 uppercase mt-1">Ganancia</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ── PANTALLA: Taller ───────────────────────────────────────────────────────────
function PantallaTaller({ cfg, setCfg, showToast }) {
  const margen = cfg.margenPolitica ?? 25;
  const horaCliente = Math.round(cfg.valorHoraInterno * (1 + margen / 100));

  const guardar = () => {
    LS.setDoc("config", "global", { ...cfg, margenPolitica: margen, valorHoraCliente: horaCliente });
    showToast("Guardado ✓");
  };

  const setFactor = (key, val) => {
    const f = Math.round(val * 10) / 10;
    if (f <= 0) return;
    setCfg({ ...cfg, factorDificultad: { ...(cfg.factorDificultad || CONFIG_DEFAULT.factorDificultad), [key]: f } });
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
            ["telefonoTaller",      "Teléfono",          "tel"],
          ].map(([field, label, type]) => (
            <div key={field}>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{label}</label>
              <input
                type={type}
                value={cfg[field] ?? ""}
                onChange={e => setCfg({ ...cfg, [field]: e.target.value })}
                className="w-full border-2 border-slate-100 rounded-2xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-blue-500 transition-colors bg-slate-50"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Costo hora */}
      <Card>
        <SectionTitle>Costo por Hora</SectionTitle>
        <p className="text-[10px] text-slate-400 font-bold mb-4">Gastos fijos ÷ horas trabajadas al mes</p>
        <Stepper
          value={cfg.valorHoraInterno}
          onChange={v => setCfg({ ...cfg, valorHoraInterno: v })}
          step={500}
          min={0}
          format={formatMoney}
        />
      </Card>

      {/* Margen */}
      <Card>
        <SectionTitle>Margen por Defecto</SectionTitle>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] text-slate-400 font-bold">Ganancia sobre el costo</span>
          <span className="text-2xl font-black text-blue-600">{margen}%</span>
        </div>
        <input
          type="range" min="5" max="120" step="5"
          value={margen}
          onChange={e => setCfg({ ...cfg, margenPolitica: Number(e.target.value) })}
          className="w-full accent-blue-600 mb-2"
        />
        <div className="flex justify-between text-[9px] text-slate-400 font-bold">
          <span>5%</span><span>60%</span><span>120%</span>
        </div>
        <div className="mt-4 bg-slate-900 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Precio hora al cliente</p>
            <p className="text-[10px] text-slate-500 mt-0.5">{formatMoney(cfg.valorHoraInterno)} × {(1 + margen / 100).toFixed(2)}</p>
          </div>
          <p className="text-2xl font-black text-blue-400">{formatMoney(horaCliente)}</p>
        </div>
      </Card>

      {/* Multiplicadores */}
      <Card>
        <SectionTitle>Multiplicadores por Dificultad</SectionTitle>
        <div className="space-y-3">
          {DIFICULTADES.map(({ key, label, color, bg, border }) => {
            const factor = cfg.factorDificultad?.[key] ?? CONFIG_DEFAULT.factorDificultad[key];
            return (
              <div key={key} className={`${bg} border ${border} rounded-2xl p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-sm font-black ${color}`}>{label}</span>
                  <span className="text-[10px] text-slate-500 font-bold">
                    = {formatMoney(Math.round(horaCliente * factor))}/h
                  </span>
                </div>
                <Stepper
                  value={factor}
                  onChange={v => setFactor(key, v)}
                  step={0.1}
                  min={0.5}
                  max={5}
                  format={v => `${v.toFixed(1)}×`}
                />
              </div>
            );
          })}
        </div>
      </Card>

      {/* Plantilla WhatsApp */}
      <Card>
        <SectionTitle>Plantilla WhatsApp — Próximo control</SectionTitle>
        <p className="text-[10px] text-slate-400 font-bold mb-3 leading-relaxed">
          Variables: {"{nombreCliente}"} {"{nombreTaller}"} {"{marca}"} {"{modelo}"} {"{patente}"} {"{tipoControl}"}
        </p>
        <textarea
          rows="5"
          value={cfg.whatsappPlantillas?.recordatorioService ?? "Hola {nombreCliente}, te escribimos de {nombreTaller}.\n\nTu moto {marca} {modelo} patente {patente} puede estar cerca del próximo control recomendado: {tipoControl}.\n\nSi querés, podés pasar por el taller y la revisamos para verificarlo."}
          onChange={e => setCfg({ ...cfg, whatsappPlantillas: { ...(cfg.whatsappPlantillas || {}), recordatorioService: e.target.value } })}
          className="w-full border-2 border-slate-100 rounded-2xl p-4 font-bold text-xs outline-none focus:border-blue-500 resize-none"
        />
      </Card>

      <button
        onClick={guardar}
        className="w-full bg-blue-600 text-white py-4 rounded-3xl font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all"
      >
        Guardar cambios
      </button>
    </div>
  );
}

// ── PANTALLA: Datos ────────────────────────────────────────────────────────────
function PantallaDatos({ orders, bikes, clients, cfg, showToast, bkpEstado, setBkpEstado, fileInputRef, handleRestaurarArchivo, handleRestaurarAuto }) {
  const [backups, setBackups] = React.useState([]);
  const [loadingBackups, setLoadingBackups] = React.useState(false);
  const [guardandoBkp, setGuardandoBkp] = React.useState(false);
  const [restaurando, setRestaurando] = React.useState(null);

  const cargarBackups = async () => {
    setLoadingBackups(true);
    try {
      const uid = auth.currentUser?.uid;
      const lista = await listCloudBackups(uid);
      setBackups(lista);
    } catch (e) {
      showToast("Error al cargar copias: " + e.message);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleGuardarEnNube = async () => {
    setGuardandoBkp(true);
    try {
      const uid = auth.currentUser?.uid;
      const r = await createCloudBackup(uid);
      showToast(r ? `Copia guardada en la nube (${r.total} registros) ✓` : "No hay datos para guardar");
      cargarBackups();
    } catch (e) {
      showToast("Error: " + e.message);
    } finally {
      setGuardandoBkp(false);
    }
  };

  const handleRestaurarNube = async (backupId, fecha) => {
    if (!window.confirm(`¿Restaurar la copia del ${new Date(fecha).toLocaleString("es-AR")}?\n\nEsto reemplaza TODOS los datos actuales.`)) return;
    setRestaurando(backupId);
    try {
      const uid = auth.currentUser?.uid;
      const n = await restoreCloudBackup(uid, backupId);
      showToast(`Restaurado: ${n} registros recuperados ✓`);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      showToast("Error al restaurar: " + e.message);
    } finally {
      setRestaurando(null);
    }
  };

  React.useEffect(() => { cargarBackups(); }, []);

  return (
    <div className="space-y-4">
      {/* Exportar */}
      <Card>
        <SectionTitle>Exportar Datos</SectionTitle>
        <button
          onClick={() => { exportarOrdenes(orders, bikes, clients); showToast("Exportando CSV..."); }}
          className="w-full flex items-center justify-between bg-green-600 text-white rounded-2xl p-5 active:scale-[0.98] transition-all shadow-md mb-4"
        >
          <div className="text-left">
            <p className="text-sm font-black uppercase">Exportar trabajos (CSV)</p>
            <p className="text-[10px] font-bold text-green-100 mt-0.5">Todos los trabajos con detalle</p>
          </div>
          <FileSpreadsheet size={22} />
        </button>

        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">CSV separados</p>
        <div className="space-y-2">
          {[
            { label: "Clientes",             sub: `${clients.length} registros`,   fn: () => { exportarClientes(clients, orders); showToast("Exportando clientes..."); } },
            { label: "Balance mensual",      sub: "Totales por mes",               fn: () => { exportarBalance(orders);           showToast("Exportando balance..."); } },
            { label: "Repuestos utilizados", sub: "Ranking por uso",               fn: () => { exportarRepuestos(orders);         showToast("Exportando repuestos..."); } },
          ].map(({ label, sub, fn }) => (
            <button key={label} onClick={fn}
              className="w-full flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-4 active:scale-[0.98] transition-all">
              <div className="text-left">
                <p className="text-sm font-black text-slate-800">{label}</p>
                <p className="text-[10px] text-slate-400 font-bold">{sub}</p>
              </div>
              <Download size={16} className="text-blue-500" />
            </button>
          ))}
        </div>
      </Card>

      {/* Backup */}
      <Card>
        <SectionTitle>Copia de Seguridad</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Última manual</p>
            <p className="text-xs font-black text-slate-700">{tiempoDesde(bkpEstado.ultimoManual) || "Nunca"}</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Auto-guardado</p>
            <p className="text-xs font-black text-slate-700">{tiempoDesde(bkpEstado.ultimoAuto) || "Nunca"}</p>
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={() => { descargarBackup(); setBkpEstado(estadoBackup()); showToast("Copia descargada ✓"); }}
            className="w-full flex items-center justify-between bg-blue-600 text-white rounded-2xl p-5 active:scale-[0.98] transition-all shadow-md"
          >
            <div className="text-left">
              <p className="text-sm font-black uppercase">Descargar copia</p>
              <p className="text-[10px] font-bold text-blue-100 mt-0.5">Archivo .json en tu dispositivo</p>
            </div>
            <Download size={20} />
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-between bg-slate-900 text-white rounded-2xl p-5 active:scale-[0.98] transition-all"
          >
            <div className="text-left">
              <p className="text-sm font-black uppercase">Restaurar desde archivo</p>
              <p className="text-[10px] font-bold text-slate-400 mt-0.5">Elegí el .json descargado</p>
            </div>
            <RotateCcw size={20} />
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleRestaurarArchivo} className="hidden" />

          {bkpEstado.tieneAuto && (
            <button
              onClick={handleRestaurarAuto}
              className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl p-4 active:scale-[0.98] transition-all"
            >
              <div className="text-left">
                <p className="text-sm font-black">Restaurar auto-guardado</p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">Guardado {tiempoDesde(bkpEstado.ultimoAuto)}</p>
              </div>
              <RotateCcw size={16} className="text-slate-500" />
            </button>
          )}
        </div>
      </Card>

      {/* Backup en la nube */}
      <Card>
        <SectionTitle>Copias en la Nube</SectionTitle>
        <p className="text-[10px] text-slate-400 font-bold mb-3 leading-relaxed">
          Se guarda automáticamente 1 vez por día. Podés guardar ahora o restaurar una copia anterior desde cualquier dispositivo.
        </p>
        <button
          onClick={handleGuardarEnNube}
          disabled={guardandoBkp}
          className="w-full flex items-center justify-between bg-blue-600 text-white rounded-2xl p-5 active:scale-[0.98] transition-all shadow-md mb-3 disabled:opacity-50"
        >
          <div className="text-left">
            <p className="text-sm font-black uppercase">{guardandoBkp ? "Guardando..." : "Guardar copia ahora"}</p>
            <p className="text-[10px] font-bold text-blue-100 mt-0.5">Guarda todos los datos en la nube</p>
          </div>
          <HardDrive size={20} />
        </button>

        {loadingBackups ? (
          <p className="text-center text-[10px] text-slate-400 font-bold py-4">Cargando copias...</p>
        ) : backups.length === 0 ? (
          <p className="text-center text-[10px] text-slate-400 font-bold py-4">No hay copias guardadas en la nube todavía</p>
        ) : (
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Copias disponibles (últimas {backups.length})</p>
            {backups.map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-4">
                <div>
                  <p className="text-xs font-black text-slate-800">{new Date(b.fecha).toLocaleString("es-AR", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" })}</p>
                  <p className="text-[9px] font-bold text-slate-400">{b.total} registros</p>
                </div>
                <button
                  onClick={() => handleRestaurarNube(b.id, b.fecha)}
                  disabled={restaurando === b.id}
                  className="bg-slate-800 text-white px-4 py-2 rounded-xl font-black text-[10px] uppercase active:scale-95 transition-all disabled:opacity-50"
                >
                  {restaurando === b.id ? "..." : "Restaurar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── PANTALLA: Sistema ──────────────────────────────────────────────────────────
function PantallaSistema({ loadDemoData, clearAllData, handleLogout, showToast, cfg, setCfg }) {
  const [migrando, setMigrando] = React.useState(false);

  const handleMigrarRaiz = async () => {
    setMigrando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error("Sin sesión");
      const n = await migrateFromRootCollections(uid);
      showToast(n > 0 ? `Migración completa: ${n} registros movidos ✓` : "Sin datos en colecciones raíz");
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
      if (!uid) throw new Error("Sin sesión");
      const n = await forceSyncCacheToFirestore(uid);
      showToast(n > 0 ? `Sincronizado: ${n} registros guardados en la nube ✓` : "No hay datos en memoria para sincronizar");
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
    showToast(nuevo.testModeRecordatorios ? "Modo prueba activado ✓" : "Modo prueba desactivado");
  };

  const toggleAlertasNavegador = async () => {
    const activar = !(cfg.alertasNavegadorActivas ?? true);
    if (activar && typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") {
          showToast("El navegador no dio permiso para notificar");
        }
      } catch (e) {
        console.error(e);
      }
    }
    const nuevo = { ...cfg, alertasNavegadorActivas: activar };
    setCfg(nuevo);
    LS.setDoc("config", "global", nuevo);
    showToast(activar ? "Alertas del navegador activadas ?" : "Alertas del navegador desactivadas");
  };

  return (
    <div className="space-y-4">

      <Card>
        <SectionTitle>Alertas del navegador</SectionTitle>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-800">Notificaciones de próximo service</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Muestran un aviso real del navegador cuando un recordatorio entra en próximo o vencido.</p>
          </div>
          <button
            onClick={toggleAlertasNavegador}
            className={`relative w-14 h-7 rounded-full transition-all duration-200 active:scale-95 ${(cfg.alertasNavegadorActivas ?? true) ? "bg-blue-500" : "bg-slate-200"}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${(cfg.alertasNavegadorActivas ?? true) ? "left-8" : "left-1"}`} />
          </button>
        </div>
        <div className="mt-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
            Estado del permiso: {typeof window !== "undefined" && "Notification" in window ? Notification.permission : "no soportado"}
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle>Modo Prueba de Recordatorios</SectionTitle>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-black text-slate-800">Modo prueba</p>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">Permite crear alertas rápidas para probar recordatorios y WhatsApp</p>
          </div>
          <button
            onClick={toggleTestMode}
            className={`relative w-14 h-7 rounded-full transition-all duration-200 active:scale-95 ${cfg.testModeRecordatorios ? "bg-purple-500" : "bg-slate-200"}`}
          >
            <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${cfg.testModeRecordatorios ? "left-8" : "left-1"}`} />
          </button>
        </div>
        {cfg.testModeRecordatorios && (
          <div className="mt-3 bg-purple-50 border border-purple-200 rounded-2xl p-3">
            <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider">
              Modo prueba activo — las opciones de test aparecen en "Próximo control" al cargar un trabajo. Los recordatorios de prueba se marcan con badge PRUEBA.
            </p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Versión de la App</SectionTitle>
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-black text-slate-800">Johnny Blaze OS</span>
          <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full border border-blue-100">v{APP_VERSION}</span>
        </div>
        <p className="text-[10px] text-slate-400 font-bold mb-4">
          Si la app no muestra los últimos cambios, recargá la página.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-slate-50 border border-slate-200 text-slate-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
        >
          Recargar app
        </button>
      </Card>

      <Card>
        <SectionTitle>Datos del Sistema</SectionTitle>
        <div className="space-y-2">
          {loadDemoData && (
            <button
              onClick={() => { loadDemoData(); showToast("Demo cargado ✓"); }}
              className="w-full bg-slate-50 border border-slate-200 text-slate-700 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
            >
              Cargar datos de prueba
            </button>
          )}

          <button
            onClick={handleForzarSync}
            disabled={migrando}
            className="w-full flex items-center justify-center gap-2 bg-blue-50 border border-blue-100 text-blue-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
          >
            <Database size={14} /> {migrando ? "Sincronizando..." : "Forzar sincronización a la nube"}
          </button>

          <button
            onClick={handleMigrarRaiz}
            disabled={migrando}
            className="w-full flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50"
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
          className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-5 rounded-3xl font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg"
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
      )}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function ConfigView({ setView, showToast, orders = [], bikes = [], clients = [], handleLogout, loadDemoData, clearAllData }) {
  const [activeTab, setActiveTab] = useState("resumen");
  const [cfg, setCfg] = useState(() => LS.getDoc("config", "global") || CONFIG_DEFAULT);
  const [bkpEstado, setBkpEstado] = useState(() => estadoBackup());
  const fileInputRef = useRef(null);
  const caja = useCollection("caja");

  const handleRestaurarArchivo = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const resultado = restaurarDesdeTexto(ev.target.result);
      if (resultado.ok) {
        showToast(`Restaurado ✓ (${resultado.restaurados} colecciones)`);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        showToast(`Error: ${resultado.error}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleRestaurarAuto = () => {
    const resultado = restaurarAutoBackup();
    if (resultado.ok) {
      showToast("Restaurado desde copia automática ✓");
      setTimeout(() => window.location.reload(), 1200);
    } else {
      showToast(`Error: ${resultado.error}`);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "resumen": return <PantallaResumen orders={orders} caja={caja} />;
      case "taller":  return <PantallaTaller cfg={cfg} setCfg={setCfg} showToast={showToast} />;
      case "datos":   return <PantallaDatos orders={orders} bikes={bikes} clients={clients} cfg={cfg} showToast={showToast} bkpEstado={bkpEstado} setBkpEstado={setBkpEstado} fileInputRef={fileInputRef} handleRestaurarArchivo={handleRestaurarArchivo} handleRestaurarAuto={handleRestaurarAuto} />;
      case "sistema": return <PantallaSistema loadDemoData={loadDemoData} clearAllData={clearAllData} handleLogout={handleLogout} showToast={showToast} cfg={cfg} setCfg={setCfg} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 bg-slate-950">
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Cuenta</h1>
      </div>

      {/* Tab bar */}
      <div className="px-4 pb-3 bg-slate-950">
        <div className="flex gap-1 bg-slate-800 p-1 rounded-2xl">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all ${
                activeTab === id
                  ? "bg-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon size={15} className={activeTab === id ? "text-slate-800" : ""} />
              <span className={`text-[9px] font-black uppercase tracking-wide ${activeTab === id ? "text-slate-800" : ""}`}>
                {label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-28 space-y-4">
        {renderContent()}
      </div>
    </div>
  );
}
