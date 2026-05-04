const { db } = require("./_firebase-admin.js");

const BILLING_DAYS = 30;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    const { type, data } = req.body || {};

    if (type !== "payment") return res.status(200).end();

    const paymentId = data?.id;
    if (!paymentId) return res.status(200).end();

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    });

    const payment = await mpRes.json();

    if (payment.status !== "approved") return res.status(200).end();

    const uid = payment.metadata?.uid || payment.external_reference;
    if (!uid) {
      console.error("UID faltante en pago:", paymentId);
      return res.status(200).end();
    }

    const userRef = db.collection("usuarios").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};

    if (userData?.activoHasta && userData.activoHasta > Date.now()) {
      console.log("Usuario ya activo, ignorando duplicado:", uid);
      return res.status(200).end();
    }

    await userRef.set({
      estado: "activo",
      plan: "activo",
      pagoEstado: "pagado",
      activoHasta: Date.now() + BILLING_DAYS * 24 * 60 * 60 * 1000,
      ultimoPago: {
        paymentId: String(paymentId),
        monto: Number(payment.transaction_amount || 0),
        fecha: Date.now(),
      },
      updatedAt: Date.now(),
    }, { merge: true });

    console.log("Pago aprobado → usuario activado:", uid);
    return res.status(200).end();

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).end();
  }
};
