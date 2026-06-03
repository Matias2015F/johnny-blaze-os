// Script de uso interno — actualiza admin_settings/global en Firestore
// Requiere: FIREBASE_SERVICE_ACCOUNT_B64 en entorno, o ejecutar con firebase-admin instalado
// Uso: node scripts/update-admin-settings.js

const admin = require("firebase-admin");

const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
if (!b64) {
  console.error("ERROR: FIREBASE_SERVICE_ACCOUNT_B64 no está en el entorno.");
  process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const PRECIOS_REALES = {
  base: 125000,
  pro:  300000,
  full: 900000,
  currency: "ARS",
};

const DURACIONES_REALES = {
  base: 30,
  pro:  90,
  full: 365,
};

async function main() {
  const ref = db.collection("admin_settings").doc("global");
  const snap = await ref.get();

  if (!snap.exists) {
    console.error("ERROR: admin_settings/global no existe.");
    process.exit(1);
  }

  const actual = snap.data();
  console.log("Precios actuales en Firestore:", JSON.stringify(actual.precios));

  await ref.update({
    "precios.base":     PRECIOS_REALES.base,
    "precios.pro":      PRECIOS_REALES.pro,
    "precios.full":     PRECIOS_REALES.full,
    "precios.currency": PRECIOS_REALES.currency,
    "planDurations.base": DURACIONES_REALES.base,
    "planDurations.pro":  DURACIONES_REALES.pro,
    "planDurations.full": DURACIONES_REALES.full,
  });

  const nuevo = (await ref.get()).data();
  console.log("Precios actualizados:", JSON.stringify(nuevo.precios));
  console.log("OK — admin_settings/global actualizado.");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
