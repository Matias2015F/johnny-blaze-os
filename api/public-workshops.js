const { db } = require("./_firebase-admin.js");
const { applyRateLimit } = require("./_ratelimit.js");

const ALLOWED_ORIGINS = [
  "https://motogestion.ar",
  "https://www.motogestion.ar",
  "https://app.motogestion.ar",
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader(
    "Access-Control-Allow-Origin",
    ALLOWED_ORIGINS.includes(origin) ? origin : "https://motogestion.ar"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Metodo no permitido" });

  if (applyRateLimit(req, res, "public-workshops")) return;

  try {
    const snap = await db
      .collection("publicWorkshops")
      .where("publicProfileEnabled", "==", true)
      .limit(50)
      .get();

    const workshops = snap.docs
      .map((d) => {
        const t = d.data();
        return {
          id: d.id,
          nombreTaller: t.nombreTaller || "Taller",
          ciudad: t.ciudad || "",
          provincia: t.provincia || "",
          lat: typeof t.lat === "number" ? t.lat : null,
          lng: typeof t.lng === "number" ? t.lng : null,
          nivel: t.nivel || "registrado",
          ratingAvg: Number(t.ratingAvg) || 0,
          ratingCount: Number(t.ratingCount) || 0,
          recomiendaPct: t.recomiendaPct != null ? Number(t.recomiendaPct) : null,
          trabajosDocumentados: Number(t.trabajosDocumentados) || 0,
          garantiasRegistradas: Number(t.garantiasRegistradas) || 0,
          comentariosRecientes: (t.comentariosRecientes || []).slice(0, 3).map((c) => ({
            texto: String(c.texto || "").slice(0, 200),
            fecha: c.fecha || null,
          })),
        };
      })
      .sort((a, b) => b.ratingAvg - a.ratingAvg);

    return res.status(200).json({ ok: true, workshops });
  } catch (error) {
    console.error("[public-workshops]", error.message);
    return res.status(500).json({ ok: false, workshops: [] });
  }
};
