// Genera el link de reset de Firebase y lo envía via Resend (noreply@motogestion.ar)
// Así el email llega desde el dominio propio y no va a spam

const { db } = require("./_firebase-admin.js");
const { getAuth } = require("firebase-admin/auth");
const { sendEmail } = require("./_email.js");
const { applyRateLimit } = require("./_ratelimit.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (applyRateLimit(req, res, "send-password-reset")) return;

  const { email } = req.body || {};
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Email inválido" });
  }

  try {
    const adminAuth = getAuth();

    // Genera el link de reset de Firebase (sin que Firebase envíe el email)
    const link = await adminAuth.generatePasswordResetLink(email.trim().toLowerCase(), {
      url: "https://app.motogestion.ar",  // redirige a la app después de resetear
    });

    // Envía el email via Resend desde noreply@motogestion.ar
    const html = require("./_email.js").buildResetEmail({ email, link });
    const ok = await sendEmail({
      to: email.trim().toLowerCase(),
      subject: "Restablecer contraseña — Johnny Blaze OS",
      html,
    });

    if (!ok) {
      return res.status(500).json({ error: "No se pudo enviar el correo" });
    }

    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error("[send-password-reset] Error:", err.code, err.message);

    if (err.code === "auth/user-not-found" || err.code === "auth/email-not-found") {
      // No revelar si el email existe o no (seguridad)
      return res.status(200).json({ ok: true });
    }

    return res.status(500).json({ error: "Error al procesar la solicitud" });
  }
};
