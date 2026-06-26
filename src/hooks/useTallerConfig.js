import { LS } from "../lib/storage.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";
import { DEFAULT_SAAS_ADMIN_SETTINGS as DEFAULT_ADMIN_SETTINGS } from "../services/saasService.js";
import { auth, db } from "../firebase.js";
import { doc, setDoc } from "firebase/firestore";

export function useTallerConfig({ cfg, setCfg }) {
  const margen      = cfg.margenPolitica ?? 25;
  const horaCliente = Math.round((cfg.valorHoraInterno || 0) * (1 + margen / 100));

  const setPrecioConfig = (newCfg) => {
    const m  = newCfg.margenPolitica ?? 25;
    const hc = Math.round((newCfg.valorHoraInterno || 0) * (1 + m / 100));
    const toSave = { ...newCfg, valorHoraCliente: hc };
    setCfg(toSave);
    LS.setDoc("config", "global", toSave);
  };

  // Retorna void. La vista llama showToast después de invocar esto.
  const guardar = () => {
    const toSave = { ...cfg, margenPolitica: margen, valorHoraCliente: horaCliente };
    LS.setDoc("config", "global", toSave);
    const uid = auth.currentUser?.uid;
    if (uid && cfg.emailNotificacion) {
      setDoc(doc(db, "usuarios", uid), { emailNotificacion: cfg.emailNotificacion }, { merge: true }).catch(console.error);
    }
    setDoc(
      doc(db, "admin_settings", "global"),
      { notificationEmail: cfg.emailNotificacion || auth.currentUser?.email || DEFAULT_ADMIN_SETTINGS.notificationEmail },
      { merge: true }
    ).catch(console.error);
  };

  const setFactor = (key, val) => {
    const f = Math.round(val * 10) / 10;
    if (f <= 0) return;
    setPrecioConfig({
      ...cfg,
      factorDificultad: { ...(cfg.factorDificultad || CONFIG_DEFAULT.factorDificultad), [key]: f },
    });
  };

  return { margen, horaCliente, setPrecioConfig, guardar, setFactor };
}
