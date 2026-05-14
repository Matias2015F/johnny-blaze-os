// Endpoint temporal — lee y corrige admin_settings/global.precios.pro
// Protegido con CRON_SECRET. Eliminar después de ejecutar.
const { db } = require("./_firebase-admin.js");

module.exports = async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const ref = db.collection("admin_settings").doc("global");
  const snap = await ref.get();
  if (!snap.exists) return res.status(200).json({ error: "admin_settings/global no existe" });

  const data = snap.data();
  const precioActual = data?.precios?.pro;

  if (precioActual !== 220000) {
    await ref.set({ precios: { ...data.precios, pro: 220000 } }, { merge: true });
    return res.status(200).json({ ok: true, actualizado: true, de: precioActual, a: 220000 });
  }
  return res.status(200).json({ ok: true, actualizado: false, precio: precioActual, precios: data.precios });
};
