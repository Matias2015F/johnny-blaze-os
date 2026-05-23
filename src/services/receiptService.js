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

export async function crearPublicReceipt({ order, token, hash, numeroComprobante, config, moto, phoneLast4 }) {
  const uid = auth.currentUser?.uid;
  if (!uid || !token) return;

  const phoneHash = phoneLast4 ? await hashPhoneLast4(phoneLast4, token) : null;
  const now = Date.now();

  const motoNombre = [moto?.marca, moto?.modelo].filter(Boolean).join(" ") || "";

  const batch = writeBatch(db);

  batch.set(doc(db, "publicReceipts", token), {
    token,
    uidTaller: uid,
    orderId: order.id,
    numeroOrden: order.numeroTrabajo || order.id,
    numeroComprobante,
    hash,
    estado: "emitido",
    fechaEmision: now,
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
      patente: moto?.patente || moto?.patenteNormalizada || "",
    },
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
