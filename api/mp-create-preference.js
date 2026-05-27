let db, verifyIdToken;
try {
  ({ db, verifyIdToken } = require("./_firebase-admin.js"));
} catch (e) {
  console.error("Firebase Admin error:", e.message);
}
const { applyRateLimit } = require("./_ratelimit.js");

const PLANES_FALLBACK = {
  base: { label: "Mensual",    monto: 125000 },
  pro:  { label: "Trimestral", monto: 300000 },
  full: { label: "Anual",      monto: 900000 },
};

const BASE_URL = (process.env.PUBLIC_APP_URL || "https://app.motogestion.ar").replace(/\/+$/, "");

function normalizeCurrency(value) {
  const currency = String(value || "ARS").trim().toUpperCase();
  return currency || "ARS";
}

function buildPlanesConfig(adminData = {}) {
  const precios = adminData.precios || {};
  const currency = normalizeCurrency(adminData.subscriptionCurrency || precios.currency || "ARS");

  return {
    base: {
      label: adminData?.plans?.base?.label || PLANES_FALLBACK.base.label,
      monto: Number(precios.base ?? adminData?.plans?.base?.price ?? PLANES_FALLBACK.base.monto),
      currency,
    },
    pro: {
      label: adminData?.plans?.pro?.label || PLANES_FALLBACK.pro.label,
      monto: Number(precios.pro ?? adminData?.plans?.pro?.price ?? PLANES_FALLBACK.pro.monto),
      currency,
    },
    full: {
      label: adminData?.plans?.full?.label || PLANES_FALLBACK.full.label,
      monto: Number(precios.full ?? adminData?.plans?.full?.price ?? PLANES_FALLBACK.full.monto),
      currency,
    },
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!db) return res.status(500).json({ error: "Firebase no inicializado" });
  const mode = String(req.query?.mode || "").toLowerCase();

  // Consolidation: /api/mp-diagnose is rewritten here with ?mode=diagnose
  if (mode === "diagnose") {
    if (applyRateLimit(req, res, "mp-diagnose")) return;

    let decoded;
    try {
      decoded = await verifyIdToken(req);
    } catch (err) {
      return res.status(err.status || 401).json({ error: "No autorizado" });
    }
    const uid = decoded.uid;

    const accessToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
    if (!accessToken) {
      return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN en el servidor" });
    }

    const { preferenceId, invoiceId } = req.body || {};
    const userRef = db.collection("usuarios").doc(uid);

    let resolvedInvoiceId = invoiceId || null;
    if (!preferenceId && !resolvedInvoiceId) {
      try {
        const snap = await userRef.collection("billingInvoices").orderBy("fecha", "desc").limit(1).get();
        if (!snap.empty) resolvedInvoiceId = snap.docs[0].id;
      } catch (e) {
        console.error("No se pudo buscar invoice:", e);
      }
    }
    if (!preferenceId && !resolvedInvoiceId) {
      return res.status(400).json({ error: "Falta preferenceId o invoiceId" });
    }

    let invoice = null;
    try {
      if (resolvedInvoiceId) {
        const snap = await userRef.collection("billingInvoices").doc(String(resolvedInvoiceId)).get();
        if (snap.exists) invoice = { id: snap.id, ...snap.data() };
      }
    } catch (e) {
      console.error("No se pudo leer billingInvoices:", e);
    }

    const externalReference =
      invoice?.externalReference || (invoice?.uid && invoice?.invoiceId ? `${invoice.uid}:${invoice.invoiceId}` : null);
    const targetPreferenceId = String(preferenceId || invoice?.preferenceId || "").trim();

    let preference = null;
    let preferenceError = null;
    if (targetPreferenceId) {
      try {
        const prefRes = await fetch(
          `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(targetPreferenceId)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!prefRes.ok) preferenceError = await prefRes.text();
        else preference = await prefRes.json();
      } catch (e) {
        preferenceError = e?.message || String(e);
      }
    }

    let payments = [];
    let paymentsError = null;
    if (externalReference) {
      try {
        const searchUrl = new URL("https://api.mercadopago.com/v1/payments/search");
        searchUrl.searchParams.set("external_reference", externalReference);
        searchUrl.searchParams.set("sort", "date_created");
        searchUrl.searchParams.set("criteria", "desc");
        searchUrl.searchParams.set("limit", "5");
        const payRes = await fetch(searchUrl.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!payRes.ok) paymentsError = await payRes.text();
        else {
          const body = await payRes.json();
          payments = Array.isArray(body?.results) ? body.results : [];
        }
      } catch (e) {
        paymentsError = e?.message || String(e);
      }
    }

    return res.status(200).json({
      ok: true,
      invoice: invoice || null,
      preferenceId: targetPreferenceId || null,
      preference: preference || null,
      preferenceError,
      externalReference: externalReference || null,
      payments,
      paymentsError,
    });
  }

  if (applyRateLimit(req, res, "mp-create-preference")) return;

  let decoded;
  try {
    decoded = await verifyIdToken(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: "No autorizado" });
  }
  const uid = decoded.uid;

  const { plan } = req.body || {};
  if (!plan || !PLANES_FALLBACK[plan]) return res.status(400).json({ error: "plan requerido" });

  const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
  if (!token) return res.status(500).json({ error: "MP_ACCESS_TOKEN no configurado" });

  let planesConfig = { ...PLANES_FALLBACK };
  try {
    const adminSnap = await db.collection("admin_settings").doc("global").get();
    if (adminSnap.exists) {
      planesConfig = { ...planesConfig, ...buildPlanesConfig(adminSnap.data() || {}) };
    }
  } catch (e) {
    console.warn("No se pudo leer precios de Firestore, usando fallback:", e.message);
  }

  const p = planesConfig[plan] || PLANES_FALLBACK[plan];
  const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: [{ title: `MotoGestión - ${p.label}`, quantity: 1, unit_price: p.monto, currency_id: p.currency || "ARS" }],
      external_reference: uid,
      metadata: { uid, plan },
      back_urls: {
        success: `${BASE_URL}/`,
        failure: `${BASE_URL}/`,
        pending: `${BASE_URL}/`,
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

  return res.status(200).json({
    preferenceId: body.id,
    url: body.init_point,
  });
};
