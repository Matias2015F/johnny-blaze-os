// ─────────────────────────────────────────────────────────────────────────────
// Firebase Admin SDK — inicialización compartida para las API routes de Vercel
//
// Usa UNA sola variable de entorno con el JSON completo en base64.
// Esto evita todos los problemas de formato de la private key.
//
// Cómo obtener FIREBASE_SERVICE_ACCOUNT:
//   Firebase Console → ⚙️ Configuración → Cuentas de servicio → Generar clave privada
//   → descargás un JSON
//
// Convertir a base64 (PowerShell):
//   [Convert]::ToBase64String([System.IO.File]::ReadAllBytes("ruta\al\archivo.json"))
//
// En Vercel → Settings → Environment Variables:
//   FIREBASE_SERVICE_ACCOUNT = (la cadena base64 resultante)
// ─────────────────────────────────────────────────────────────────────────────

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (!getApps().length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT no está definida");

  const serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  console.log("Firebase init — project_id:", serviceAccount.project_id);

  initializeApp({ credential: cert(serviceAccount) });
}

module.exports = { db: getFirestore() };
