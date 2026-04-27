import React, { useState, useMemo, useRef } from "react";
import { ArrowLeft, Download, LogOut, Trash2, Database, Info, Save, Upload, User, Lock, Mail } from "lucide-react";
import { LS, useCollection } from "../lib/storage.js";
import { getMeta, setMeta, exportBackup, importBackup } from "../lib/backup.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { calcularResultadosOrden } from "../lib/calc.js";
import { auth } from "../firebase.js";
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { formatMoney } from "../utils/format.js";
import { exportarOrdenes, exportarClientes, exportarBalance, exportarRepuestos } from "../utils/export.js";

const APP_VERSION = "1.0.0";

const DIFICULTADES = [
  { key: "facil",      label: "Fácil" },
  { key: "normal",     label: "Normal" },
  { key: "dificil",    label: "Difícil" },
  { key: "complicado", label: "Complicado" },
];

export default function ConfigView({ setView, showToast, orders = [], bikes = [], clients = [], handleLogout, loadDemoData, clearAllData }) {
  const [cfg, setCfg] = useState(() => LS.getDoc("config", "global") || CONFIG_DEFAULT);
  const [backupMeta, setBackupMeta] = useState(getMeta);
  const [restoring, setRestoring] = useState(false);
  const fileInputRef = useRef(null);
  const caja = useCollection("caja");

  const balance = useMemo(
    () => caja.reduce((acc, mov) => (mov.tipo === "ingreso" ? acc + mov.monto : acc - mov.monto), 0),
    [caja]
  );

  // Stats del mes actual
  const mesActual = new Date().toISOString().slice(0, 7);
  const ordenesMes = useMemo(
    () => orders.filter(o => (o.fechaIngreso || "").startsWith(mesActual)),
    [orders, mesActual]
  );
  const { totalMes, gananciaMes } = useMemo(() => ({
    totalMes:    ordenesMes.reduce((s, o) => s + (o.total || 0), 0),
    gananciaMes: ordenesMes.reduce((s, o) => s + calcularResultadosOrden(o).margen, 0),
  }), [ordenesMes]);

  const margen = cfg.margenPolitica ?? 25;
  const horaCliente = Math.round(cfg.valorHoraInterno * (1 + margen / 100));

  const handleGuardarBackup = () => {
    exportBackup();
    setBackupMeta(getMeta());
    showToast("Backup guardado en el dispositivo ✓");
  };

  const handleRecuperar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setRestoring(true);
    try {
      await importBackup(file);
      showToast("Datos restaurados ✓ — recargando...");
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      showToast("Error al leer el archivo");
      setRestoring(false);
    }
  };

  const toggleAutoBackup = () => {
    setMeta({ autoBackupEnabled: !backupMeta.autoBackupEnabled });
    setBackupMeta(getMeta());
  };

  const setAutoBackupDays = (days) => {
    setMeta({ autoBackupDays: days });
    setBackupMeta(getMeta());
  };

  // ── MI CUENTA ─────────────────────────────────────────────────────
  const [accountAction, setAccountAction] = useState(null); // null | "password" | "email"
  const [currentPass, setCurrentPass]     = useState("");
  const [newPass, setNewPass]             = useState("");
  const [confirmPass, setConfirmPass]     = useState("");
  const [newEmail, setNewEmail]           = useState("");
  const [accountMsg, setAccountMsg]       = useState({ text: "", ok: false });
  const [accountLoading, setAccountLoading] = useState(false);

  const accountErr = (text) => setAccountMsg({ text, ok: false });
  const accountOk  = (text) => setAccountMsg({ text, ok: true });

  const reauth = async () => {
    const user = auth.currentUser;
    const cred = EmailAuthProvider.credential(user.email, currentPass);
    await reauthenticateWithCredential(user, cred);
  };

  const handleChangePassword = async () => {
    if (!currentPass || !newPass || !confirmPass) return accountErr("Completá todos los campos");
    if (newPass.length < 6)          return accountErr("Mínimo 6 caracteres");
    if (newPass !== confirmPass)     return accountErr("Las contraseñas no coinciden");
    setAccountLoading(true);
    setAccountMsg({ text: "", ok: false });
    try {
      await reauth();
      await updatePassword(auth.currentUser, newPass);
      accountOk("Contraseña actualizada ✓");
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
      setTimeout(() => setAccountAction(null), 2000);
    } catch (e) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") accountErr("Contraseña actual incorrecta");
      else accountErr("Error: " + e.code);
    }
    setAccountLoading(false);
  };

  const handleChangeEmail = async () => {
    if (!currentPass || !newEmail) return accountErr("Completá todos los campos");
    if (!newEmail.includes("@"))    return accountErr("Email inválido");
    setAccountLoading(true);
    setAccountMsg({ text: "", ok: false });
    try {
      await reauth();
      await verifyBeforeUpdateEmail(auth.currentUser, newEmail);
      accountOk("Verificación enviada al nuevo email — confirmá desde ahí");
      setCurrentPass(""); setNewEmail("");
      setTimeout(() => setAccountAction(null), 3000);
    } catch (e) {
      if (e.code === "auth/wrong-password" || e.code === "auth/invalid-credential") accountErr("Contraseña actual incorrecta");
      else if (e.code === "auth/email-already-in-use") accountErr("Ese email ya tiene cuenta");
      else accountErr("Error: " + e.code);
    }
    setAccountLoading(false);
  };

  const resetAccountForm = (action) => {
    setAccountAction(action);
    setCurrentPass(""); setNewPass(""); setConfirmPass(""); setNewEmail("");
    setAccountMsg({ text: "", ok: false });
  };

  const guardar = () => {
    LS.setDoc("config", "global", { ...cfg, margenPolitica: margen, valorHoraCliente: horaCliente });
    showToast("Guardado ✓");
  };

  const setFactor = (key, val) => {
    const f = parseFloat(val);
    if (isNaN(f) || f <= 0) return;
    setCfg({ ...cfg, factorDificultad: { ...(cfg.factorDificultad || CONFIG_DEFAULT.factorDificultad), [key]: f } });
  };

  return (
    <div className="p-6 text-left animate-in slide-in-from-right duration-300 pb-28">

      <h1 className="text-4xl font-black text-white tracking-tighter mb-8 uppercase">Cuenta</h1>

      {/* ── BALANCE DEL MES ─────────────────────────────────────────── */}
      <div className="bg-slate-900 rounded-[2.5rem] p-6 mb-6 border border-slate-800 space-y-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Este mes</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-2xl p-4 text-center">
            <p className="text-2xl font-black text-blue-400">{ordenesMes.length}</p>
            <p className="text-[9px] font-black text-slate-500 uppercase mt-1">Órdenes</p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-4 text-center">
            <p className="text-lg font-black text-white">{formatMoney(totalMes)}</p>
            <p className="text-[9px] font-black text-slate-500 uppercase mt-1">Cobrado</p>
          </div>
          <div className="bg-slate-800 rounded-2xl p-4 text-center">
            <p className={`text-lg font-black ${gananciaMes >= 0 ? "text-green-400" : "text-red-400"}`}>{formatMoney(gananciaMes)}</p>
            <p className="text-[9px] font-black text-slate-500 uppercase mt-1">Ganancia</p>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Caja actual</p>
          <p className={`text-2xl font-black tracking-tighter ${balance >= 0 ? "text-green-400" : "text-red-400"}`}>
            {formatMoney(balance)}
          </p>
        </div>
      </div>

      {/* ── DATOS DEL TALLER ────────────────────────────────────────── */}
      <div className="space-y-4 bg-white p-8 rounded-[2.5rem] shadow-xl mb-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Datos del Taller</p>
        {[
          ["nombreTaller",        "Nombre Taller"],
          ["mecanicoResponsable", "Responsable"],
          ["dniMecanico",         "DNI"],
          ["telefonoTaller",      "Teléfono"],
        ].map(([field, label]) => (
          <div key={field} className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">{label}</label>
            <input
              value={cfg[field] ?? ""}
              onChange={e => setCfg({ ...cfg, [field]: e.target.value })}
              className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-blue-500"
            />
          </div>
        ))}
      </div>

      {/* ── POLÍTICA DE PRECIOS ─────────────────────────────────────── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-4 space-y-5">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Política de Precios</p>

        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Costo real por hora</label>
          <input
            type="number"
            value={cfg.valorHoraInterno}
            onChange={e => setCfg({ ...cfg, valorHoraInterno: Number(e.target.value) })}
            className="w-full border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-blue-500"
          />
          <p className="text-[10px] text-slate-400 ml-2">Gastos fijos del taller ÷ horas trabajadas al mes</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Margen por defecto</label>
            <span className="text-lg font-black text-blue-600">{margen}%</span>
          </div>
          <input
            type="range" min="5" max="120" step="5"
            value={margen}
            onChange={e => setCfg({ ...cfg, margenPolitica: Number(e.target.value) })}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[9px] text-slate-400 font-bold px-1">
            <span>5%</span><span>60%</span><span>120%</span>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[1.5rem] p-5 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Precio hora al cliente</p>
            <p className="text-[10px] text-slate-500">
              {formatMoney(cfg.valorHoraInterno)} × {(1 + margen / 100).toFixed(2)}
            </p>
          </div>
          <p className="text-3xl font-black text-blue-400">{formatMoney(horaCliente)}</p>
        </div>
      </div>

      {/* ── MULTIPLICADORES POR DIFICULTAD ──────────────────────────── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-4 space-y-4">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Multiplicadores por Dificultad</p>
        <div className="grid grid-cols-2 gap-3">
          {DIFICULTADES.map(({ key, label }) => {
            const factor = cfg.factorDificultad?.[key] ?? CONFIG_DEFAULT.factorDificultad[key];
            return (
              <div key={key} className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase ml-1 tracking-widest">{label}</label>
                <div className="flex items-center gap-2 border-2 border-slate-100 rounded-xl p-3">
                  <input
                    type="number" step="0.1" min="0.5" max="5" value={factor}
                    onChange={e => setFactor(key, e.target.value)}
                    className="w-full font-black text-center outline-none bg-transparent"
                  />
                  <span className="text-[10px] text-slate-400 font-bold">×</span>
                </div>
                <p className="text-[9px] text-slate-400 ml-1 text-center">
                  = {formatMoney(Math.round(horaCliente * factor))}/h
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <button onClick={guardar} className="w-full bg-blue-600 text-white py-5 rounded-3xl font-black uppercase shadow-xl active:scale-95 transition-all mb-8">
        Guardar Configuración
      </button>

      {/* ── EXPORTAR DATOS ──────────────────────────────────────────── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-4 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <Download size={18} className="text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Exportar Datos</p>
        </div>
        <p className="text-[10px] text-slate-400">Archivos CSV — abrís en Excel, Google Sheets o Numbers.</p>

        <div className="space-y-2">
          {[
            { label: "Órdenes de trabajo",  sub: `${orders.length} registros`,           fn: () => { exportarOrdenes(orders, bikes, clients); showToast("Exportando órdenes..."); } },
            { label: "Clientes",             sub: `${clients.length} registros`,          fn: () => { exportarClientes(clients, orders);       showToast("Exportando clientes..."); } },
            { label: "Balance mensual",      sub: "Totales agrupados por mes",            fn: () => { exportarBalance(orders);                  showToast("Exportando balance..."); } },
            { label: "Repuestos utilizados", sub: "Ranking por frecuencia de uso",        fn: () => { exportarRepuestos(orders);                showToast("Exportando repuestos..."); } },
          ].map(({ label, sub, fn }) => (
            <button key={label} onClick={fn}
              className="w-full flex items-center justify-between bg-slate-50 border border-slate-100 rounded-2xl p-4 active:scale-[0.98] transition-all">
              <div className="text-left">
                <p className="text-sm font-black text-slate-800">{label}</p>
                <p className="text-[10px] text-slate-400 font-bold">{sub}</p>
              </div>
              <Download size={16} className="text-blue-500 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* ── COPIA DE SEGURIDAD ──────────────────────────────────────── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-4 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <Save size={18} className="text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Copia de Seguridad</p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Último backup</p>
          <p className="text-sm font-black text-slate-700 mt-1">
            {backupMeta.lastBackup
              ? new Date(backupMeta.lastBackup).toLocaleString("es-AR")
              : "Nunca realizado"}
          </p>
        </div>

        <button onClick={handleGuardarBackup}
          className="w-full flex items-center justify-between bg-blue-600 text-white rounded-2xl p-4 active:scale-[0.98] transition-all">
          <div className="text-left">
            <p className="text-sm font-black">Guardar ahora</p>
            <p className="text-[10px] opacity-75 font-bold">Descarga un archivo .json al dispositivo</p>
          </div>
          <Save size={18} className="flex-shrink-0" />
        </button>

        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleRecuperar} />
        <button onClick={() => fileInputRef.current?.click()} disabled={restoring}
          className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 rounded-2xl p-4 active:scale-[0.98] transition-all disabled:opacity-50">
          <div className="text-left">
            <p className="text-sm font-black text-slate-800">{restoring ? "Restaurando..." : "Recuperar backup"}</p>
            <p className="text-[10px] text-slate-400 font-bold">Seleccioná un archivo .json guardado</p>
          </div>
          <Upload size={18} className="text-slate-500 flex-shrink-0" />
        </button>

        <div className="border-t border-slate-100 pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-slate-700">Auto-backup</p>
              <p className="text-[10px] text-slate-400 font-bold">Guarda al abrir la app automáticamente</p>
            </div>
            <button onClick={toggleAutoBackup}
              className={`relative w-12 h-6 rounded-full transition-colors ${backupMeta.autoBackupEnabled ? "bg-blue-600" : "bg-slate-200"}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${backupMeta.autoBackupEnabled ? "left-6" : "left-0.5"}`} />
            </button>
          </div>

          {backupMeta.autoBackupEnabled && (
            <div className="space-y-2">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Frecuencia</p>
              <div className="grid grid-cols-3 gap-2">
                {[{ d: 1, label: "Diario" }, { d: 3, label: "Cada 3d" }, { d: 7, label: "Semanal" }].map(({ d, label }) => (
                  <button key={d} onClick={() => setAutoBackupDays(d)}
                    className={`py-2 rounded-xl font-black text-xs transition-all ${(backupMeta.autoBackupDays || 1) === d ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── VERSIÓN DE LA APP ───────────────────────────────────────── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-4 space-y-3">
        <div className="flex items-center gap-3 mb-1">
          <Info size={18} className="text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Versión de la App</p>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm font-black text-slate-700">Johnny Blaze OS</span>
          <span className="bg-blue-50 text-blue-600 text-[10px] font-black px-3 py-1 rounded-full border border-blue-100">v{APP_VERSION}</span>
        </div>
        <p className="text-[10px] text-slate-400">
          Si la app no muestra los últimos cambios, recargá la página desde el navegador.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-slate-50 border border-slate-200 text-slate-600 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
        >
          Recargar app
        </button>
      </div>

      {/* ── MI CUENTA ───────────────────────────────────────────────── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-4 space-y-4">
        <div className="flex items-center gap-3 mb-1">
          <User size={18} className="text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mi Cuenta</p>
        </div>

        <div className="bg-slate-50 rounded-2xl p-4">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email actual</p>
          <p className="text-sm font-black text-slate-700 mt-1 break-all">{auth.currentUser?.email}</p>
        </div>

        {/* Botones acción */}
        {!accountAction && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => resetAccountForm("password")}
              className="flex flex-col items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 active:scale-[0.98] transition-all">
              <Lock size={18} className="text-slate-500" />
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-wide text-center">Cambiar contraseña</p>
            </button>
            <button onClick={() => resetAccountForm("email")}
              className="flex flex-col items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-4 active:scale-[0.98] transition-all">
              <Mail size={18} className="text-slate-500" />
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-wide text-center">Cambiar email</p>
            </button>
          </div>
        )}

        {/* Formulario cambiar contraseña */}
        {accountAction === "password" && (
          <div className="space-y-3 border border-slate-100 rounded-2xl p-5">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nueva contraseña</p>
            {[
              { placeholder: "Contraseña actual",    value: currentPass, set: setCurrentPass },
              { placeholder: "Nueva contraseña",     value: newPass,     set: setNewPass },
              { placeholder: "Confirmar contraseña", value: confirmPass, set: setConfirmPass },
            ].map(({ placeholder, value, set }) => (
              <input key={placeholder} type="password" placeholder={placeholder} value={value}
                onChange={e => set(e.target.value)}
                className="w-full border-2 border-slate-100 rounded-xl p-3 font-black text-sm outline-none focus:border-blue-500" />
            ))}
            {accountMsg.text && (
              <p className={`text-[11px] font-bold ${accountMsg.ok ? "text-green-600" : "text-red-500"}`}>{accountMsg.text}</p>
            )}
            <button onClick={handleChangePassword} disabled={accountLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[11px] uppercase active:scale-95 transition-all disabled:opacity-50">
              {accountLoading ? "Guardando..." : "Guardar contraseña"}
            </button>
            <button onClick={() => setAccountAction(null)}
              className="w-full text-slate-400 font-black text-[10px] uppercase py-2">
              Cancelar
            </button>
          </div>
        )}

        {/* Formulario cambiar email */}
        {accountAction === "email" && (
          <div className="space-y-3 border border-slate-100 rounded-2xl p-5">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cambiar email</p>
            <p className="text-[10px] text-slate-400">Se enviará un link de verificación al nuevo email. Solo se actualiza al confirmar.</p>
            {[
              { placeholder: "Contraseña actual", value: currentPass, set: setCurrentPass, type: "password" },
              { placeholder: "Nuevo email",        value: newEmail,   set: setNewEmail,    type: "email"    },
            ].map(({ placeholder, value, set, type }) => (
              <input key={placeholder} type={type} placeholder={placeholder} value={value}
                onChange={e => set(e.target.value)}
                className="w-full border-2 border-slate-100 rounded-xl p-3 font-black text-sm outline-none focus:border-blue-500" />
            ))}
            {accountMsg.text && (
              <p className={`text-[11px] font-bold ${accountMsg.ok ? "text-green-600" : "text-red-500"}`}>{accountMsg.text}</p>
            )}
            <button onClick={handleChangeEmail} disabled={accountLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[11px] uppercase active:scale-95 transition-all disabled:opacity-50">
              {accountLoading ? "Enviando..." : "Enviar verificación"}
            </button>
            <button onClick={() => setAccountAction(null)}
              className="w-full text-slate-400 font-black text-[10px] uppercase py-2">
              Cancelar
            </button>
          </div>
        )}
      </div>

      {/* ── SISTEMA ─────────────────────────────────────────────────── */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl mb-4 space-y-3">
        <div className="flex items-center gap-3 mb-1">
          <Database size={18} className="text-slate-400" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sistema</p>
        </div>

        {loadDemoData && (
          <button onClick={() => { loadDemoData(); showToast("Demo cargado ✓"); }}
            className="w-full bg-slate-50 border border-slate-200 text-slate-700 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
            Cargar datos de prueba
          </button>
        )}

        {clearAllData && (
          <button onClick={clearAllData}
            className="w-full flex items-center justify-center gap-2 bg-red-50 border border-red-100 text-red-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
            <Trash2 size={14} /> Borrar todos los datos
          </button>
        )}

        {handleLogout && (
          <button onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">
            <LogOut size={14} /> Cerrar sesión
          </button>
        )}
      </div>

    </div>
  );
}
