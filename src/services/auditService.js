import { db, auth } from "../firebase.js";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function logAction(action, targetId, targetType, meta = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await addDoc(collection(db, "criticalAuditLogs"), {
      action,
      targetId: targetId || "",
      targetType: targetType || "",
      meta,
      uid,
      ip: null,
      ts: Date.now(),
      createdAt: serverTimestamp(),
    });
  } catch {
    // fire-and-forget: nunca bloquea la accion del usuario
  }
}
