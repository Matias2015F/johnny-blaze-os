import { useState } from "react";
import { auth, db } from "../firebase.js";
import { doc, getDoc } from "firebase/firestore";
import { createCloudBackup, listCloudBackups, restoreCloudBackup } from "../lib/cloudBackup.js";

export function useBackupPanel() {
  const [backups,          setBackups]          = useState([]);
  const [loadingBackups,   setLoadingBackups]   = useState(false);
  const [guardandoBkp,     setGuardandoBkp]     = useState(false);
  const [restaurando,      setRestaurando]      = useState(null);
  const [restoreStateInfo, setRestoreStateInfo] = useState(null);

  // Retorna string de error o null. La vista toastea si recibe string.
  const cargarBackups = async () => {
    setLoadingBackups(true);
    try {
      const uid = auth.currentUser?.uid;
      const [lista, rsSnap] = await Promise.all([
        listCloudBackups(uid),
        getDoc(doc(db, "users", uid, "restoreState", "current")).catch(() => null),
      ]);
      setBackups(lista);
      if (rsSnap?.exists()) setRestoreStateInfo(rsSnap.data());
      return null;
    } catch (e) {
      return "No se pudieron cargar las copias: " + e.message;
    } finally {
      setLoadingBackups(false);
    }
  };

  // Retorna { ok, mensaje }. La vista llama showToast(mensaje).
  const guardarEnNube = async () => {
    setGuardandoBkp(true);
    try {
      const uid = auth.currentUser?.uid;
      const r = await createCloudBackup(uid);
      cargarBackups(); // refresca lista en background
      return {
        ok: true,
        mensaje: r
          ? `Copia guardada en la nube. ${r.total} registros protegidos.`
          : "No se encontraron datos para respaldar.",
      };
    } catch (e) {
      return { ok: false, mensaje: "No se pudo completar la operación: " + e.message };
    } finally {
      setGuardandoBkp(false);
    }
  };

  // Retorna { ok, mensaje }. La vista llama showToast(mensaje) y si ok recarga.
  const ejecutarRestauracion = async (backup) => {
    setRestaurando(backup.id);
    try {
      const uid = auth.currentUser?.uid;
      const n = await restoreCloudBackup(uid, backup.id);
      return {
        ok: true,
        mensaje: `Restauración completa. ${n} registros recuperados. La app se va a recargar.`,
      };
    } catch (e) {
      return { ok: false, mensaje: `No se restauró la copia. Motivo: ${e.message}` };
    } finally {
      setRestaurando(null);
    }
  };

  return {
    backups, loadingBackups, guardandoBkp, restaurando, restoreStateInfo,
    cargarBackups, guardarEnNube, ejecutarRestauracion,
  };
}
