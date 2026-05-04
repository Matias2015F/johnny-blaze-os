let db;
try {
  db = require("./_firebase-admin.js").db;
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

const { MercadoPagoConfig, Preference } = require("mercadopago");

const PLANES = {
  base: { label: "Plan Base", monto: 5000, dias: 30 },
  pro:  { label: "Plan Pro",  monto: 12000, dias: 30 },
};

const BASE_URL = "https://johnny-blaze-os.vercel.app";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (!db) {
    console.error("Firebase Admin no inicializado");
    return res.status(500).json({ error: "Error de configuración del servidor" });
  }

  const { uid, plan: planKey } = req.body || {};
  if (!uid || !PLANES[planKey]) {
    return res.status(400).json({ error: "uid y plan son requeridos" });
  }

  const snap = await db.collection("usuarios").doc(uid).get();
  if (!snap.exists) return res.status(404).json({ error: "Usuario no encontrado" });

  const plan = PLANES[planKey];

  const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
  const preference = new Preference(client);

  let response;
  try {
    response = await preference.create({
      body: {
        items: [{
          title: `Johnny Blaze OS — ${plan.label}`,
          quantity: 1,
          unit_price: plan.monto,
          currency_id: "ARS",
        }],
        external_reference: uid,
        back_urls: {
          success: `${BASE_URL}/?pago=ok`,
          failure: `${BASE_URL}/?pago=error`,
          pending: `${BASE_URL}/?pago=pendiente`,
        },
        auto_return: "approved",
        notification_url: `${BASE_URL}/api/mp-webhook`,
      },
    });
  } catch (err) {
    console.error("Error SDK MP:", JSON.stringify(err));
    return res.status(502).json({ error: "Error al conectar con Mercado Pago", detail: String(err?.message || err) });
  }

  return res.status(200).json({
    preferenceId: response.id,
    url: response.sandbox_init_point || response.init_point,
  });
};
