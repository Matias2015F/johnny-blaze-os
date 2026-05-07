// Cron diario: detecta suscripciones próximas a vencer y envía alertas por email
// Vercel ejecuta este endpoint según el schedule en vercel.json
// El header Authorization: Bearer ${CRON_SECRET} es inyectado automáticamente por Vercel

const { db } = require("./_firebase-admin.js");
const { sendEmail, templateAlertaVencimiento } = require("./_email.js");

const MS_DAY = 24 * 60 * 60 * 1000;
const UMBRALES_DIAS = [7, 3]; // alertas a X días del vencimiento

module.exports = async function handler(req, res) {
  // Verificar que es Vercel quien llama (o un admin con el secret)
  const auth = req.headers.authorization;
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = Date.now();
  let enviados = 0;
  let omitidos = 0;

  try {
    // Traer todos los usuarios activos (trial o activo) con activoHasta definido
    const snap = await db.collection("usuarios")
      .where("estado", "in", ["activo", "trial"])
      .get();

    const batch = db.batch();
    const emailPromises = [];

    for (const userDoc of snap.docs) {
      const userData = userDoc.data();
      const activoHasta = userData.activoHasta;
      if (!activoHasta) continue;

      const msRestantes = activoHasta - now;
      if (msRestantes <= 0 || msRestantes > 8 * MS_DAY) continue; // fuera de ventana

      const diasRestantes = Math.ceil(msRestantes / MS_DAY);
      const umbral = UMBRALES_DIAS.find((u) => diasRestantes <= u);
      if (!umbral) continue;

      // Campo que marca si ya se envió la alerta de este umbral
      const alertaKey = `alertas.d${umbral}SentAt`;
      const yaEnviado = userData.alertas?.[`d${umbral}SentAt`];
      if (yaEnviado && now - yaEnviado < 20 * MS_DAY) {
        omitidos++;
        continue; // ya se envió recientemente para este umbral
      }

      const emailDestino = userData.emailNotificacion || userData.email;
      if (!emailDestino) { omitidos++; continue; }

      const tpl = templateAlertaVencimiento({ diasRestantes, activoHasta });
      emailPromises.push(
        sendEmail({ to: emailDestino, ...tpl })
          .then((ok) => {
            if (ok) {
              // Marcar que se envió esta alerta
              batch.set(userDoc.ref, { alertas: { [`d${umbral}SentAt`]: now } }, { merge: true });
              enviados++;
            }
          })
          .catch((err) => console.error("Error enviando alerta a", emailDestino, err))
      );
    }

    await Promise.all(emailPromises);
    await batch.commit();

    console.log(`[check-expirations] Enviados: ${enviados}, Omitidos: ${omitidos}`);
    return res.status(200).json({ ok: true, enviados, omitidos });

  } catch (err) {
    console.error("[check-expirations] Error:", err);
    return res.status(500).json({ error: err.message });
  }
};
