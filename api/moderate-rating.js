let db, verifyIdToken;
try {
  ({ db, verifyIdToken } = require("./_firebase-admin.js"));
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

const { applyRateLimit } = require("./_ratelimit.js");

const ADMIN_EMAILS = String(process.env.PLATFORM_ADMIN_EMAILS || "matias4604@gmail.com")
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

function normalizeDiscountPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(50, Math.round(n)));
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
    const status = normalizedDecision === "aprobar" ? "aprobado" : "rechazado";
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

    if (normalizedDecision === "aprobar") {
      const ratingData = snap.data() || {};
      crearBeneficioCalificacion({
        uidTaller: ratingData.uidTaller || "",
        token: ratingData.token || "",
        ordenOrigen: ratingData.numeroOrden || "",
        ratingId: id,
        discountPct: ratingData.incentiveDiscountPct,
      }).catch((e) => console.warn("[moderate-rating] beneficio no creado:", e.message));
    }

    return res.status(200).json({ ok: true, ratingId: id, status, reputationWeight });
  } catch (error) {
    console.error("moderate-rating error:", error);
    return res.status(500).json({ error: error.message || "No se pudo moderar la calificacion" });
  }
};

async function crearBeneficioCalificacion({ uidTaller, token, ordenOrigen, ratingId, discountPct }) {
  if (!uidTaller || !token) return;

  const receiptSnap = await db.collection("publicReceipts").doc(token).get();
  if (!receiptSnap.exists) return;
  const receipt = receiptSnap.data() || {};

  const patente = String(receipt.bikePatente || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!patente) return;

  const configSnap = await db.collection("users").doc(uidTaller).collection("config").doc("global").get();
  const configPct = normalizeDiscountPct((configSnap.exists ? configSnap.data() : {}).descuentoCalificacionPct ?? 15);
  const receiptPct = normalizeDiscountPct(receipt.incentive?.discountPct);
  const finalDiscountPct = normalizeDiscountPct(discountPct) || receiptPct || configPct;
  if (finalDiscountPct <= 0) return;

  const beneficioRef = db.collection("users").doc(uidTaller).collection("clienteBeneficios").doc(patente);
  const snap = await beneficioRef.get();
  if (snap.exists && snap.data().estado === "activo") return;

  await beneficioRef.set({
    patente,
    bikeId: receipt.bikeId || "",
    ordenOrigen: ordenOrigen || receipt.numeroOrden || "",
    ratingId: ratingId || "",
    discountPct: finalDiscountPct,
    estado: "activo",
    creadoEn: Date.now(),
    usadoEn: null,
    ordenUsada: null,
  });
}
