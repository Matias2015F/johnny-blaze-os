let db;
try {
  db = require("./_firebase-admin.js").db;
} catch (e) {
  console.error("Firebase Admin error:", e.message);
}

const PLANES = {
  base: { label: "Plan Base", monto: 5000 },
  pro:  { label: "Plan Pro",  monto: 12000 },
};

const BASE_URL = "https://johnny-blaze-os.vercel.app";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!db) return res.status(500).json({ error: "Firebase no inicializado" });

  const { uid, plan } = req.body || {};
  if (!uid || !PLANES[plan]) return res.status(400).json({ error: "uid y plan requeridos" });

  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) return res.status(500).json({ error: "MP_ACCESS_TOKEN no configurado" });

  const p = PLANES[plan];
  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: `Johnny Blaze OS — ${p.label}`, quantity: 1, unit_price: p.monto, currency_id: "ARS" }],
      external_reference: uid,
      metadata: { uid },
      back_urls: {
        success: `${BASE_URL}/?pago=ok`,
        failure: `${BASE_URL}/?pago=error`,
        pending: `${BASE_URL}/?pago=pendiente`,
      },
      auto_return: "approved",
      notification_url: `${BASE_URL}/api/mp-webhook`,
    }),
  });

  const body = await mpRes.json();
  if (!mpRes.ok) {
    const cause = body.cause?.[0]?.description || body.message || body.error || "Error MP";
    console.error("MP error:", mpRes.status, JSON.stringify(body));
    return res.status(502).json({ error: `MP ${mpRes.status}: ${cause}` });
  }

  console.log("MP sandbox_init_point:", body.sandbox_init_point);
  console.log("MP init_point:", body.init_point);

  return res.status(200).json({
    preferenceId: body.id,
    url: body.init_point,
  });
};
