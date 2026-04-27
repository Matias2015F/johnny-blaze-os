import { db } from "../firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

// Validar si el usuario tiene acceso activo (trial o plan pago)
export async function validarAcceso(uid) {
  const ref = doc(db, "usuarios", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return { acceso: false, motivo: "sin_usuario" };

  const data = snap.data();
  const ahora = Date.now();

  if (data.estado === "trial") {
    return ahora < data.trialFin
      ? { acceso: true }
      : { acceso: false, motivo: "trial_vencido" };
  }

  if (data.estado === "activo") {
    return ahora < data.activoHasta
      ? { acceso: true }
      : { acceso: false, motivo: "plan_vencido" };
  }

  return { acceso: false, motivo: "sin_permisos" };
}

export const DURACION_TRIAL = 30 * 60 * 1000;

// Crear trial para usuario nuevo
export async function crearTrial(uid, email) {
  const ahora = Date.now();

  await setDoc(doc(db, "usuarios", uid), {
    email,
    estado: "trial",
    trialInicio: ahora,
    trialFin: ahora + DURACION_TRIAL,
    createdAt: ahora,
  });
}
