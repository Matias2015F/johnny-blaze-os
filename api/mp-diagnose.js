let db;
try {
  db = require("./_firebase-admin.js").db;
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

function isProbablySandboxToken() {
  const token = String(process.env.MP_ACCESS_TOKEN || "");
  // Heurística: no hay un prefijo público estable; lo dejamos como "unknown" si no se puede.
  if (!token) return { ok: false, mode: "unknown" };
  return { ok: true, mode: "unknown" };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!db) return res.status(500).json({ error: "Servidor sin base de datos" });
  if (!process.env.MP_ACCESS_TOKEN) {
    return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN en el servidor" });
  }

  const { preferenceId, invoiceId } = req.body || {};
  if (!preferenceId && !invoiceId) {
    return res.status(400).json({ error: "Falta preferenceId o invoiceId" });
  }

  let invoice = null;
  try {
    if (invoiceId) {
      const snap = await db.collection("billingInvoices").doc(String(invoiceId)).get();
      if (snap.exists) invoice = { id: snap.id, ...snap.data() };
    }
  } catch (e) {
    console.error("No se pudo leer billingInvoices:", e);
  }

  const targetPreferenceId = String(preferenceId || invoice?.preferenceId || "").trim();
  if (!targetPreferenceId) {
    return res.status(404).json({ error: "No se encontró preferenceId" });
  }

  const tokenInfo = isProbablySandboxToken();

  // 1) Consultar preferencia (nos da info básica y payer si está)
  let preference = null;
  let preferenceError = null;
  try {
    const prefRes = await fetch(`https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(targetPreferenceId)}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });
    if (!prefRes.ok) {
      preferenceError = await prefRes.text();
    } else {
      preference = await prefRes.json();
    }
  } catch (e) {
    preferenceError = e?.message || String(e);
  }

  // 2) Buscar pagos asociados por external_reference (uid:invoiceId)
  const externalReference = invoice?.uid && invoice?.invoiceId ? `${invoice.uid}:${invoice.invoiceId}` : (invoice?.external_reference || null);
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
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
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
    tokenMode: tokenInfo.mode,
    invoice: invoice || null,
    preferenceId: targetPreferenceId,
    preference: preference || null,
    preferenceError,
    externalReference: externalReference || null,
    payments,
    paymentsError,
  });
};

