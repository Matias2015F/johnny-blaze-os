const { db } = require("./_firebase-admin.js");
const { FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");
const {
  sendEmail,
  templatePagoAprobado,
  templatePagoFallido,
  templateCambioPlan,
  templateReactivado,
} = require("./_email.js");
const { applyRateLimit } = require("./_ratelimit.js");

const PLAN_BILLING_DAYS = { base: 30, pro: 90, full: 365 };
const getBillingDays = (plan) => PLAN_BILLING_DAYS[plan] || 30;
const ESTADOS_BLOQUEADOS = ["suspendido", "vencido", "trial_vencido"];

// ── HMAC failure tracker ─────────────────────────────────────────────────────
// Tracks per-IP HMAC failures. After HMAC_FAILURE_MAX failures in the window,
// the IP is temporarily blocked to prevent probing/brute-force.
const HMAC_FAILURES = new Map();
const HMAC_FAILURE_MAX = 5;
const HMAC_FAILURE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isHmacBlocked(ip) {
  const entry = HMAC_FAILURES.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.windowStart >= HMAC_FAILURE_WINDOW_MS) {
    HMAC_FAILURES.delete(ip);
    return false;
  }
  return entry.count >= HMAC_FAILURE_MAX;
}

function recordHmacFailure(ip) {
  const now = Date.now();
  let entry = HMAC_FAILURES.get(ip);
  if (!entry || now - entry.windowStart >= HMAC_FAILURE_WINDOW_MS) {
    HMAC_FAILURES.set(ip, { count: 1, windowStart: now });
  } else {
    entry.count += 1;
  }
}

// ── Timestamp freshness (anti-replay) ────────────────────────────────────────
// MP includes ts=<unix_seconds> in x-signature. Requests older than 5 minutes
// or more than 60s in the future are rejected as likely replays.
const MAX_TS_AGE_MS = 5 * 60 * 1000;
const MAX_TS_FUTURE_MS = 60 * 1000;

function checkTimestampFreshness(ts) {
  const tsSec = parseInt(ts, 10);
  if (isNaN(tsSec)) return false;
  const ageMs = Date.now() - tsSec * 1000;
  return ageMs <= MAX_TS_AGE_MS && ageMs >= -MAX_TS_FUTURE_MS;
}

// ── HMAC-SHA256 signature verification ───────────────────────────────────────
// Returns { valid: boolean, ts: string|null }
// Throws if MP_WEBHOOK_SECRET is not configured.
function verifyMpSignature(req) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) throw new Error("MP_WEBHOOK_SECRET no configurado");

  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];
  const dataId = req.query["data.id"];

  if (!xSignature || !xRequestId || !dataId) return { valid: false, ts: null };

  const parts = {};
  for (const part of xSignature.split(",")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx !== -1) parts[part.slice(0, eqIdx).trim()] = part.slice(eqIdx + 1).trim();
  }
  const { ts, v1 } = parts;
  if (!ts || !v1) return { valid: false, ts: null };

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmacBuf = crypto.createHmac("sha256", secret).update(manifest).digest();
  const v1Buf = Buffer.from(v1, "hex");

  if (hmacBuf.length !== v1Buf.length) return { valid: false, ts };
  return { valid: crypto.timingSafeEqual(hmacBuf, v1Buf), ts };
}

function getIp(req) {
  return (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip = getIp(req);

  // Rate limit: 200 req/min per IP
  if (applyRateLimit(req, res, "mp-webhook")) return;

  // Block IPs that have accumulated too many HMAC failures
  if (isHmacBlocked(ip)) {
    console.warn(`[mp-webhook] IP bloqueada por fallos HMAC repetidos: ${ip}`);
    return res.status(403).end();
  }

  try {
    // Verify signature + extract timestamp
    let sigResult;
    try {
      sigResult = verifyMpSignature(req);
    } catch (err) {
      console.error("[mp-webhook] Error en verificacion de firma:", err.message);
      return res.status(500).end();
    }

    if (!sigResult.valid) {
      recordHmacFailure(ip);
      console.warn(`[mp-webhook] Firma invalida — ip:${ip} ua:${req.headers["user-agent"] || "-"}`);
      return res.status(401).end();
    }

    // Reject replayed or future-dated requests
    if (!checkTimestampFreshness(sigResult.ts)) {
      console.warn(`[mp-webhook] Timestamp fuera de rango (posible replay) — ts:${sigResult.ts} ip:${ip}`);
      return res.status(401).end();
    }

    console.log(`[mp-webhook] OK — ip:${ip} ts:${sigResult.ts}`);

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

    // Dedup robusto: consultar historial completo de facturas, no solo ultimoPago
    const dupSnap = await userRef
      .collection("billingInvoices")
      .where("paymentId", "==", String(paymentId))
      .limit(1)
      .get();
    if (!dupSnap.empty) {
      console.log("Pago ya procesado en billingInvoices, ignorando:", paymentId);
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
