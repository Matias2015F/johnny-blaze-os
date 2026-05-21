import { db } from "../firebase.js";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export async function logAdminAction({ action, targetUid = "", targetEmail = "", actorUid = "", actorEmail = "", before = null, after = null, reason = "" }) {
  try {
    await addDoc(collection(db, "adminAuditLogs"), {
      action,
      targetUid,
      targetEmail,
      actorUid,
      actorEmail,
      before: before || null,
      after: after || null,
      reason,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[adminAudit] No se pudo registrar auditoría:", e.message);
  }
}
