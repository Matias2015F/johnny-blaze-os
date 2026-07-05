// Envía el email de bienvenida a un usuario recién registrado.
// Llamado desde el cliente (saasService.js) cuando se detecta cuenta nueva.
// Idempotente: si ya se envió (welcomeEmailSentAt existe) retorna 200 sin reenviar.

const { db, verifyIdToken } = require("./_firebase-admin.js");
const { sendEmail, templateBienvenida } = require("./_email.js");
const { applyRateLimit } = require("./_ratelimit.js");
const { getAuth } = require("firebase-admin/auth");

const MS_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_TRIAL_DAYS = 30;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const mode = String(req.query?.mode || "").toLowerCase();
  if (applyRateLimit(req, res, mode === "password-reset" ? "send-password-reset" : "send-welcome")) return;

  if (mode === "password-reset") {
    const { email } = req.body || {};
    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "Email inválido" });
    }
    try {
      const adminAuth = getAuth();
      const link = await adminAuth.generatePasswordResetLink(String(email).trim().toLowerCase(), {
        url: "https://app.motogestion.ar",
      });
      const html = require("./_email.js").buildResetEmail({ email, link });
      const ok = await sendEmail({
        to: String(email).trim().toLowerCase(),
        subject: "Restablecer contraseña",
        html,
      });
      if (!ok) return res.status(500).json({ error: "No se pudo enviar el correo" });
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("[send-password-reset] Error:", err.code, err.message);
      if (err.code === "auth/user-not-found" || err.code === "auth/email-not-found") {
        return res.status(200).json({ ok: true });
      }
      return res.status(500).json({ error: "Error al procesar la solicitud" });
    }
  }

  let decoded;
  try {
    decoded = await verifyIdToken(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: "No autorizado" });
  }
  const uid = decoded.uid;

  try {
    const userRef = db.collection("usuarios").doc(uid);
    const snap = await userRef.get();

    // Respuesta uniforme para no exponer si el uid existe o no
    if (!snap.exists) return res.status(200).json({ ok: true, skipped: true });

    const data = snap.data();

    // Idempotencia: no reenviar si ya se mandó
    if (data.welcomeEmailSentAt) {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const emailDestino = data.emailNotificacion || data.email;
    if (!emailDestino) {
      return res.status(200).json({ ok: true, skipped: true, reason: "sin email" });
    }

    const trialHasta = data.activoHasta || data.trialEndsAt || (Date.now() + DEFAULT_TRIAL_DAYS * MS_DAY);
    const diasTrial = Math.max(1, Math.ceil((trialHasta - Date.now()) / MS_DAY));

    const tpl = templateBienvenida({
      email: emailDestino,
      diasTrial,
      trialHasta,
    });

    const ok = await sendEmail({ to: emailDestino, ...tpl });

    if (ok) {
      await userRef.set({ welcomeEmailSentAt: Date.now() }, { merge: true });
    }

    return res.status(200).json({ ok, enviado: ok });

  } catch (err) {
    console.error("[send-welcome] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
