let db, verifyIdToken;
try {
  ({ db, verifyIdToken } = require("./_firebase-admin.js"));
} catch (e) {
  console.error("Firebase Admin error:", e.message);
}

const crypto = require("crypto");
const { FieldValue } = require("firebase-admin/firestore");
const { applyRateLimit } = require("./_ratelimit.js");
const { sendEmail, templateCancelPlanOffer } = require("./_email.js");

function newToken(prefix = "o") {
  return `${prefix}${crypto.randomUUID().replace(/-/g, "")}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!db) return res.status(500).json({ error: "Firebase no inicializado" });
  if (applyRateLimit(req, res, "cancel-plan")) return;

  let decoded;
  try {
    decoded = await verifyIdToken(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: "No autorizado" });
  }

  const uid = decoded.uid;
  const { reasonCode, reasonText, comment } = req.body || {};

  const userRef = db.collection("usuarios").doc(uid);
  const snap = await userRef.get();
  const userData = snap.exists ? snap.data() || {} : {};
  const emailDestino = userData.emailNotificacion || userData.email || decoded.email || "";
  const planKey = String(userData.currentPlanKey || userData.plan || "base").toLowerCase();

  // 30% off for one renewal attempt, valid 72h.
  const offerToken = newToken("off_");
  const now = Date.now();
  const expiresAt = now + 72 * 60 * 60 * 1000;

  const offerDoc = {
    token: offerToken,
    uid,
    planKey,
    discountPct: 30,
    createdAt: now,
    expiresAt,
    used: false,
    usedAt: null,
  };

  await userRef.set(
    {
      cancelAtPeriodEnd: true,
      requestedAction: "cancel_plan",
      cancellationFeedback: {
        reasonCode: String(reasonCode || "").slice(0, 40),
        reasonText: String(reasonText || "").slice(0, 120),
        comment: String(comment || "").slice(0, 800),
        createdAt: now,
      },
      updatedAt: now,
    },
    { merge: true }
  );

  await userRef.collection("retentionOffers").doc(offerToken).set(offerDoc, { merge: false });

  // Also create a support ticket for visibility/audit.
  db.collection("soporteTickets")
    .add({
      uid,
      email: emailDestino || "",
      tipo: "cancel_plan",
      estado: "nuevo",
      mensaje: `Cancelación pedida. Motivo: ${String(reasonCode || "")} ${reasonText ? `- ${reasonText}` : ""}${comment ? `\n\nComentario: ${comment}` : ""}`.slice(0, 1800),
      currentPlanKey: planKey,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    .catch(() => {});

  // Email is best-effort; cancellation must not depend on it.
  if (emailDestino) {
    try {
      const verifyUrl = `https://app.motogestion.ar/oferta/${offerToken}`;
      const tpl = templateCancelPlanOffer({
        plan: planKey,
        discountPct: offerDoc.discountPct,
        expiresAt,
        verifyUrl,
      });
      await sendEmail({ to: emailDestino, ...tpl });
    } catch (e) {
      console.warn("[cancel-plan] email no enviado:", e.message);
    }
  }

  return res.status(200).json({ ok: true, offerToken });
};

