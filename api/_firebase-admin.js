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

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId:   process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

module.exports = { db: getFirestore() };
