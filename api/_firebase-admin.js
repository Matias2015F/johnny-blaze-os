// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin SDK — inicialización compartida para las API routes de Vercel
//
// Las credenciales vienen de variables de entorno configuradas en Vercel.
// Para obtenerlas:
//   Firebase Console → Configuración del proyecto → Cuentas de servicio
//   → Generar nueva clave privada → descargás un JSON
//
// En Vercel Dashboard → tu proyecto → Settings → Environment Variables:
//   FIREBASE_PROJECT_ID   → campo "project_id" del JSON
//   FIREBASE_CLIENT_EMAIL → campo "client_email" del JSON
//   FIREBASE_PRIVATE_KEY  → campo "private_key" del JSON (incluyendo -----BEGIN...)
//
// IMPORTANTE: La private key tiene saltos de línea (\n). Vercel los guarda
// como texto literal. El .replace(/\\n/g, "\n") de abajo los convierte de vuelta.
// ─────────────────────────────────────────────────────────────────────────────

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Parsea la private key tolerando los formatos más comunes al copiar desde el JSON:
// - Con comillas envolventes:  "-----BEGIN PRIVATE KEY-----\n..."
// - Con \n literales:           -----BEGIN PRIVATE KEY-----\nMIIE...
// - Con saltos de línea reales: -----BEGIN PRIVATE KEY-----↵MIIE...
function parsePrivateKey(raw) {
  if (!raw) return null;
  return raw
    .replace(/^["']|["']$/g, "")  // elimina comillas externas si las hay
    .replace(/\\n/g, "\n");        // convierte \n literal a salto de línea real
}

const privateKey = parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

console.log("Firebase init — PROJECT_ID:", process.env.FIREBASE_PROJECT_ID || "NO DEFINIDO");
console.log("Firebase init — CLIENT_EMAIL:", process.env.FIREBASE_CLIENT_EMAIL || "NO DEFINIDO");
console.log("Firebase init — PRIVATE_KEY empieza con:", privateKey?.slice(0, 40) || "NO DEFINIDO");

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

module.exports = { db: getFirestore() };
