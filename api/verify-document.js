const { db, verifyIdToken } = require("./_firebase-admin.js");
const { applyRateLimit } = require("./_ratelimit.js");
const { sendEmail } = require("./_email.js");
const { getStorage } = require("firebase-admin/storage");

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const KNOWN_MODES = new Set([
  "download-pdf", "receipt-incentive", "public-prices",
  "lead", "publish-workshop", "public-workshops",
]);

const ALLOWED_ORIGINS = [
  "https://motogestion.ar",
  "https://www.motogestion.ar",
  "https://motogestion-landing-rose.vercel.app",
  "https://app.motogestion.ar",
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://motogestion.ar");
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function reputacion(totalOTs, mesesActivo) {
  if (totalOTs >= 200) return { nivel: "Taller Elite", estrellas: 5, mensaje: "Más de 200 órdenes registradas" };
  if (totalOTs >= 100) return { nivel: "Taller Verificado", estrellas: 5, mensaje: "Más de 100 órdenes registradas" };
  if (totalOTs >= 50)  return { nivel: "Taller Activo", estrellas: 4, mensaje: "Más de 50 órdenes registradas" };
  if (totalOTs >= 20)  return { nivel: "Taller en crecimiento", estrellas: 3, mensaje: "Más de 20 órdenes registradas" };
  if (totalOTs >= 5)   return { nivel: "Taller registrado", estrellas: 2, mensaje: "Primeros trabajos registrados" };
  return { nivel: "Taller nuevo", estrellas: 1, mensaje: "Cuenta reciente" };
}

async function handlePublicWorkshops(req, res) {
  if (applyRateLimit(req, res, "public-workshops")) return;
  res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");

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
}

async function handleLead(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST requerido" });
  if (applyRateLimit(req, res, "lead")) return;

  const body = req.body || {};
  const nombreTaller = String(body.nombreTaller || "").trim().slice(0, 100);
  const ciudad = String(body.ciudad || "").trim().slice(0, 100);
  const telefono = String(body.telefono || "").trim().slice(0, 30);

  if (!nombreTaller || !ciudad || !telefono) {
    return res.status(400).json({ ok: false, error: "Nombre, ciudad y teléfono son requeridos" });
  }

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff;">
      <h2 style="margin:0 0 16px;font-size:18px;color:#111827;font-weight:900;">Nuevo lead — MotoGestión</h2>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Taller:</strong> ${escapeHtml(nombreTaller)}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Ciudad:</strong> ${escapeHtml(ciudad)}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Teléfono:</strong> ${escapeHtml(telefono)}</p>
      <p style="margin:24px 0 0;font-size:11px;color:#9ca3af;">Enviado desde motogestion.ar</p>
    </div>
  `;

  try {
    await sendEmail({
      to: "matias4604@gmail.com",
      subject: `Lead — ${nombreTaller} (${ciudad})`,
      html,
    });
    console.log("[lead]", nombreTaller, ciudad, telefono.slice(0, 3) + "***");
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[lead]", err);
    return res.status(500).json({ ok: false, error: "Error al enviar" });
  }
}

async function handlePublishWorkshop(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "POST requerido" });
  if (applyRateLimit(req, res, "publish-workshop")) return;

  let uid;
  try {
    const decoded = await verifyIdToken(req);
    uid = decoded.uid;
  } catch {
    return res.status(401).json({ ok: false, error: "No autenticado" });
  }

  try {
    const body = req.body || {};
    const configSnap = await db.collection("users").doc(uid).collection("config").doc("global").get();
    const cfg = configSnap.exists ? configSnap.data() : {};

    // Ubicación: el frontend puede enviar valores frescos en el body para evitar
    // race conditions con el sync async de LS.setDoc a Firestore.
    const ciudadFinal    = String(body.ciudadTaller    ?? cfg.ciudadTaller    ?? "").trim();
    const provinciaFinal = String(body.provinciaTaller ?? cfg.provinciaTaller ?? "").trim();
    const latFinal = typeof body.lat === "number" ? body.lat : (typeof cfg.lat === "number" ? cfg.lat : null);
    const lngFinal = typeof body.lng === "number" ? body.lng : (typeof cfg.lng === "number" ? cfg.lng : null);

    // Status contract: el unico valor valido es "aprobado".
    // submit-rating.js y moderate-rating.js siempre escriben "aprobado".
    const ratingsQuery = db.collection("ratings").where("uidTaller", "==", uid);
    const snapAprobado = await ratingsQuery.where("status", "==", "aprobado").get();

    const aprobados = snapAprobado.docs.map((d) => d.data());

    const scoreKeys = ["scoreAtencion", "scoreClaridad", "scoreTrabajo", "scoreCumplimiento"];
    const avgKey = (key) => {
      const vals = aprobados.map((r) => r[key]).filter((v) => typeof v === "number" && v > 0);
      return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
    };

    const allScores = aprobados.flatMap((r) => scoreKeys.map((k) => r[k]).filter((v) => typeof v === "number" && v > 0));
    const ratingAvg = allScores.length ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10 : 0;

    const conRecomienda = aprobados.filter((r) => r.recomienda !== undefined && r.recomienda !== null);
    const recomiendaPct = conRecomienda.length
      ? Math.round((conRecomienda.filter((r) => r.recomienda === true).length / conRecomienda.length) * 100)
      : null;

    const comentariosRecientes = aprobados
      .filter((r) => r.comentario && String(r.comentario).trim().length > 10)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 3)
      .map((r) => ({ texto: String(r.comentario).slice(0, 200), fecha: r.createdAt || null }));

    const trabajosRef = db.collection("users").doc(uid).collection("trabajos");
    const countSnap = await trabajosRef.count().get();
    const trabajosDocumentados = countSnap.data().count;

    const rep = reputacion(trabajosDocumentados, 0);

    await db.collection("publicWorkshops").doc(uid).set({
      uid,
      nombreTaller: cfg.nombreTaller || "Taller",
      ciudad: ciudadFinal,
      provincia: provinciaFinal,
      lat: latFinal,
      lng: lngFinal,
      publicProfileEnabled: true,
      nivel: rep.nivel,
      ratingAvg,
      ratingCount: aprobados.length,
      recomiendaPct,
      scoreAtencion: avgKey("scoreAtencion"),
      scoreClaridad: avgKey("scoreClaridad"),
      scoreTrabajo: avgKey("scoreTrabajo"),
      scoreCumplimiento: avgKey("scoreCumplimiento"),
      trabajosDocumentados,
      garantiasRegistradas: 0,
      comentariosRecientes,
      updatedAt: Date.now(),
    });

    return res.status(200).json({ ok: true, ratingCount: aprobados.length, ratingAvg });
  } catch (err) {
    console.error("[publish-workshop]", err);
    return res.status(500).json({ ok: false, error: "Error al publicar el perfil." });
  }
}

const PRICES_FALLBACK = {
  base: 125000,
  pro: 300000,
  full: 900000,
  currency: "ARS",
  planDurations: { base: 30, pro: 90, full: 365 },
};

async function handlePublicPrices(req, res) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  try {
    const snap = await db.collection("admin_settings").doc("global").get();
    const data = snap.exists ? snap.data() || {} : {};
    const precios = data.precios || {};
    const planDurations = data.planDurations || {};
    const _baseDays = Number(planDurations.base ?? PRICES_FALLBACK.planDurations.base);
    const _proDays  = Number(planDurations.pro  ?? PRICES_FALLBACK.planDurations.pro);
    const _fullDays = Number(planDurations.full ?? PRICES_FALLBACK.planDurations.full);
    return res.status(200).json({
      base:     Number(precios.base     ?? PRICES_FALLBACK.base),
      pro:      Number(precios.pro      ?? PRICES_FALLBACK.pro),
      full:     Number(precios.full     ?? PRICES_FALLBACK.full),
      currency: precios.currency        || PRICES_FALLBACK.currency,
      planDurations: {
        base: Number.isFinite(_baseDays) && _baseDays >= 28  ? _baseDays : PRICES_FALLBACK.planDurations.base,
        pro:  Number.isFinite(_proDays)  && _proDays  >= 60  ? _proDays  : PRICES_FALLBACK.planDurations.pro,
        full: Number.isFinite(_fullDays) && _fullDays >= 300 ? _fullDays : PRICES_FALLBACK.planDurations.full,
      },
    });
  } catch (err) {
    console.warn("[public-prices] Firestore error, using fallback:", err.message);
    return res.status(200).json(PRICES_FALLBACK);
  }
}

function cleanReceiptToken(value) {
  return String(value || "").trim().slice(0, 80);
}

function normalizeDiscountPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(50, Math.round(n)));
}

function buildReceiptIncentive(discountPct) {
  if (discountPct <= 0) {
    return {
      enabled: false,
      type: "",
      discountPct: 0,
      title: "",
      description: "",
      automatic: false,
    };
  }

  return {
    enabled: true,
    type: "discount_pct_next_visit",
    discountPct,
    title: `${discountPct}% de descuento en tu proxima visita`,
    description: "El beneficio queda registrado automaticamente para esta moto si la calificacion queda validada.",
    automatic: true,
    appliesTo: "next_workshop_visit",
  };
}

async function handleReceiptIncentive(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET requerido" });
  if (applyRateLimit(req, res, "receipt-incentive")) return;
  res.setHeader("Cache-Control", "private, max-age=60");

  const token = cleanReceiptToken(req.query?.token);
  if (!/^r[a-f0-9]{32}$/i.test(token)) {
    return res.status(400).json({ ok: false, error: "Token invalido." });
  }

  try {
    const receiptSnap = await db.collection("publicReceipts").doc(token).get();
    if (!receiptSnap.exists) {
      return res.status(404).json({ ok: false, error: "Comprobante no encontrado." });
    }

    const receipt = receiptSnap.data() || {};
    const receiptPct = normalizeDiscountPct(receipt.incentive?.discountPct);
    if (receipt.incentive?.enabled && receiptPct > 0) {
      return res.status(200).json({ ok: true, incentive: buildReceiptIncentive(receiptPct) });
    }

    const uidTaller = String(receipt.uidTaller || "").trim().slice(0, 160);
    if (!uidTaller) {
      return res.status(200).json({ ok: true, incentive: buildReceiptIncentive(0) });
    }

    const configSnap = await db.collection("users").doc(uidTaller).collection("config").doc("global").get();
    const config = configSnap.exists ? configSnap.data() : {};
    const configPct = normalizeDiscountPct(config.descuentoCalificacionPct ?? 15);

    return res.status(200).json({ ok: true, incentive: buildReceiptIncentive(configPct) });
  } catch (error) {
    console.error("[receipt-incentive]", error);
    return res.status(500).json({ ok: false, error: "No se pudo leer el beneficio." });
  }
}

async function handleDownloadPdf(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "GET requerido" });
  if (applyRateLimit(req, res, "download-pdf")) return;
  res.setHeader("Cache-Control", "no-store");

  const token = cleanReceiptToken(req.query?.token);
  if (!/^r[a-f0-9]{32}$/i.test(token)) {
    return res.status(400).json({ ok: false, error: "Token invalido." });
  }

  try {
    const receiptSnap = await db.collection("publicReceipts").doc(token).get();
    if (!receiptSnap.exists) {
      return res.status(404).json({ ok: false, error: "Comprobante no encontrado." });
    }

    const receipt = receiptSnap.data();

    if (receipt.estado === "anulado") {
      return res.status(410).json({ ok: false, error: "Comprobante anulado." });
    }
    if (!receipt.ratingUsed) {
      return res.status(403).json({ ok: false, error: "Califica el servicio para habilitar la descarga." });
    }
    if (!receipt.pdfStoragePath) {
      return res.status(404).json({ ok: false, error: "El PDF no fue generado todavia. Pediselo al taller." });
    }

    const file = getStorage().bucket("johnny-blaze-taller.firebasestorage.app").file(receipt.pdfStoragePath);
    const [exists] = await file.exists();
    if (!exists) {
      return res.status(404).json({ ok: false, error: "El archivo PDF no se encontro en el servidor." });
    }

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 15 * 60 * 1000,
      responseDisposition: `attachment; filename="comprobante-${receipt.numeroComprobante || token.slice(0, 8)}.pdf"`,
    });

    return res.status(200).json({ ok: true, url, expiresIn: 900 });
  } catch (error) {
    console.error("[download-pdf]", error.message);
    return res.status(500).json({ ok: false, error: "No se pudo generar el enlace de descarga." });
  }
}

module.exports = async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();

  const mode = req.query?.mode;
  if (mode !== undefined && !KNOWN_MODES.has(mode)) {
    return res.status(400).json({ ok: false, error: "Modo no reconocido." });
  }

  if (mode === "download-pdf") {
    return handleDownloadPdf(req, res);
  }

  if (mode === "receipt-incentive") {
    return handleReceiptIncentive(req, res);
  }

  if (mode === "public-prices") {
    return handlePublicPrices(req, res);
  }

  if (mode === "lead") {
    return handleLead(req, res);
  }

  if (mode === "publish-workshop") {
    return handlePublishWorkshop(req, res);
  }

  if (req.method !== "GET") return res.status(405).end();

  if (mode === "public-workshops") {
    return handlePublicWorkshops(req, res);
  }

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
