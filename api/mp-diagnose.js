let db, verifyIdToken;
try {
  ({ db, verifyIdToken } = require("./_firebase-admin.js"));
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!db) return res.status(500).json({ error: "Servidor sin base de datos" });

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

  // uid ya no se acepta del body — viene del token verificado
  const { preferenceId, invoiceId } = req.body || {};
  const userRef = db.collection("usuarios").doc(uid);

  // Si no hay ids, buscar el ultimo invoice en la subcolecci on correcta
  let resolvedInvoiceId = invoiceId || null;
  if (!preferenceId && !resolvedInvoiceId) {
    try {
      const snap = await userRef.collection("billingInvoices")
        .orderBy("fecha", "desc")
        .limit(1)
        .get();
      if (!snap.empty) resolvedInvoiceId = snap.docs[0].id;
    } catch (e) { console.error("No se pudo buscar invoice:", e); }
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
    invoice?.externalReference
    || (invoice?.uid && invoice?.invoiceId ? `${invoice.uid}:${invoice.invoiceId}` : null);
  const targetPreferenceId = String(preferenceId || invoice?.preferenceId || "").trim();

  let preference = null;
  let preferenceError = null;
  if (targetPreferenceId) {
    try {
      const prefRes = await fetch(`https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(targetPreferenceId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!prefRes.ok) {
        preferenceError = await prefRes.text();
      } else {
        preference = await prefRes.json();
      }
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

      const payRes = await fetch(searchUrl.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!payRes.ok) {
        paymentsError = await payRes.text();
      } else {
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
};
