// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mp-create-preference
//
// Crea una preferencia de pago en Mercado Pago y devuelve la URL de checkout.
// El frontend llama este endpoint cuando el usuario elige un plan.
//
// Body esperado: { uid: string, plan: "mensual" | "trimestral" | "anual" }
// Respuesta:     { url: string, preferenceId: string }
// ─────────────────────────────────────────────────────────────────────────────

let db;
try {
  db = require("./_firebase-admin.js").db;
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANES — modificar precios y duraciones según tu modelo de negocio.
// El monto debe coincidir (con tolerancia) con lo definido en mp-webhook.js.
// Moneda: ARS. Cambiar currency_id si operás en otra moneda.
// ─────────────────────────────────────────────────────────────────────────────
const PLANES = {
  mensual: {
    label:  "Plan Mensual",
    monto:  5000,   // ARS — modificar precio
    dias:   30,
  },
  trimestral: {
    label:  "Plan Trimestral",
    monto:  12000,  // ARS — modificar precio
    dias:   90,
  },
  anual: {
    label:  "Plan Anual",
    monto:  40000,  // ARS — modificar precio
    dias:   365,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// URLs de retorno post-pago — cambiar si el dominio cambia.
// MP redirige al usuario a estas URLs según el resultado del pago.
// ─────────────────────────────────────────────────────────────────────────────
const BASE_URL = "https://johnny-blaze-os.vercel.app";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (!db) {
    console.error("Firebase Admin no inicializado");
    return res.status(500).json({ error: "Error de configuración del servidor. Revisá las variables de entorno." });
  }

  const { uid, plan: planKey } = req.body || {};

  if (!uid || !PLANES[planKey]) {
    return res.status(400).json({ error: "uid y plan son requeridos" });
  }

  // Verificar que el usuario existe antes de crear la preferencia
  const snap = await db.collection("usuarios").doc(uid).get();
  if (!snap.exists) return res.status(404).json({ error: "Usuario no encontrado" });

  const plan = PLANES[planKey];

  // ── Crear preferencia en Mercado Pago ─────────────────────────────────────
  // Docs: https://www.mercadopago.com.ar/developers/es/reference/preferences/_checkout_preferences/post
  const preference = {
    items: [{
      title:      `Johnny Blaze OS — ${plan.label}`,
      quantity:   1,
      unit_price: plan.monto,
      currency_id: "ARS", // Cambiar si usás otra moneda (USD, etc.)
    }],

    // external_reference es clave: llega en el webhook para identificar al usuario.
    // Si cambiás cómo identificás usuarios, modificá este campo y el webhook.
    external_reference: uid,

    back_urls: {
      success: `${BASE_URL}/?pago=ok`,
      failure: `${BASE_URL}/?pago=error`,
      pending: `${BASE_URL}/?pago=pendiente`,
    },
    auto_return: "approved", // Redirige automáticamente solo si el pago fue aprobado

    // notification_url: MP enviará el webhook a esta URL.
    // Debe ser pública. En desarrollo local usá ngrok para exponer localhost.
    notification_url: `${BASE_URL}/api/mp-webhook`,
  };

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method:  "POST",
    headers: {
      Authorization:  `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preference),
  });

  if (!mpRes.ok) {
    const errorText = await mpRes.text();
    console.error("Error al crear preferencia MP:", errorText);
    return res.status(502).json({ error: "Error al conectar con Mercado Pago" });
  }

  const data = await mpRes.json();

  return res.status(200).json({
    preferenceId: data.id,
    // ⚠️ sandbox_init_point → para pruebas con usuarios de prueba de MP
    // ⚠️ init_point         → para producción real (cambiar antes de salir en vivo)
    url: data.sandbox_init_point,
  });
};
