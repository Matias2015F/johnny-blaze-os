const { db } = require("./_firebase-admin.js");
const { applyRateLimit } = require("./_ratelimit.js");

const ALLOWED_ORIGINS = [
  "https://motogestion.ar",
  "https://www.motogestion.ar",
  "https://app.motogestion.ar",
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://motogestion.ar");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function reputacion(totalOTs, mesesActivo) {
  if (totalOTs >= 200) return { nivel: "Taller Elite", estrellas: 5, mensaje: "Más de 200 órdenes registradas" };
  if (totalOTs >= 100) return { nivel: "Taller Verificado", estrellas: 5, mensaje: "Más de 100 órdenes registradas" };
  if (totalOTs >= 50)  return { nivel: "Taller Activo", estrellas: 4, mensaje: "Más de 50 órdenes registradas" };
  if (totalOTs >= 20)  return { nivel: "Taller en crecimiento", estrellas: 3, mensaje: "Más de 20 órdenes registradas" };
  if (totalOTs >= 5)   return { nivel: "Taller registrado", estrellas: 2, mensaje: "Primeros trabajos registrados" };
  return { nivel: "Taller nuevo", estrellas: 1, mensaje: "Cuenta reciente" };
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).end();

  if (applyRateLimit(req, res, "verify-document")) return;

  const { uid, ot } = req.query;

  if (!uid || !ot) {
    return res.status(400).json({ valid: false, error: "Parámetros uid y ot requeridos" });
  }

  // Basic sanity checks to avoid probing
  if (typeof uid !== "string" || uid.length > 128 || typeof ot !== "string" || ot.length > 32) {
    return res.status(400).json({ valid: false, error: "Parámetros inválidos" });
  }
  if (!/^OT-\d+$/.test(ot)) {
    return res.status(400).json({ valid: false, error: "Número de OT con formato inválido. Debe ser OT-XXXXXX." });
  }

  try {
    // 1 — Load user SaaS profile (nombreTaller, createdAt)
    const saasSnap = await db.collection("usuarios").doc(uid).get();
    if (!saasSnap.exists) {
      return res.status(404).json({ valid: false, error: "Taller no encontrado" });
    }
    const saasData = saasSnap.data();

    // 2 — Load taller config for nombreTaller
    const configSnap = await db.collection("users").doc(uid).collection("config").doc("global").get();
    const configData = configSnap.exists ? configSnap.data() : {};
    const nombreTaller = configData.nombreTaller || saasData.nombreTaller || "Taller Moto Gestión";

    // 3 — Find the specific trabajo by numeroTrabajo
    const trabajosRef = db.collection("users").doc(uid).collection("trabajos");
    const otQuery = await trabajosRef.where("numeroTrabajo", "==", ot).limit(1).get();

    if (otQuery.empty) {
      return res.status(404).json({ valid: false, error: "Documento no encontrado. Verificá el número de OT." });
    }

    const trabajoDoc = otQuery.docs[0];
    const trabajo = trabajoDoc.data();

    // 4 — Load bike info
    let vehiculo = null;
    if (trabajo.bikeId) {
      const bikeSnap = await db.collection("users").doc(uid).collection("motos").doc(trabajo.bikeId).get();
      if (bikeSnap.exists) {
        const b = bikeSnap.data();
        vehiculo = {
          patente: b.patente || "—",
          marca: b.marca || "—",
          modelo: b.modelo || "—",
          cilindrada: b.cilindrada || null,
        };
      }
    }

    // 5 — Count total trabajos (reputation signal)
    const countSnap = await trabajosRef.count().get();
    const totalOTs = countSnap.data().count;

    // 6 — Member since
    let memberSince = null;
    if (saasData.createdAt) {
      const ts = typeof saasData.createdAt?.toDate === "function"
        ? saasData.createdAt.toDate()
        : new Date(saasData.createdAt);
      memberSince = ts.toISOString().slice(0, 10);
    }

    // 7 — Fecha del trabajo
    let fechaDocumento = null;
    const fechaRaw = trabajo.fechaIngreso || trabajo.createdAt;
    if (fechaRaw) {
      const ts = typeof fechaRaw?.toDate === "function"
        ? fechaRaw.toDate()
        : new Date(Number(fechaRaw) || fechaRaw);
      fechaDocumento = ts.toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });
    }

    // 8 — Compute reputation
    const mesesActivo = memberSince
      ? Math.floor((Date.now() - new Date(memberSince).getTime()) / (1000 * 60 * 60 * 24 * 30))
      : 0;
    const rep = reputacion(totalOTs, mesesActivo);

    return res.status(200).json({
      valid: true,
      taller: {
        nombre: nombreTaller,
        memberSince,
        totalOTs,
      },
      documento: {
        numero: ot,
        fecha: fechaDocumento,
        estado: trabajo.estado || "cerrado",
        vehiculo,
      },
      reputacion: rep,
    });

  } catch (err) {
    console.error("[verify-document]", err);
    return res.status(500).json({ valid: false, error: "Error interno al verificar" });
  }
};
