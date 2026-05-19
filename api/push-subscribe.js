// Guarda o elimina una suscripción Web Push en Firestore
// POST { subscription } — guarda (uid resuelto del token Firebase)
// DELETE { endpoint }   — elimina (uid resuelto del token Firebase)

const { db, verifyIdToken } = require("./_firebase-admin.js");
const crypto = require("crypto");
const { applyRateLimit } = require("./_ratelimit.js");

function endpointHash(endpoint) {
  return crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 20);
}

module.exports = async function handler(req, res) {
  if (applyRateLimit(req, res, "push-subscribe")) return;

  let decoded;
  try {
    decoded = await verifyIdToken(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: "No autorizado" });
  }
  const uid = decoded.uid;

  if (req.method === "POST") {
    const { subscription } = req.body || {};
    if (!subscription?.endpoint) {
      return res.status(400).json({ error: "subscription.endpoint requerido" });
    }
    const hash = endpointHash(subscription.endpoint);
    await db.collection("users").doc(uid).collection("pushSubscriptions").doc(hash).set({
      endpoint: subscription.endpoint,
      keys: subscription.keys || null,
      expirationTime: subscription.expirationTime || null,
      uid,
      updatedAt: Date.now(),
    });
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ error: "endpoint requerido" });
    }
    const hash = endpointHash(endpoint);
    await db.collection("users").doc(uid).collection("pushSubscriptions").doc(hash).delete();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
};
