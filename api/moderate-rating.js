let db, verifyIdToken;
try {
  ({ db, verifyIdToken } = require("./_firebase-admin.js"));
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

const { applyRateLimit } = require("./_ratelimit.js");

const ADMIN_EMAILS = String(process.env.PLATFORM_ADMIN_EMAILS || "matias4604@gmail.com,fefe@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_UIDS = String(process.env.PLATFORM_ADMIN_UIDS || "TNwwuKJsIXN29zJg8HWfORawdFm1")
  .split(",")
  .map((uid) => uid.trim())
  .filter(Boolean);

async function assertAdmin(decoded) {
  const uid = decoded?.uid || "";
  const email = String(decoded?.email || "").toLowerCase();
  if (ADMIN_UIDS.includes(uid) || ADMIN_EMAILS.includes(email)) return true;

  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  if (data.rol === "admin" || data.isPlatformAdmin === true) return true;

  const err = new Error("No autorizado como administrador");
  err.status = 403;
  throw err;
}

function safeString(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo no permitido" });
  if (!db) return res.status(500).json({ error: "Servidor sin base de datos" });
  if (applyRateLimit(req, res, "admin-moderate-rating")) return;

  let decoded;
  try {
    decoded = await verifyIdToken(req);
    await assertAdmin(decoded);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message || "No autorizado" });
  }

  const { ratingId, decision, reason } = req.body || {};
  const id = safeString(ratingId, 120);
  const normalizedDecision = safeString(decision, 30);

  if (!id) return res.status(400).json({ error: "ratingId requerido" });
  if (!["aprobar", "rechazar"].includes(normalizedDecision)) {
    return res.status(400).json({ error: "Decision invalida" });
  }

  try {
    const ref = db.collection("ratings").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ error: "Calificacion no encontrada" });

    const now = Date.now();
    const status = normalizedDecision === "aprobar" ? "aprobada" : "rechazada";
    const reputationWeight = normalizedDecision === "aprobar" ? 1 : 0;

    await ref.set({
      status,
      reputationWeight,
      moderationReason: safeString(reason, 300),
      moderatedAt: now,
      moderatedByUid: decoded.uid || "",
      moderatedByEmail: decoded.email || "",
      updatedAt: now,
    }, { merge: true });

    await db.collection("adminAuditLogs").add({
      action: `rating_${status}`,
      targetId: id,
      targetUid: snap.data()?.uidTaller || "",
      actorUid: decoded.uid || "",
      actorEmail: decoded.email || "",
      reason: safeString(reason, 300) || `Calificacion ${status}`,
      createdAt: now,
    });

    return res.status(200).json({ ok: true, ratingId: id, status, reputationWeight });
  } catch (error) {
    console.error("moderate-rating error:", error);
    return res.status(500).json({ error: error.message || "No se pudo moderar la calificacion" });
  }
};
