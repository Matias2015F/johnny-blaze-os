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

  const days = Math.max(1, Math.min(180, Number(req.body?.days || 60)));
  const limit = Math.max(10, Math.min(500, Number(req.body?.limit || 200)));
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  try {
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

    return res.status(200).json({ ok: true, created, skipped, errors, scanned: eventsSnap.size });
  } catch (err) {
    console.error("mp-reconcile error:", err);
    return res.status(500).json({ error: err.message || "No se pudo reconciliar" });
  }
};

