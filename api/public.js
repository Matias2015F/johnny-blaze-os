let db;
try {
  ({ db } = require("./_firebase-admin.js"));
} catch (error) {
  console.warn("[api/public] Firebase Admin no inicializado:", error.message);
}
const { applyRateLimit } = require("./_ratelimit.js");

function normalizeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function publicWorkshopShape(doc) {
  const raw = doc.data() || {};
  return {
    id: doc.id,
    workshopUid: raw.workshopUid || doc.id,
    nombreTaller: raw.nombreTaller || raw.publicDisplayName || "Taller",
    ciudad: raw.ciudad || raw.city || "",
    provincia: raw.provincia || raw.province || "",
    lat: normalizeNumber(raw.lat),
    lng: normalizeNumber(raw.lng),
    nivel: raw.nivel || "registrado",
    ratingAvg: Number(raw.ratingAvg || 0),
    ratingCount: Number(raw.ratingCount || 0),
    recomiendaPct: raw.recomiendaPct != null ? Number(raw.recomiendaPct) : null,
    trabajosDocumentados: Number(raw.trabajosDocumentados || 0),
    garantiasRegistradas: Number(raw.garantiasRegistradas || 0),
    comentariosRecientes: Array.isArray(raw.comentariosRecientes)
      ? raw.comentariosRecientes.slice(0, 3).map((c) => ({
          texto: String(c.texto || "").slice(0, 200),
          fecha: c.fecha || null,
        }))
      : [],
  };
}

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Metodo no permitido" });
  }
  if (applyRateLimit(req, res, "public-workshops")) return;

  const mode = String(req.query?.mode || "workshops");
  if (mode !== "workshops") {
    return res.status(404).json({ ok: false, error: "Recurso no encontrado" });
  }
  if (!db) {
    return res.status(503).json({
      ok: true,
      workshops: [],
      ranking: "distance_reputation_verified",
      radiusKm: null,
      degraded: "firebase_admin_not_configured",
    });
  }

  try {
    const snap = await db.collection("publicWorkshops").where("publicProfileEnabled", "==", true).limit(100).get();
    const workshops = snap.docs.map(publicWorkshopShape).sort((a, b) => b.ratingAvg - a.ratingAvg);
    return res.status(200).json({
      ok: true,
      workshops,
      ranking: "distance_reputation_verified",
      radiusKm: null,
    });
  } catch (error) {
    console.error("[api/public]", error);
    return res.status(500).json({ ok: false, workshops: [] });
  }
};
