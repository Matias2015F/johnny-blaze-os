// Endpoint temporal de diagnóstico — eliminar después de confirmar que funciona
const { db } = require("./_firebase-admin.js");

module.exports = async function handler(req, res) {
  const { uid } = req.query;
  if (!uid) return res.status(400).json({ error: "Falta ?uid=..." });

  const key = process.env.RESEND_API_KEY || "";
  const from = process.env.RESEND_FROM_EMAIL || "";

  let emailEnFirestore = null;
  let welcomeSentAt = null;

  try {
    const snap = await db.collection("usuarios").doc(uid).get();
    if (snap.exists) {
      const d = snap.data();
      emailEnFirestore = d.emailNotificacion || d.email || null;
      welcomeSentAt = d.welcomeEmailSentAt || null;
    }
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  return res.status(200).json({
    resend_key_cargada: key.startsWith("re_"),
    resend_key_preview: key ? key.slice(0, 6) + "..." : "(vacía)",
    from_email: from || "(no configurado — usará fallback motogestion.ar)",
    email_destino: emailEnFirestore,
    welcome_ya_enviado: !!welcomeSentAt,
  });
};
