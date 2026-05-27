// ENDPOINT TEMPORAL — borrar después de usarlo una vez.
// Actualiza admin_settings/global con los precios correctos.
// Uso: GET /api/admin-seed-prices?token=seed2026motogestion
// Solo funciona desde cuenta admin (uid hardcodeado).

let db, verifyIdToken;
try {
  ({ db, verifyIdToken } = require("./_firebase-admin.js"));
} catch (e) {
  console.error("Firebase Admin error:", e.message);
}

const ALLOWED_TOKEN = "seed2026motogestion";
const ADMIN_UID = "TNwwuKJsIXN29zJg8HWfORawdFm1";

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (!db) return res.status(500).json({ error: "Firebase no inicializado" });

  const token = req.query.token;
  if (token !== ALLOWED_TOKEN) return res.status(403).json({ error: "Token incorrecto" });

  let uid;
  try {
    const decoded = await verifyIdToken(req);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ error: "No autorizado — necesitás estar logueado en la app primero" });
  }

  if (uid !== ADMIN_UID) return res.status(403).json({ error: "Solo el admin de plataforma puede usar este endpoint" });

  const precios = { base: 125000, pro: 300000, full: 900000, currency: "ARS" };

  await db.collection("admin_settings").doc("global").set(
    { precios, updatedAt: Date.now(), updatedByUid: uid },
    { merge: true }
  );

  console.log("[admin-seed-prices] Precios actualizados:", precios, "por uid:", uid);
  return res.status(200).json({ ok: true, precios, mensaje: "Firestore actualizado. Podés borrar este endpoint." });
};
