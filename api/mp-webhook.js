const { db } = require("./_firebase-admin.js");

const DEFAULT_PLANS = {
  base: {
    label: "Plan Base",
    price: 5000,
    currency: "ARS",
    billingDays: 30,
    features: {
      pdf: true,
      recordatorios: true,
      analytics: false,
      multiusuario: false,
    },
  },
  pro: {
    label: "Plan Pro",
    price: 12000,
    currency: "ARS",
    billingDays: 30,
    features: {
      pdf: true,
      recordatorios: true,
      analytics: true,
      multiusuario: true,
    },
  },
};

function parseExternalReference(value) {
  if (!value) return { uid: "", invoiceId: "" };
  const [uid, invoiceId] = String(value).split(":");
  return { uid: uid || "", invoiceId: invoiceId || "" };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { type, data } = req.body || {};
  if (type !== "payment") {
    return res.status(200).json({ ok: true, ignored: true, type });
  }

  const paymentId = data?.id;
  if (!paymentId) return res.status(400).json({ error: "Sin payment id" });

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });

  if (!mpRes.ok) {
    console.error("Error al consultar pago en MP:", await mpRes.text());
    return res.status(200).json({ error: "No se pudo verificar el pago" });
  }

  const pago = await mpRes.json();
  const { uid, invoiceId } = parseExternalReference(pago.external_reference);

  if (!uid) {
    console.error("Pago sin uid en external_reference:", paymentId);
    return res.status(400).json({ error: "Sin uid" });
  }

  const accountRef = db.collection("usuarios").doc(uid);
  let settingsSnap = await db.collection("admin_settings").doc("global").get();
  if (!settingsSnap.exists) {
    const legacySettingsSnap = await db.collection("adminSettings").doc("global").get();
    if (legacySettingsSnap.exists) {
      const legacy = legacySettingsSnap.data() || {};
      settingsSnap = { exists: true, data: () => ({
        precios: {
          base: Number(legacy.subscriptionPrice ?? legacy.plans?.base?.price ?? DEFAULT_PLANS.base.price),
          pro: Number(legacy.plans?.pro?.price ?? DEFAULT_PLANS.pro.price),
          currency: legacy.subscriptionCurrency || legacy.plans?.base?.currency || "ARS",
        },
        graceDaysDefault: Number(legacy.graceDaysDefault || 3),
        features: legacy.featureFlags || {},
      }) };
    }
  }
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const plans = {
    base: {
      ...DEFAULT_PLANS.base,
      price: Number(settings.precios?.base ?? DEFAULT_PLANS.base.price),
      currency: settings.precios?.currency || DEFAULT_PLANS.base.currency,
      features: { ...DEFAULT_PLANS.base.features, ...(settings.features || {}) },
    },
    pro: {
      ...DEFAULT_PLANS.pro,
      price: Number(settings.precios?.pro ?? DEFAULT_PLANS.pro.price),
      currency: settings.precios?.currency || DEFAULT_PLANS.pro.currency,
      features: { ...DEFAULT_PLANS.pro.features, ...(settings.features || {}), multiusuario: true },
    },
  };

  const invoiceRef = invoiceId ? db.collection("billingInvoices").doc(invoiceId) : null;
  const invoiceSnap = invoiceRef ? await invoiceRef.get() : null;
  const invoice = invoiceSnap?.exists ? invoiceSnap.data() : null;
  const planKey = invoice?.planKey && plans[invoice.planKey] ? invoice.planKey : "base";
  const plan = plans[planKey] || DEFAULT_PLANS.base;
  const billingDays = Number(invoice?.billingDays || plan.billingDays || 30);
  const now = Date.now();
  const graceDays = Number(settings.graceDaysDefault || 3);

  if (pago.status !== "approved") {
    if (invoiceRef) {
      await invoiceRef.set({
        status: pago.status || "pending",
        externalPaymentId: String(paymentId),
        paymentStatus: pago.status || "pending",
        updatedAt: now,
      }, { merge: true });
    }
    await db.collection("billingEvents").add({
      type: "payment_status",
      uid,
      invoiceId: invoiceId || null,
      externalPaymentId: String(paymentId),
      status: pago.status || "pending",
      createdAt: now,
    });
    return res.status(200).json({ ok: true, ignored: true, status: pago.status });
  }

  const nextBillingAt = now + billingDays * 24 * 60 * 60 * 1000;
  const graceEndsAt = nextBillingAt + graceDays * 24 * 60 * 60 * 1000;

  await accountRef.set({
    estado: "activo",
    rol: "user",
    plan: planKey,
    pagoEstado: "pagado",
    activoHasta: nextBillingAt,
    currentPlanKey: planKey,
    features: plan.features || {},
    featureFlags: settings.features || {},
    nextBillingAt,
    graceEndsAt,
    billingCadenceDays: billingDays,
    ultimoPago: {
      paymentId: String(paymentId),
      monto: Number(pago.transaction_amount || 0),
      fecha: now,
      dias: billingDays,
      planKey,
      invoiceId: invoiceId || null,
    },
    updatedAt: now,
  }, { merge: true });

  if (invoiceRef) {
    await invoiceRef.set({
      status: "approved",
      paymentStatus: "approved",
      externalPaymentId: String(paymentId),
      paidAt: now,
      updatedAt: now,
      amountPaid: Number(pago.transaction_amount || 0),
    }, { merge: true });
  }

  await db.collection("billingEvents").add({
    type: "payment_approved",
    uid,
    invoiceId: invoiceId || null,
    externalPaymentId: String(paymentId),
    amount: Number(pago.transaction_amount || 0),
    planKey,
    createdAt: now,
  });

  return res.status(200).json({ ok: true });
};
