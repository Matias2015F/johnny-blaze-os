const { db } = require("./_firebase-admin.js");
const { FieldValue } = require("firebase-admin/firestore");
const {
  sendEmail,
  templatePagoAprobado,
  templatePagoFallido,
  templateCambioPlan,
  templateReactivado,
} = require("./_email.js");

const PLAN_BILLING_DAYS = { base: 30, pro: 90, full: 365 };
const getBillingDays = (plan) => PLAN_BILLING_DAYS[plan] || 30;
const ESTADOS_BLOQUEADOS = ["suspendido", "vencido", "trial_vencido"];

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

    const uid = payment.metadata?.uid || payment.external_reference;
    const planPagado = payment.metadata?.plan || null;

    if (!uid) {
      console.error("UID faltante en pago:", paymentId);
      return res.status(200).end();
    }

    const userRef = db.collection("usuarios").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const emailDestino = userData.emailNotificacion || userData.email;

    // ── Pago rechazado / cancelado ────────────────────────────────────────────
    if (payment.status === "rejected" || payment.status === "cancelled") {
      console.log(`Pago ${payment.status} → uid:${uid} plan:${planPagado}`);

      if (emailDestino) {
        const tpl = templatePagoFallido({
          plan: planPagado || userData.plan || "base",
          monto: Number(payment.transaction_amount || 0),
          motivo: payment.status_detail || "",
        });
        await sendEmail({ to: emailDestino, ...tpl });
      }

      return res.status(200).end();
    }

    // ── Pago pendiente — sin acción por ahora ────────────────────────────────
    if (payment.status !== "approved") return res.status(200).end();

    // ── Pago aprobado ─────────────────────────────────────────────────────────

    // Deduplicar por paymentId
    if (userData?.ultimoPago?.paymentId === String(paymentId)) {
      console.log("Pago duplicado (mismo paymentId), ignorando:", paymentId);
      return res.status(200).end();
    }

    const estabaBloquado = ESTADOS_BLOQUEADOS.includes(userData.estado);
    const planAnterior = userData.plan || null;
    const nuevoPlan = planPagado || planAnterior || "base";

    // Extender desde activoHasta si ya tiene período activo (renovación anticipada)
    const baseTime =
      userData?.activoHasta && userData.activoHasta > Date.now()
        ? userData.activoHasta
        : Date.now();
    const nuevoActivoHasta = baseTime + getBillingDays(nuevoPlan) * 24 * 60 * 60 * 1000;

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

    if (userData.requestedAction) {
      updateData.requestedAction = FieldValue.delete();
      updateData.requestedPlan = FieldValue.delete();
    }

    await userRef.set(updateData, { merge: true });

    // Registrar en historial de facturas
    await userRef.collection("billingInvoices").add({
      uid,
      paymentId: String(paymentId),
      plan: nuevoPlan,
      monto: Number(payment.transaction_amount || 0),
      metodoPago: payment.payment_type_id || null,
      fecha: Date.now(),
      activoHasta: nuevoActivoHasta,
    });

    // Emails
    if (emailDestino) {
      const huboCarbioPlan = planAnterior && planPagado && planAnterior !== planPagado;

      if (estabaBloquado) {
        // Reactivación desde suspendido
        const tpl = templateReactivado({ plan: nuevoPlan, activoHasta: nuevoActivoHasta });
        await sendEmail({ to: emailDestino, ...tpl });
      } else if (huboCarbioPlan) {
        // Cambio de plan
        const tpl = templateCambioPlan({ planAnterior, planNuevo: nuevoPlan, activoHasta: nuevoActivoHasta });
        await sendEmail({ to: emailDestino, ...tpl });
      }

      // Siempre enviar recibo
      const tpl = templatePagoAprobado({
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
