// Cron diario 10:00 AM — detecta vencimientos próximos, período de gracia y suspensiones
// Vercel cron inyecta Authorization: Bearer ${CRON_SECRET} automáticamente

const { db } = require("./_firebase-admin.js");
const {
  sendEmail,
  templateVencimientoProximo,
  templateEnGracia,
  templateSuspendido,
} = require("./_email.js");

const MS_DAY = 24 * 60 * 60 * 1000;
const DIAS_GRACIA_DEFAULT = 3;

// Días antes del vencimiento en que se envían alertas
const UMBRALES_DIAS = [7, 3, 1];

module.exports = async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const now = Date.now();
  const resultados = { vencimientoProximo: 0, gracia: 0, suspendidos: 0, omitidos: 0, errores: 0 };

  try {
    const snap = await db.collection("usuarios").get();
    const batch = db.batch();
    const emailPromises = [];

    for (const userDoc of snap.docs) {
      const u = userDoc.data();
      const emailDestino = u.emailNotificacion || u.email;
      const puedeEnviarEmail = !!emailDestino;

      const activoHasta = u.activoHasta || u.trialEndsAt || null;
      const estado = (u.estado || "trial").toLowerCase();
      const esAdmin = u.isPlatformAdmin || u.rol === "admin";
      if (esAdmin) continue;

      // ── 1. Vencimiento próximo (estado activo o trial, con fecha futura) ────
      if ((estado === "activo" || estado === "trial") && activoHasta && activoHasta > now) {
        const msRestantes = activoHasta - now;
        if (msRestantes <= 8 * MS_DAY) {
          const diasRestantes = Math.max(1, Math.ceil(msRestantes / MS_DAY));
          const umbral = UMBRALES_DIAS.find((u) => diasRestantes <= u);

          if (umbral && puedeEnviarEmail) {
            const yaEnviado = u.alertas?.[`d${umbral}SentAt`];

            if (!yaEnviado || now - yaEnviado > 20 * MS_DAY) {
              const tpl = templateVencimientoProximo({ diasRestantes, activoHasta });
              emailPromises.push(
                sendEmail({ to: emailDestino, ...tpl })
                  .then((ok) => {
                    if (ok) {
                      batch.set(userDoc.ref, { alertas: { [`d${umbral}SentAt`]: now } }, { merge: true });
                      resultados.vencimientoProximo++;
                    }
                  })
                  .catch((err) => { console.error("vencimientoProximo error:", emailDestino, err); resultados.errores++; })
              );
            } else {
              resultados.omitidos++;
            }
          }
        }
        continue;
      }

      // ── 2. Período de gracia (venció pero aún tiene graceEndsAt futuro) ────
      const diasGracia = Number(u.graceDays || DIAS_GRACIA_DEFAULT);
      const graceEndsAt = u.graceEndsAt || (diasGracia > 0 ? activoHasta + diasGracia * MS_DAY : null);

      if (activoHasta && activoHasta < now && graceEndsAt && graceEndsAt > now && estado !== "suspendido") {
        const diasGracia = Math.max(1, Math.ceil((graceEndsAt - now) / MS_DAY));
        const yaEnviado = u.alertas?.graciaSentAt;

        batch.set(userDoc.ref, {
          estado: "gracia",
          pagoEstado: "vencido",
          graceEndsAt,
          updatedAt: now,
        }, { merge: true });

        if (puedeEnviarEmail && (!yaEnviado || now - yaEnviado > 2 * MS_DAY)) {
          const tpl = templateEnGracia({ graceEndsAt, diasRestantes: diasGracia });
          emailPromises.push(
            sendEmail({ to: emailDestino, ...tpl })
              .then((ok) => {
                if (ok) {
                  batch.set(userDoc.ref, { alertas: { graciaSentAt: now } }, { merge: true });
                  resultados.gracia++;
                }
              })
              .catch((err) => { console.error("gracia error:", emailDestino, err); resultados.errores++; })
          );
        } else {
          resultados.omitidos++;
        }
        continue;
      }

      // ── 3. Suspensión (venció sin gracia, estado activo/trial/gracia) ───────
      const estadosSuspendibles = ["activo", "trial", "gracia"];
      if (
        activoHasta &&
        activoHasta < now &&
        estadosSuspendibles.includes(estado) &&
        (!graceEndsAt || graceEndsAt < now)
      ) {
        const yaEnviado = u.alertas?.suspendidoSentAt;

        batch.set(userDoc.ref, {
          estado: "suspendido",
          pagoEstado: "vencido",
          updatedAt: now,
          ...(graceEndsAt ? { graceEndsAt } : {}),
        }, { merge: true });

        if (puedeEnviarEmail && !yaEnviado) {
          const tpl = templateSuspendido();
          emailPromises.push(
            sendEmail({ to: emailDestino, ...tpl })
              .then((ok) => {
                if (ok) {
                  batch.set(userDoc.ref, {
                    alertas: { suspendidoSentAt: now },
                  }, { merge: true });
                  resultados.suspendidos++;
                }
              })
              .catch((err) => { console.error("suspendido error:", emailDestino, err); resultados.errores++; })
          );
        } else {
          resultados.omitidos++;
        }
      }
    }

    await Promise.all(emailPromises);
    await batch.commit();

    console.log("[check-expirations]", JSON.stringify(resultados));
    return res.status(200).json({ ok: true, ...resultados });

  } catch (err) {
    console.error("[check-expirations] Error fatal:", err);
    return res.status(500).json({ error: err.message });
  }
};
