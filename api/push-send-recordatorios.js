// Cron diario 9:00 AM — revisa recordatorios activos y envía Web Push
// Vercel inyecta: Authorization: Bearer ${CRON_SECRET}

const { db } = require("./_firebase-admin.js");
const webpush = require("web-push");
const crypto = require("crypto");

const MS_DAY = 24 * 60 * 60 * 1000;
const MARGEN_DIAS = 7;
const MIN_INTERVAL_MS = 20 * 60 * 60 * 1000; // no más de 1 push cada 20h por recordatorio

webpush.setVapidDetails(
  "mailto:matias4604@gmail.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

function evaluarEstado(rec, kmActual, ahora) {
  if (rec.unidad === "km" && kmActual != null) {
    if (kmActual >= rec.kmObjetivo) return "service_vencido";
    if (kmActual >= rec.kmAviso)    return "proximo_service";
    return "normal";
  }
  if (rec.fechaObjetivo) {
    const obj   = new Date(rec.fechaObjetivo).getTime();
    const aviso = rec.unidad === "minutos" ? obj - 60000 : obj - MARGEN_DIAS * MS_DAY;
    if (ahora >= obj)   return "service_vencido";
    if (ahora >= aviso) return "proximo_service";
    return "normal";
  }
  return "normal";
}

function endpointHash(endpoint) {
  return crypto.createHash("sha256").update(endpoint).digest("hex").slice(0, 20);
}

module.exports = async function handler(req, res) {
  // Consolidation: /api/push-subscribe is rewritten here with ?mode=subscribe
  const mode = String(req.query?.mode || "").toLowerCase();
  if (mode === "subscribe") {
    const { verifyIdToken } = require("./_firebase-admin.js");
    const { applyRateLimit } = require("./_ratelimit.js");
    if (applyRateLimit(req, res, "push-subscribe")) return;

    let decoded;
    try {
      decoded = await verifyIdToken(req);
    } catch (err) {
      return res.status(err.status || 401).json({ error: "No autorizado" });
    }
    const uid = decoded.uid;

    if (req.method === "POST") {
      const { subscription } = req.body || {};
      if (!subscription?.endpoint) {
        return res.status(400).json({ error: "subscription.endpoint requerido" });
      }
      const hash = endpointHash(subscription.endpoint);
      await db.collection("users").doc(uid).collection("pushSubscriptions").doc(hash).set({
        endpoint: subscription.endpoint,
        keys: subscription.keys || null,
        expirationTime: subscription.expirationTime || null,
        uid,
        updatedAt: Date.now(),
      });
      return res.status(200).json({ ok: true });
    }

    if (req.method === "DELETE") {
      const { endpoint } = req.body || {};
      if (!endpoint) {
        return res.status(400).json({ error: "endpoint requerido" });
      }
      const hash = endpointHash(endpoint);
      await db.collection("users").doc(uid).collection("pushSubscriptions").doc(hash).delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const ahora = Date.now();
  const stats = { usuarios: 0, enviados: 0, omitidos: 0, expiradas: 0, errores: 0 };

  try {
    // Iterar usuarios que tienen la subcol users/{uid}
    const usersSnap = await db.collection("users").listDocuments();

    for (const userRef of usersSnap) {
      stats.usuarios++;
      const uid = userRef.id;

      // Leer suscripciones push — si no hay, saltar
      const subsSnap = await userRef.collection("pushSubscriptions").get();
      if (subsSnap.empty) continue;
      const subscriptions = subsSnap.docs.map((d) => ({ _id: d.id, ...d.data() }));

      // Leer recordatorios activos
      const recsSnap = await userRef.collection("recordatorios")
        .where("estado", "in", ["pendiente", "avisado"])
        .get();
      if (recsSnap.empty) continue;

      // Mapa de motos para leer km actuales
      const motosSnap = await userRef.collection("motos").get();
      const motosMap = {};
      motosSnap.docs.forEach((d) => { motosMap[d.id] = d.data(); });

      for (const recDoc of recsSnap.docs) {
        const rec = recDoc.data();

        // Ignorar recordatorios de prueba
        if (rec.testMode) { stats.omitidos++; continue; }

        // No re-enviar si el push reciente ya fue enviado
        if (rec.pushSentAt && ahora - rec.pushSentAt < MIN_INTERVAL_MS) {
          stats.omitidos++;
          continue;
        }

        const moto     = motosMap[rec.motoId] || {};
        const kmActual = moto.kilometrajeActual || moto.km || null;
        const estado   = evaluarEstado(rec, kmActual, ahora);

        if (estado !== "proximo_service" && estado !== "service_vencido") {
          stats.omitidos++;
          continue;
        }

        const titulo = `${moto.patente || "---"} — ${estado === "service_vencido" ? "Service vencido" : "Proximo service"}`;
        const descCorta = (rec.descripcion || "Control pendiente").slice(0, 48);
        const cuerpo = descCorta;
        const payload = JSON.stringify({ titulo, cuerpo, url: "/", tag: `jbos-rec-${recDoc.id}` });

        let pushEnviado = false;

        for (const sub of subscriptions) {
          const pushSub = {
            endpoint: sub.endpoint,
            keys: sub.keys,
            ...(sub.expirationTime ? { expirationTime: sub.expirationTime } : {}),
          };
          try {
            await webpush.sendNotification(pushSub, payload);
            pushEnviado = true;
            stats.enviados++;
          } catch (e) {
            if (e.statusCode === 410 || e.statusCode === 404) {
              // Suscripción expirada — eliminar
              await userRef.collection("pushSubscriptions").doc(sub._id).delete().catch(() => {});
              stats.expiradas++;
            } else {
              console.error(`[push] uid=${uid} rec=${recDoc.id}`, e.message);
              stats.errores++;
            }
          }
        }

        if (pushEnviado) {
          await recDoc.ref.update({ pushSentAt: ahora }).catch(() => {});
        }
      }
    }

    console.log("[push-send-recordatorios]", JSON.stringify(stats));
    return res.status(200).json({ ok: true, ...stats });

  } catch (err) {
    console.error("[push-send-recordatorios] Error fatal:", err);
    return res.status(500).json({ error: err.message });
  }
};
