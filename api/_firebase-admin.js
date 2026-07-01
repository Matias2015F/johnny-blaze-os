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
//   FIREBASE_SERVICE_ACCOUNT_B64 = (la cadena base64 resultante)
// ─────────────────────────────────────────────────────────────────────────────

const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");

if (!getApps().length) {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 no está definida");
  const storageBucket = String(process.env.FIREBASE_STORAGE_BUCKET || "").trim();
  if (!storageBucket) throw new Error("FIREBASE_STORAGE_BUCKET no está definida");

  const serviceAccount = JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  initializeApp({
    credential: cert(serviceAccount),
    storageBucket,
  });
}

// Extrae y verifica el Firebase ID Token del header Authorization: Bearer <token>.
// Lanza con err.status = 401 si el header falta o el token es invalido.
async function verifyIdToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    const err = new Error("Token requerido");
    err.status = 401;
    throw err;
  }
  return getAuth().verifyIdToken(header.slice(7));
}

// Verifica que el token decodificado tenga el custom claim { admin: true }.
// Lanza con err.status = 403 si no lo tiene.
function assertAdmin(decoded) {
  if (decoded?.admin !== true) {
    const err = new Error("No autorizado como administrador");
    err.status = 403;
    throw err;
  }
}

module.exports = { db: getFirestore(), verifyIdToken, assertAdmin };
