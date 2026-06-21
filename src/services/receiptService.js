import { db, auth } from "../firebase.js";
import { doc, writeBatch } from "firebase/firestore";

export function generateReceiptToken() {
  return "r" + crypto.randomUUID().replace(/-/g, "");
}

export async function hashPhoneLast4(last4, token) {
  if (!last4 || !token) return null;
  const data = new TextEncoder().encode(`${last4}:${token}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function normalizeDiscountPct(config = {}) {
  const value = Number(config.descuentoCalificacionPct ?? 15);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(50, Math.round(value)));
}

function buildRatingIncentive(config = {}) {
  const discountPct = normalizeDiscountPct(config);
  if (discountPct <= 0) {
    return {
      enabled: false,
      type: "",
      discountPct: 0,
      title: "",
      description: "",
      expiresAt: null,
      redeemed: false,
      automatic: false,
    };
  }

  return {
    enabled: true,
    type: "discount_pct_next_visit",
    discountPct,
    title: `${discountPct}% de descuento en tu proxima visita`,
    description: "Se registra automaticamente para esta moto cuando la calificacion queda validada.",
    expiresAt: null,
    redeemed: false,
    automatic: true,
    appliesTo: "next_workshop_visit",
  };
}

export async function crearPublicReceipt({ order, token, hash, numeroComprobante, config, moto, phoneLast4 }) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No hay usuario autenticado para emitir el comprobante verificable.");
  if (!token) throw new Error("Falta el token del comprobante verificable.");

  const phoneHash = phoneLast4 ? await hashPhoneLast4(phoneLast4, token) : null;
  const now = Date.now();

  const motoNombre = [moto?.marca, moto?.modelo].filter(Boolean).join(" ") || "";

  const batch = writeBatch(db);

  const patente = moto?.patente || moto?.patenteNormalizada || "";

  batch.set(doc(db, "publicReceipts", token), {
    token,
    uidTaller: uid,
    orderId: order.id,
    bikeId: order.bikeId || "",
    bikePatente: moto?.patente || moto?.patenteNormalizada || "",
    numeroOrden: order.numeroTrabajo || order.id,
    numeroComprobante,
    hash,
    estado: "emitido",
    fechaEmision: now,
    documentType: order.cierreTipo === "rechazo_cliente"
      ? "diagnostico_presupuesto_cerrado"
      : "servicio_realizado",
    validationStatus: "pendiente",
    validatedAt: null,
    validatedByClient: false,
    ratingEnabled: true,
    ratingUsed: false,
    ratingExpiresAt: now + 30 * 24 * 60 * 60 * 1000,
    hasPhoneVerification: !!phoneHash,
    verificationMethod: phoneHash ? "phone_last4" : "public_link",
    taller: {
      nombre: config.nombreTaller || "Taller",
      ciudad: config.ciudadTaller || "",
      provincia: config.provinciaTaller || "",
    },
    resumen: {
      moto: motoNombre,
      patente: patente.length >= 3 ? patente.slice(0, 3) + "***" : patente,
      km: order.kmEntrega || order.kmIngreso || order.km || null,
      trabajos: (order.tareas || [])
        .filter(t => t.descripcion || t.nombre || t.texto)
        .map(t => t.descripcion || t.nombre || t.texto || "")
        .filter(Boolean),
      repuestos: (order.repuestos || [])
        .filter(r => r.descripcion || r.nombre)
        .map(r => r.descripcion || r.nombre || "")
        .filter(Boolean),
      garantia: order.garantiaFinal || "",
      condicionCierre: order.cierreTipo === "rechazo_cliente"
        ? "diagnostico_cerrado"
        : "servicio_realizado",
    },
    pdfUrl: null,
    pdfStoragePath: null,       // set in P2 after PDF upload to Storage
    pdfGeneratedAt: null,       // set in P2 after PDF upload to Storage
    pdfDownloadUnlocked: false, // set to true by submit-rating after client rates (P3)
    downloadRequiresRating: true,
    incentive: buildRatingIncentive(config),
  });

  if (phoneHash) {
    batch.set(doc(db, "publicReceiptSecrets", token), {
      token,
      uidTaller: uid,
      orderId: order.id,
      phoneHash,
      createdAt: now,
    });
  }

  await batch.commit();
}
