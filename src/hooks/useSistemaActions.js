import { useState, useEffect } from "react";
import { LS } from "../lib/storage.js";
import { migrateFromRootCollections, forceSyncCacheToFirestore, clearFirestoreData } from "../lib/storage.js";
import { auth } from "../firebase.js";
import { deleteUser } from "firebase/auth";
import { APP_BUILD } from "../generated/appVersion.js";
import {
  applyRemoteUpdate, bindInstallPromptCapture, canPromptInstall,
  ensureNotificationPermission, fetchRemoteVersion, isNewerBuild,
  promptInstallApp, sendTestNotification,
} from "../lib/appUpdate.js";
import { subscribeToPush, unsubscribeFromPush, getPushStatus, isPushSupported } from "../lib/pushService.js";

// Todas las acciones retornan { ok, mensaje }. La vista llama showToast(mensaje).
export function useSistemaActions({ cfg, setCfg }) {
  const [migrando,         setMigrando]         = useState(false);
  const [deletingAccount,  setDeletingAccount]  = useState(false);
  const [remoteBuild,      setRemoteBuild]      = useState(null);
  const [checkingUpdate,   setCheckingUpdate]   = useState(false);
  const [updatingApp,      setUpdatingApp]      = useState(false);
  const [installAvailable, setInstallAvailable] = useState(false);
  const [pushStatus,       setPushStatus]       = useState("inactive");

  const hasRemoteUpdate = isNewerBuild(APP_BUILD, remoteBuild);

  useEffect(() => {
    const unbind = bindInstallPromptCapture();
    const syncInstall = () => setInstallAvailable(canPromptInstall());
    syncInstall();
    window.addEventListener("jbos-install-available", syncInstall);
    fetchRemoteVersion().then(setRemoteBuild).catch(console.error);
    getPushStatus().then(setPushStatus).catch(() => {});
    return () => {
      unbind();
      window.removeEventListener("jbos-install-available", syncInstall);
    };
  }, []);

  const migrarRaiz = async () => {
    setMigrando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return { ok: false, mensaje: "Sin sesion" };
      const n = await migrateFromRootCollections(uid);
      return { ok: true, mensaje: n > 0 ? `Migracion completa: ${n} registros movidos` : "Sin datos en colecciones raiz" };
    } catch (e) {
      return { ok: false, mensaje: "Error: " + e.message };
    } finally {
      setMigrando(false);
    }
  };

  const forzarSync = async () => {
    setMigrando(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return { ok: false, mensaje: "Sin sesion" };
      const n = await forceSyncCacheToFirestore(uid);
      return { ok: true, mensaje: n > 0 ? `Sincronizado: ${n} registros guardados en la nube` : "No hay datos en memoria para sincronizar" };
    } catch (e) {
      return { ok: false, mensaje: "Error: " + e.message };
    } finally {
      setMigrando(false);
    }
  };

  const toggleTestMode = () => {
    const nuevo = { ...cfg, testModeRecordatorios: !cfg.testModeRecordatorios };
    setCfg(nuevo);
    LS.setDoc("config", "global", nuevo);
    return { ok: true, mensaje: nuevo.testModeRecordatorios ? "Modo prueba activado" : "Modo prueba desactivado" };
  };

  const toggleAnalytics = () => {
    const nuevo = { ...cfg, analyticsEnabled: !(cfg.analyticsEnabled ?? true) };
    setCfg(nuevo);
    LS.setDoc("config", "global", nuevo);
    return { ok: true, mensaje: nuevo.analyticsEnabled ? "Analítica activada" : "Analítica desactivada" };
  };

  const toggleAlertasNavegador = async () => {
    const activar = !(cfg.alertasNavegadorActivas ?? true);
    const uid = auth.currentUser?.uid;
    if (activar) {
      const permiso = await ensureNotificationPermission();
      if (permiso !== "granted") {
        return { ok: false, mensaje: "El navegador no dio permiso para notificar" };
      }
      if (uid && isPushSupported()) {
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
    return { ok: true, mensaje: activar ? "Alertas del navegador activadas" : "Alertas del navegador desactivadas" };
  };

  const probarNotificacion = async () => {
    const result = await sendTestNotification();
    if (result.ok) return { ok: true, mensaje: "Notificación de prueba enviada." };
    if (result.permission === "denied") return { ok: false, mensaje: "El navegador bloqueo las notificaciones" };
    return { ok: false, mensaje: "No se pudo enviar la notificacion de prueba" };
  };

  const buscarActualizacion = async () => {
    setCheckingUpdate(true);
    try {
      const remote = await fetchRemoteVersion();
      setRemoteBuild(remote);
      return {
        ok: true,
        mensaje: isNewerBuild(APP_BUILD, remote)
          ? "Hay una versión nueva lista para instalar"
          : "Esta app ya tiene la última versión",
      };
    } catch {
      return { ok: false, mensaje: "No se pudo consultar la última versión" };
    } finally {
      setCheckingUpdate(false);
    }
  };

  const instalarActualizacion = async () => {
    setUpdatingApp(true);
    try {
      const remote = remoteBuild || await fetchRemoteVersion();
      await applyRemoteUpdate(remote);
      return { ok: true, mensaje: null }; // la app se recarga sola si llega acá
    } catch {
      setUpdatingApp(false);
      return { ok: false, mensaje: "No se pudo instalar la actualizacion" };
    }
  };

  const instalarApp = async () => {
    const result = await promptInstallApp();
    if (result.ok) {
      setInstallAvailable(false);
      return { ok: true, mensaje: "Instalacion iniciada" };
    }
    if (result.reason === "unavailable") {
      return { ok: false, mensaje: "El instalador no esta disponible en este navegador o dispositivo" };
    }
    return { ok: false, mensaje: "La instalacion fue cancelada" };
  };

  // La vista valida deleteConfirmText antes de llamar esto.
  const eliminarCuenta = async () => {
    setDeletingAccount(true);
    try {
      const uid = auth.currentUser?.uid;
      if (uid) await clearFirestoreData(uid).catch(() => {});
      await deleteUser(auth.currentUser);
      return { ok: true, mensaje: null }; // Firebase Auth cierra sesión automáticamente
    } catch (e) {
      setDeletingAccount(false);
      if (e.code === "auth/requires-recent-login") {
        return { ok: false, mensaje: "Cerrá sesión, volvé a ingresar y repetí la operación" };
      }
      return { ok: false, mensaje: "No se pudo eliminar la cuenta. Intentá de nuevo." };
    }
  };

  return {
    migrando, deletingAccount, remoteBuild, checkingUpdate, updatingApp,
    installAvailable, pushStatus, hasRemoteUpdate,
    migrarRaiz, forzarSync, toggleTestMode, toggleAnalytics,
    toggleAlertasNavegador, probarNotificacion,
    buscarActualizacion, instalarActualizacion, instalarApp, eliminarCuenta,
  };
}
