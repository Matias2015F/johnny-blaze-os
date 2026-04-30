let db;
try {
  db = require("./_firebase-admin.js").db;
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

const DEFAULT_PLANS = {
  base: {
    label: "Plan Base",
    price: 5000,
    currency: "ARS",
    billingDays: 30,
  },
  pro: {
    label: "Plan Pro",
    price: 12000,
    currency: "ARS",
    billingDays: 30,
  },
};

const BASE_URL = "https://johnny-blaze-os.vercel.app";

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (!db) {
    return res.status(500).json({ error: "Error de configuración del servidor" });
  }

  const { uid, plan: requestedPlanKey } = req.body || {};
  if (!uid) return res.status(400).json({ error: "uid es requerido" });

  const accountRef = db.collection("accounts").doc(uid);
  const accountSnap = await accountRef.get();
  if (!accountSnap.exists) return res.status(404).json({ error: "Cuenta no encontrada" });
  const account = accountSnap.data();

  const settingsSnap = await db.collection("adminSettings").doc("global").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const plans = settings.plans || DEFAULT_PLANS;
  const planKey = plans[requestedPlanKey] ? requestedPlanKey : (account.currentPlanKey || "base");
  const plan = plans[planKey];

  if (!plan) return res.status(400).json({ error: "Plan inválido" });

  const now = Date.now();
  const invoiceRef = db.collection("billingInvoices").doc();
  const invoiceData = {
    invoiceId: invoiceRef.id,
    uid,
    accountId: uid,
    nombreTaller: account.nombreTaller || "Johnny Blaze OS",
    email: account.email || "",
    planKey,
    planLabel: plan.label || planKey,
    billingDays: Number(plan.billingDays || 30),
    amount: Number(plan.price || 0),
    currency: plan.currency || settings.subscriptionCurrency || "ARS",
    status: "pending",
    source: "mercado_pago",
    externalPaymentId: null,
    dueAt: now + 3 * 24 * 60 * 60 * 1000,
    createdAt: now,
    updatedAt: now,
  };

  await invoiceRef.set(invoiceData, { merge: true });

  const preference = {
    items: [{
      title: `Johnny Blaze OS - ${plan.label || planKey}`,
      quantity: 1,
      unit_price: Number(plan.price || 0),
      currency_id: plan.currency || "ARS",
    }],
    external_reference: `${uid}:${invoiceRef.id}`,
    back_urls: {
      success: `${BASE_URL}/?pago=ok`,
      failure: `${BASE_URL}/?pago=error`,
      pending: `${BASE_URL}/?pago=pendiente`,
    },
    auto_return: "approved",
    notification_url: `${BASE_URL}/api/mp-webhook`,
  };

  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preference),
  });

  if (!mpRes.ok) {
    const errorText = await mpRes.text();
    console.error("Error al crear preferencia MP:", errorText);
    await invoiceRef.set({
      status: "error",
      errorText,
      updatedAt: Date.now(),
    }, { merge: true });
    return res.status(502).json({ error: "Error al conectar con Mercado Pago" });
  }

  const data = await mpRes.json();

  await invoiceRef.set({
    preferenceId: data.id,
    checkoutUrl: data.init_point || data.sandbox_init_point || null,
    updatedAt: Date.now(),
  }, { merge: true });

  await db.collection("billingEvents").add({
    type: "preference_created",
    uid,
    invoiceId: invoiceRef.id,
    planKey,
    amount: Number(plan.price || 0),
    createdAt: Date.now(),
  });

  return res.status(200).json({
    preferenceId: data.id,
    invoiceId: invoiceRef.id,
    url: data.init_point || data.sandbox_init_point,
  });
};
