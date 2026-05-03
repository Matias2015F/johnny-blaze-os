// api/_lib/firebaseAdmin.js
// Helper compatible con el sistema existente (_firebase-admin.js)
// Soporta FIREBASE_SERVICE_ACCOUNT_B64 (base64 del JSON completo)
// y tambien FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY

const admin = require("firebase-admin");

function initApp() {
  if (admin.apps.length) return admin.app();

  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
    return admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan variables de Firebase: usa FIREBASE_SERVICE_ACCOUNT_B64 o las 3 variables separadas");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function getAdminDb() {
  initApp();
  return admin.firestore();
}

module.exports = { getAdminDb };
