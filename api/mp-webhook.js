const { db } = require("./_firebase-admin.js");
const { FieldValue } = require("firebase-admin/firestore");
const { sendEmail, templateReciboPago, templateCambioPlan } = require("./_email.js");

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
    const planPagado = payment.metadata?.plan || null;

    if (!uid) {
      console.error("UID faltante en pago:", paymentId);
      return res.status(200).end();
    }

    const userRef = db.collection("usuarios").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};

    // Deduplicar por paymentId (no por activoHasta, para que las renovaciones funcionen)
    if (userData?.ultimoPago?.paymentId === String(paymentId)) {
      console.log("Pago duplicado (mismo paymentId), ignorando:", paymentId);
      return res.status(200).end();
    }

    // Si el usuario ya tiene período activo, extender desde activoHasta (renovación)
    const baseTime =
      userData?.activoHasta && userData.activoHasta > Date.now()
        ? userData.activoHasta
        : Date.now();
    const nuevoActivoHasta = baseTime + BILLING_DAYS * 24 * 60 * 60 * 1000;

    const planAnterior = userData.plan || null;
    const nuevoPlan = planPagado || planAnterior || "base";

    const updateData = {
      estado: "activo",
      plan: nuevoPlan,
      pagoEstado: "pagado",
      activoHasta: nuevoActivoHasta,
      ultimoPago: {
        paymentId: String(paymentId),
        monto: Number(payment.transaction_amount || 0),
        fecha: Date.now(),
      },
      updatedAt: Date.now(),
    };

    // Limpiar solicitud de cambio de plan si estaba pendiente
    if (userData.requestedAction) {
      updateData.requestedAction = FieldValue.delete();
      updateData.requestedPlan = FieldValue.delete();
    }

    await userRef.set(updateData, { merge: true });

    // Registrar factura en subcolección
    await userRef.collection("billingInvoices").add({
      paymentId: String(paymentId),
      plan: nuevoPlan,
      monto: Number(payment.transaction_amount || 0),
      metodoPago: payment.payment_type_id || null,
      fecha: Date.now(),
      activoHasta: nuevoActivoHasta,
    });

    // Enviar email (usa emailNotificacion del usuario si está configurado, sino email de login)
    const emailDestino = userData.emailNotificacion || userData.email;
    if (emailDestino) {
      const huboCarbioPlan = planAnterior && planPagado && planAnterior !== planPagado;

      if (huboCarbioPlan) {
        // Email de cambio de plan + recibo
        const tpl = templateCambioPlan({ planAnterior, planNuevo: nuevoPlan, activoHasta: nuevoActivoHasta });
        await sendEmail({ to: emailDestino, ...tpl });
      }

      // Siempre enviar recibo
      const tpl = templateReciboPago({
        plan: nuevoPlan,
        monto: Number(payment.transaction_amount || 0),
        activoHasta: nuevoActivoHasta,
        paymentId: String(paymentId),
      });
      await sendEmail({ to: emailDestino, ...tpl });
    }

    console.log("Pago aprobado → usuario activado:", uid, "plan:", nuevoPlan, "hasta:", new Date(nuevoActivoHasta).toISOString());
    return res.status(200).end();

  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).end();
  }
};
