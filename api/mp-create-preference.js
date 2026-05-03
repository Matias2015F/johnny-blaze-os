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

function safeJsonParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, value: null };
  }
}

function _unusedGetBaseUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
  const host =
    String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim()
    || "";
  if (!host) return BASE_URL;
  return `${proto}://${host}`;
}

function errorResponse(res, status, payload) {
  return res.status(status).json(payload);
}

function getTokenMode(accessToken) {
  if (String(accessToken).startsWith("TEST-")) return "sandbox";
  if (String(accessToken).startsWith("APP_USR-")) return "production";
  return "unknown";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  if (!db) {
    return errorResponse(res, 500, { error: "Error de configuracion del servidor" });
  }

  const accessToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
  if (!accessToken) {
    return errorResponse(res, 500, { error: "Falta MP_ACCESS_TOKEN en el servidor" });
  }
  const tokenMode = getTokenMode(accessToken);

  const { uid, plan: requestedPlanKey } = req.body || {};
  if (!uid) return errorResponse(res, 400, { error: "uid es requerido" });

  const accountRef = db.collection("usuarios").doc(uid);
  const accountSnap = await accountRef.get();
  if (!accountSnap.exists) return errorResponse(res, 404, { error: "Cuenta no encontrada" });
  const account = accountSnap.data();

  const settingsSnap = await db.collection("admin_settings").doc("global").get();
  const settings = settingsSnap.exists ? settingsSnap.data() : {};
  const plans = {
    base: {
      ...DEFAULT_PLANS.base,
      price: Number(settings.precios?.base ?? DEFAULT_PLANS.base.price),
      currency: settings.precios?.currency || DEFAULT_PLANS.base.currency,
    },
    pro: {
      ...DEFAULT_PLANS.pro,
      price: Number(settings.precios?.pro ?? DEFAULT_PLANS.pro.price),
      currency: settings.precios?.currency || DEFAULT_PLANS.pro.currency,
    },
  };
  const planKey = plans[requestedPlanKey] ? requestedPlanKey : (account.currentPlanKey || "base");
  const plan = plans[planKey];

  if (!plan) return errorResponse(res, 400, { error: "Plan invalido" });

  const now = Date.now();
  const invoiceRef = db.collection("billingInvoices").doc();
  const externalReference = `${uid}:${invoiceRef.id}`;
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
    mercadoPagoTokenMode: tokenMode,
    externalReference,
    externalPaymentId: null,
    dueAt: now + 3 * 24 * 60 * 60 * 1000,
    createdAt: now,
    updatedAt: now,
  };

  await invoiceRef.set(invoiceData, { merge: true });

  const baseUrl = BASE_URL;
  const payerEmail = tokenMode === "sandbox"
    ? String(process.env.MP_TEST_PAYER_EMAIL || "").trim()
    : String(account.email || "").trim();
  const preference = {
    items: [{
      title: `Johnny Blaze OS - ${plan.label || planKey}`,
      quantity: 1,
      unit_price: Number(plan.price || 0),
      currency_id: plan.currency || "ARS",
    }],
    external_reference: externalReference,
    back_urls: {
      success: `${baseUrl}/?pago=ok`,
      failure: `${baseUrl}/?pago=error`,
      pending: `${baseUrl}/?pago=pendiente`,
    },
    auto_return: "approved",
    notification_url: `${baseUrl}/api/mp-webhook`,
  };
  if (payerEmail) {
    preference.payer = { email: payerEmail };
  }

  let mpRes;
  try {
    mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preference),
      signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
    });
  } catch (networkError) {
    const errorText = networkError?.message || String(networkError);
    console.error("Error de red al crear preferencia MP:", errorText);
    await invoiceRef.set({
      status: "error",
      errorText,
      errorCode: "network_error",
      updatedAt: Date.now(),
    }, { merge: true });
    return errorResponse(res, 502, {
      error: "No se pudo conectar con Mercado Pago (red)",
      invoiceId: invoiceRef.id,
      errorCode: "network_error",
      errorText,
    });
  }

  if (!mpRes.ok) {
    const errorText = await mpRes.text();
    const parsed = safeJsonParse(errorText);
    const mpError = parsed.ok ? parsed.value : null;
    const mpMessage =
      (mpError && (mpError.message || mpError.error)) ? String(mpError.message || mpError.error) : "";
    const short = mpMessage || errorText.slice(0, 200) || "Error desconocido";

    console.error("Error al crear preferencia MP:", mpRes.status, short);
    await invoiceRef.set({
      status: "error",
      errorText,
      errorHttpStatus: mpRes.status,
      errorMessage: mpMessage || null,
      payerEmailConfigured: Boolean(payerEmail),
      updatedAt: Date.now(),
    }, { merge: true });

    if (mpRes.status === 401) {
      return errorResponse(res, 502, {
        error: "Mercado Pago: token invalido (401). Revisa MP_ACCESS_TOKEN en Vercel.",
        invoiceId: invoiceRef.id,
        mpStatus: mpRes.status,
        mpMessage: short,
      });
    }
    if (mpRes.status === 403) {
      return errorResponse(res, 502, {
        error: "Mercado Pago: permisos insuficientes (403). Revisa credenciales/ambiente.",
        invoiceId: invoiceRef.id,
        mpStatus: mpRes.status,
        mpMessage: short,
      });
    }
    return errorResponse(res, 502, {
      error: `Mercado Pago (${mpRes.status}): ${short}`,
      invoiceId: invoiceRef.id,
      mpStatus: mpRes.status,
      mpMessage: short,
    });
  }

  const data = await mpRes.json();
  const checkoutUrl = tokenMode === "sandbox"
    ? (data.sandbox_init_point || data.init_point || null)
    : (data.init_point || data.sandbox_init_point || null);
  const mpMode = checkoutUrl && String(checkoutUrl).includes("sandbox.mercadopago.com.ar") ? "sandbox" : "production";

  await invoiceRef.set({
    preferenceId: data.id,
    checkoutUrl,
    initPoint: data.init_point || null,
    sandboxInitPoint: data.sandbox_init_point || null,
    mpMode,
    mercadoPagoTokenMode: tokenMode,
    payerEmailConfigured: Boolean(payerEmail),
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
    url: checkoutUrl,
    mode: mpMode,
    tokenMode,
  });
};
