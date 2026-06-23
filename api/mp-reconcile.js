let db, verifyIdToken, assertAdmin;
try {
  ({ db, verifyIdToken, assertAdmin } = require("./_firebase-admin.js"));
} catch (initError) {
  console.error("ERROR al inicializar Firebase Admin:", initError.message);
}

// Repara casos en los que el webhook registró billingEvents pero no dejó billingInvoices,
// lo que hace que el panel Admin "no vea" pagos reales.
module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });
  if (!db) return res.status(500).json({ error: "Servidor sin base de datos" });

  let decoded;
  try {
    decoded = await verifyIdToken(req);
    assertAdmin(decoded);
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

    if (source === "payment_id") {
      const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
      if (!token) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN en el servidor" });

      const rawIds = Array.isArray(req.body?.paymentIds) ? req.body.paymentIds : [req.body?.paymentId];
      const paymentIds = [];
      const seenIds = new Set();
      for (const v of rawIds) {
        const s = String(v || "").trim();
        if (!s || seenIds.has(s)) continue;
        seenIds.add(s);
        paymentIds.push(s);
        if (paymentIds.length >= 20) break;
      }
      if (!paymentIds.length) return res.status(400).json({ error: "Falta paymentId/paymentIds" });

      let created = 0;
      let skipped = 0;
      let errors = 0;
      const imported = [];
      const dryRun = req.body?.dryRun === true || String(req.query?.dryRun || "").toLowerCase() === "true";

      for (const pid of paymentIds) {
        try {
          const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(pid)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!mpRes.ok) {
            errors += 1;
            continue;
          }
          const p = await mpRes.json().catch(() => ({}));
          const status = String(p?.status || "").toLowerCase();
          const mpUid = String(p?.metadata?.uid || "").trim();
          const mpExt = String(p?.external_reference || "").trim();
          if (status !== "approved") {
            skipped += 1;
            imported.push({ paymentId: pid, status: p?.status || null, mpUid, mpExt, imported: false, reason: "not_approved" });
            continue;
          }

          const uidOverride = String(req.body?.uidOverride || "").trim();
          const uid = String(p?.metadata?.uid || p?.external_reference || uidOverride || "").trim();
          if (!uid) {
            skipped += 1;
            imported.push({ paymentId: pid, status: p?.status || null, mpUid, mpExt, imported: false, reason: "missing_uid" });
            continue;
          }

          const userRef = db.collection("usuarios").doc(uid);
          const dupSnap = await userRef.collection("billingInvoices").where("paymentId", "==", String(p?.id || pid)).limit(1).get();
          if (!dupSnap.empty) {
            skipped += 1;
            imported.push({ paymentId: pid, uid, status: p?.status || null, mpUid, mpExt, imported: false, reason: "duplicate" });
            continue;
          }

          const plan = String(p?.metadata?.plan || "base").toLowerCase();
          const monto = Number(p?.transaction_amount || 0);
          const paidAt = p?.date_approved ? new Date(p.date_approved).getTime() : Date.now();

          if (dryRun) {
            imported.push({ paymentId: pid, uid, monto, status: p?.status || null, mpUid, mpExt, imported: false, reason: "dry_run" });
            continue;
          }

          await userRef.collection("billingInvoices").add({
            uid,
            paymentId: String(p?.id || pid),
            provider: "mercadopago",
            source: "mp_payment_import",
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
          imported.push({ paymentId: pid, uid, monto, mpUid, mpExt, imported: true });
        } catch (e) {
          errors += 1;
        }
      }

      return res.status(200).json({ ok: true, source: "payment_id", dryRun, paymentIds, created, skipped, errors, imported });
    }

    if (source === "payment_id_diagnose") {
      const token = String(process.env.MP_ACCESS_TOKEN || "").trim();
      if (!token) return res.status(500).json({ error: "Falta MP_ACCESS_TOKEN en el servidor" });

      const pid = String(req.body?.paymentId || "").trim();
      if (!pid) return res.status(400).json({ error: "Falta paymentId" });

      const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(pid)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!mpRes.ok) {
        return res.status(502).json({ error: `Mercado Pago respondió ${mpRes.status}` });
      }
      const p = await mpRes.json().catch(() => ({}));
      const status = String(p?.status || "").toLowerCase();
      const mpUid = String(p?.metadata?.uid || "").trim();
      const mpExt = String(p?.external_reference || "").trim();
      const uidOverride = String(req.body?.uidOverride || "").trim();
      const candidateUid = String(mpUid || mpExt || uidOverride || "").trim();

      // Detectar si ya existe un billingInvoice con este paymentId en cualquier usuario.
      // Esto diferencia "no importó porque ya está" vs "no está asociado a nadie".
      let existingInvoices = [];
      try {
        const cg = await db
          .collectionGroup("billingInvoices")
          .where("paymentId", "==", String(p?.id || pid))
          .limit(5)
          .get();
        existingInvoices = cg.docs.map((d) => ({ id: d.id, ...((d.data && d.data()) || {}) }));
      } catch (e) {
        existingInvoices = [];
      }

      // Si tenemos UID candidato, chequeamos duplicado dentro de ese usuario.
      let existsInCandidateUser = false;
      try {
        if (candidateUid) {
          const userRef = db.collection("usuarios").doc(candidateUid);
          const dupSnap = await userRef
            .collection("billingInvoices")
            .where("paymentId", "==", String(p?.id || pid))
            .limit(1)
            .get();
          existsInCandidateUser = !dupSnap.empty;
        }
      } catch (e) {
        existsInCandidateUser = false;
      }

      return res.status(200).json({
        ok: true,
        source: "payment_id_diagnose",
        paymentId: String(p?.id || pid),
        status: p?.status || null,
        statusDetail: p?.status_detail || null,
        isApproved: status === "approved",
        mpUid,
        mpExternalReference: mpExt,
        hasUidInMP: !!(mpUid || mpExt),
        uidOverride: uidOverride || "",
        candidateUid: candidateUid || "",
        existsInCandidateUser,
        existingInvoicesCount: existingInvoices.length,
        existingInvoices: existingInvoices.slice(0, 5).map((inv) => ({
          uid: inv.uid || "",
          plan: inv.plan || "",
          monto: inv.monto || 0,
          status: inv.status || inv.mpStatus || "",
          fecha: inv.fecha || inv.paidAt || null,
          source: inv.source || "",
          paymentId: inv.paymentId || "",
        })),
        mp: {
          preferenceId: p?.preference_id || null,
          dateApproved: p?.date_approved || null,
          dateCreated: p?.date_created || null,
          transactionAmount: p?.transaction_amount || 0,
          currencyId: p?.currency_id || null,
          paymentTypeId: p?.payment_type_id || null,
          payerEmail: p?.payer?.email || null,
          metadata: p?.metadata || {},
        },
      });
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
