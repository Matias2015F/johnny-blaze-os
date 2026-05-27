let db;
try {
  ({ db } = require("./_firebase-admin.js"));
} catch (e) {
  console.error("Firebase Admin error:", e.message);
}
const { applyRateLimit } = require("./_ratelimit.js");

const FALLBACK = { base: 125000, pro: 300000, full: 900000, currency: "ARS" };

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "https://motogestion.ar");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).end();
  if (applyRateLimit(req, res, "public-prices")) return;

  if (!db) return res.status(200).json(FALLBACK);

  try {
    const snap = await db.collection("admin_settings").doc("global").get();
    const precios = snap.exists ? (snap.data().precios || {}) : {};
    return res.status(200).json({
      base:     Number(precios.base     ?? FALLBACK.base),
      pro:      Number(precios.pro      ?? FALLBACK.pro),
      full:     Number(precios.full     ?? FALLBACK.full),
      currency: precios.currency        || FALLBACK.currency,
    });
  } catch (err) {
    console.warn("[public-prices] Firestore error, using fallback:", err.message);
    return res.status(200).json(FALLBACK);
  }
};
