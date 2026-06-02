const { db } = require("./_firebase-admin.js");
const { applyRateLimit } = require("./_ratelimit.js");

function cleanString(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function normalizeDiscountPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(50, Math.round(n)));
}

function buildIncentive(discountPct) {
  if (discountPct <= 0) {
    return {
      enabled: false,
      type: "",
      discountPct: 0,
      title: "",
      description: "",
      automatic: false,
    };
  }

  return {
    enabled: true,
    type: "discount_pct_next_visit",
    discountPct,
    title: `${discountPct}% de descuento en tu proxima visita`,
    description: "El beneficio queda registrado automaticamente para esta moto si la calificacion queda validada.",
    automatic: true,
    appliesTo: "next_workshop_visit",
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=60");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Metodo no permitido." });
  }

  if (applyRateLimit(req, res, "receipt-incentive")) return;

  const token = cleanString(req.query?.token, 80);
  if (!/^r[a-f0-9]{32}$/i.test(token)) {
    return res.status(400).json({ ok: false, error: "Token invalido." });
  }

  try {
    const receiptSnap = await db.collection("publicReceipts").doc(token).get();
    if (!receiptSnap.exists) {
      return res.status(404).json({ ok: false, error: "Comprobante no encontrado." });
    }

    const receipt = receiptSnap.data() || {};
    const receiptPct = normalizeDiscountPct(receipt.incentive?.discountPct);
    if (receipt.incentive?.enabled && receiptPct > 0) {
      return res.status(200).json({ ok: true, incentive: buildIncentive(receiptPct) });
    }

    const uidTaller = cleanString(receipt.uidTaller, 160);
    if (!uidTaller) {
      return res.status(200).json({ ok: true, incentive: buildIncentive(0) });
    }

    const configSnap = await db.collection("users").doc(uidTaller).collection("config").doc("global").get();
    const config = configSnap.exists ? configSnap.data() : {};
    const configPct = normalizeDiscountPct(config.descuentoCalificacionPct ?? 15);

    return res.status(200).json({ ok: true, incentive: buildIncentive(configPct) });
  } catch (error) {
    console.error("[receipt-incentive]", error);
    return res.status(500).json({ ok: false, error: "No se pudo leer el beneficio." });
  }
};
