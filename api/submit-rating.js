const { createHash } = require("crypto");
const { db } = require("./_firebase-admin.js");
const { applyRateLimit } = require("./_ratelimit.js");

function parseBody(req) {
  if (!req.body) return {};
  if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString("utf8").replace(/^\uFEFF/, "").trim());
  if (typeof req.body === "string") return JSON.parse(req.body.replace(/^\uFEFF/, "").trim());
  return req.body;
}

function hashPhoneLast4(last4, token) {
  return createHash("sha256").update(`${last4}:${token}`).digest("hex").slice(0, 32);
}

function cleanString(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function score(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

function clientIp(req) {
  return (
    (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function ipHash(req, token) {
  return createHash("sha256").update(`${clientIp(req)}:${token}`).digest("hex").slice(0, 24);
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Metodo no permitido." });
  }

  if (applyRateLimit(req, res, "submit-rating")) return;

  let body;
  try {
    body = parseBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: "Solicitud invalida." });
  }

  const token = cleanString(body.token, 80);
  if (!/^r[a-f0-9]{32}$/i.test(token)) {
    return res.status(400).json({ ok: false, error: "Comprobante invalido." });
  }

  const scores = {
    atencion: score(body.scoreAtencion),
    claridad: score(body.scoreClaridad),
    trabajo: score(body.scoreTrabajo),
    cumplimiento: score(body.scoreCumplimiento),
  };

  if (Object.values(scores).some((v) => v == null) || typeof body.recomienda !== "boolean") {
    return res.status(400).json({ ok: false, error: "Completá todas las calificaciones." });
  }

  const phoneLast4 = cleanString(body.phoneLast4, 4).replace(/\D/g, "");
  const comentario = cleanString(body.comentario, 500);
  const now = Date.now();

  try {
    const result = await db.runTransaction(async (tx) => {
      const receiptRef = db.collection("publicReceipts").doc(token);
      const secretRef = db.collection("publicReceiptSecrets").doc(token);
      const receiptSnap = await tx.get(receiptRef);

      if (!receiptSnap.exists) {
        const err = new Error("Comprobante no encontrado.");
        err.status = 404;
        throw err;
      }

      const receipt = receiptSnap.data();
      if (receipt.estado === "anulado") {
        const err = new Error("Comprobante anulado.");
        err.status = 409;
        throw err;
      }
      if (!receipt.ratingEnabled || receipt.ratingUsed) {
        const err = new Error("Este comprobante ya fue calificado.");
        err.status = 409;
        throw err;
      }
      if (Number(receipt.ratingExpiresAt || 0) < now) {
        const err = new Error("El periodo de calificacion vencio.");
        err.status = 410;
        throw err;
      }

      let phoneVerified = false;
      if (receipt.hasPhoneVerification) {
        if (phoneLast4.length !== 4) {
          const err = new Error("Ingresá los ultimos 4 digitos del celular.");
          err.status = 400;
          throw err;
        }
        const secretSnap = await tx.get(secretRef);
        const expected = secretSnap.exists ? secretSnap.data().phoneHash : receipt.phoneHash || "";
        if (!expected || hashPhoneLast4(phoneLast4, token) !== expected) {
          const err = new Error("Los digitos no coinciden con el celular registrado.");
          err.status = 403;
          throw err;
        }
        phoneVerified = true;
      }

      let fraudScore = 0;
      if (!phoneVerified) fraudScore += 15;
      if (scores.atencion === 5 && scores.claridad === 5 && scores.trabajo === 5 && scores.cumplimiento === 5) fraudScore += 5;
      if (now - Number(receipt.fechaEmision || now) < 60 * 1000) fraudScore += 5;

      const ratingRef = db.collection("ratings").doc();
      const rating = {
        token,
        uidTaller: receipt.uidTaller,
        orderId: receipt.orderId,
        numeroOrden: receipt.numeroOrden,
        numeroComprobante: receipt.numeroComprobante,
        scoreAtencion: scores.atencion,
        scoreClaridad: scores.claridad,
        scoreTrabajo: scores.trabajo,
        scoreCumplimiento: scores.cumplimiento,
        recomienda: body.recomienda,
        comentario,
        source: "verified_receipt",
        status: "pendiente_validacion",
        reputationWeight: 0,
        fraudScore,
        phoneVerified,
        ipHash: ipHash(req, token),
        createdAt: now,
      };

      tx.set(ratingRef, rating);
      tx.update(receiptRef, {
        ratingUsed: true,
        ratingSubmittedAt: now,
        ratingId: ratingRef.id,
      });

      return { ratingId: ratingRef.id };
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      ok: false,
      error: error.message || "No pudimos guardar la calificacion.",
    });
  }
};
