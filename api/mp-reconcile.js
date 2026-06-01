let db, verifyIdToken;
try {
  ({ db, verifyIdToken } = require("./_firebase-admin.js"));
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

const ADMIN_EMAILS = String(process.env.PLATFORM_ADMIN_EMAILS || "matias4604@gmail.com")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_UIDS = String(process.env.PLATFORM_ADMIN_UIDS || "")
  .split(",")
  .map((uid) => uid.trim())
  .filter(Boolean);

async function assertAdmin(decoded) {
  const uid = decoded?.uid || "";
  const email = String(decoded?.email || "").toLowerCase();
  if (ADMIN_UIDS.includes(uid) || ADMIN_EMAILS.includes(email)) return true;

  const snap = await db.collection("usuarios").doc(uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  if (data.rol === "admin" || data.isPlatformAdmin === true) return true;

  const err = new Error("No autorizado como administrador");
  err.status = 403;
  throw err;
}

// Repara casos en los que el webhook registró billingEvents pero no dejó billingInvoices,
// lo que hace que el panel Admin "no vea" pagos reales.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!db) return res.status(500).json({ error: "Servidor sin base de datos" });

  let decoded;
  try {
    decoded = await verifyIdToken(req);
    await assertAdmin(decoded);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message || "No autorizado" });
  }

  const source = String(req.body?.source || req.query?.source || "events").toLowerCase();
  const days = Math.max(1, Math.min(365, Number(req.body?.days || 60)));
  const limit = Math.max(10, Math.min(500, Number(req.body?.limit || 200)));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
    if (source === "mp") {
      const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
      if (!token) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN en el servidor" });

      const uidsRaw = Array.isArray(req.body?.uids) ? req.body.uids : [req.body?.uid];
      const uids = [];
      const seen = new Set();
      for (const v of uidsRaw) {
        const s = String(v || "").trim();
        if (!s || seen.has(s)) continue;
        seen.add(s);
        uids.push(s);
        if (uids.length >= 50) break;
      }
      if (!uids.length) return res.status(400).json({ error: "Falta uid/uids" });

      let created = 0;
      let skipped = 0;
      let errors = 0;
      let scanned = 0;

      for (const uid of uids) {
        try {
          const searchUrl = new URL("https://api.mercadopago.com/v1/payments/search");
          searchUrl.searchParams.set("external_reference", uid);
          searchUrl.searchParams.set("sort", "date_created");
          searchUrl.searchParams.set("criteria", "desc");
          searchUrl.searchParams.set("limit", "50");
          const end = new Date();
          const begin = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
          searchUrl.searchParams.set("begin_date", begin.toISOString());
          searchUrl.searchParams.set("end_date", end.toISOString());

          const mpRes = await fetch(searchUrl.toString(), { headers: { Authorization: `Bearer ${token}` } });
          if (!mpRes.ok) throw new Error(`MP ${mpRes.status}`);
          const body = await mpRes.json().catch(() => ({}));
          const payments = Array.isArray(body?.results) ? body.results : [];
          scanned += payments.length;

          const approved = payments.filter((p) => String(p?.status || "").toLowerCase() === "approved");
          for (const p of approved) {
            const paymentId = String(p?.id || "").trim();
            if (!paymentId) {
              skipped += 1;
              continue;
            }
            try {
              const userRef = db.collection("usuarios").doc(uid);
              const dupSnap = await userRef.collection("billingInvoices").where("paymentId", "==", paymentId).limit(1).get();
              if (!dupSnap.empty) {
                skipped += 1;
                continue;
              }

              const plan = String(p?.metadata?.plan || "base").toLowerCase();
              const monto = Number(p?.transaction_amount || 0);
              const paidAt = p?.date_approved ? new Date(p.date_approved).getTime() : Date.now();

              await userRef.collection("billingInvoices").add({
                uid,
                paymentId,
                provider: "mercadopago",
                source: "mp_reconcile",
                status: "approved",
                mpStatus: "approved",
                mpStatusDetail: String(p?.status_detail || ""),
                preferenceId: p?.preference_id || null,
                externalReference: String(p?.external_reference || uid),
                payerEmail: p?.payer?.email || null,
                plan,
                monto,
                metodoPago: p?.payment_type_id || null,
                fecha: paidAt,
                paidAt,
                activoHasta: null,
                billingDays: null,
                reconciledAt: Date.now(),
              });
              created += 1;
            } catch (e) {
              errors += 1;
            }
          }
        } catch (e) {
          errors += 1;
        }
      }

      return res.status(200).json({ ok: true, source: "mp", uids, days, created, skipped, errors, scanned });
    }

    const eventsSnap = await db
      .collection("billingEvents")
      .where("type", "==", "payment_approved")
      .where("createdAt", ">=", new Date(since))
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const evDoc of eventsSnap.docs) {
      const ev = evDoc.data() || {};
      const uid = String(ev.uid || "").trim();
      const paymentId = String(ev.paymentId || "").trim();
      if (!uid || !paymentId) {
        skipped += 1;
        continue;
      }

      try {
        const userRef = db.collection("usuarios").doc(uid);
        const dupSnap = await userRef
          .collection("billingInvoices")
          .where("paymentId", "==", paymentId)
          .limit(1)
          .get();
        if (!dupSnap.empty) {
          skipped += 1;
          continue;
        }

        const monto = Number(ev.monto || 0);
        const plan = String(ev.plan || "base").toLowerCase();
        const activoHasta = Number(ev.activoHasta || 0) || null;

        await userRef.collection("billingInvoices").add({
          uid,
          paymentId,
          provider: "mercadopago",
          source: "billing_reconcile",
          status: "approved",
          mpStatus: "approved",
          mpStatusDetail: "",
          preferenceId: null,
          externalReference: uid,
          payerEmail: null,
          plan,
          monto,
          metodoPago: null,
          fecha: Date.now(),
          paidAt: Date.now(),
          activoHasta,
          billingDays: null,
          repairedFromEventId: evDoc.id,
        });

        created += 1;
      } catch (e) {
        errors += 1;
      }
    }

    return res.status(200).json({ ok: true, source: "events", created, skipped, errors, scanned: eventsSnap.size });
  } catch (err) {
    console.error("mp-reconcile error:", err);
    return res.status(500).json({ error: err.message || "No se pudo reconciliar" });
  }
};
