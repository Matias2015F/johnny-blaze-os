// Guarda o elimina una suscripción Web Push en Firestore
// POST { uid, subscription } — guarda
// DELETE { uid, endpoint }  — elimina

const { db } = require("./_firebase-admin.js");
const crypto = require("crypto");

function endpointHash(endpoint) {
  return crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 20);
}

module.exports = async function handler(req, res) {
  if (req.method === "POST") {
    const { uid, subscription } = req.body || {};
    if (!uid || !subscription?.endpoint) {
      return res.status(400).json({ error: "uid y subscription.endpoint requeridos" });
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
    const { uid, endpoint } = req.body || {};
    if (!uid || !endpoint) {
      return res.status(400).json({ error: "uid y endpoint requeridos" });
    }
    const hash = endpointHash(endpoint);
    await db.collection("users").doc(uid).collection("pushSubscriptions").doc(hash).delete();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
};
