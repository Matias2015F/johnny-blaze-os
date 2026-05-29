let db, verifyIdToken;
try {
  ({ db, verifyIdToken } = require("./_firebase-admin.js"));
} catch (e) {
  console.error("Firebase Admin error:", e.message);
}

const { applyRateLimit } = require("./_ratelimit.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!db) return res.status(500).json({ error: "Firebase no inicializado" });
  if (applyRateLimit(req, res, "retention-offer")) return;

  let decoded;
  try {
    decoded = await verifyIdToken(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: "No autorizado" });
  }

  const uid = decoded.uid;
  const { offerToken } = req.body || {};
  const token = String(offerToken || "").trim();
  if (!token) return res.status(400).json({ error: "offerToken requerido" });

  const offerRef = db.collection("usuarios").doc(uid).collection("retentionOffers").doc(token);
  const snap = await offerRef.get();
  if (!snap.exists) return res.status(404).json({ error: "Oferta no encontrada" });

  const offer = snap.data() || {};
  if (offer.uid && offer.uid !== uid) return res.status(403).json({ error: "Oferta inválida" });
  if (offer.used) return res.status(409).json({ error: "Oferta ya utilizada" });
  if (offer.expiresAt && Number(offer.expiresAt) < Date.now()) return res.status(410).json({ error: "Oferta vencida" });

  return res.status(200).json({
    ok: true,
    planKey: offer.planKey || "base",
    discountPct: Number(offer.discountPct || 0) || 0,
    expiresAt: Number(offer.expiresAt || 0) || null,
  });
};

