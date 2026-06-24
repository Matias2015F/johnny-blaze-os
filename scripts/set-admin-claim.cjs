/**
 * Script de un solo uso: setea el custom claim { admin: true } en Firebase Auth
 * para el UID del admin de plataforma.
 *
 * Uso:
 *   node scripts/set-admin-claim.cjs <ruta/al/service-account.json>
 *
 * O con la variable de entorno (misma que usa Vercel):
 *   $env:FIREBASE_SERVICE_ACCOUNT_B64="<base64>"; node scripts/set-admin-claim.cjs
 *
 * Después de correr el script, el admin debe cerrar sesión y volver a entrar
 * para que Firebase emita un nuevo ID token con el claim incluido.
 */

const { initializeApp, cert, getApps } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const path = require("path");

const ADMIN_UID = "ERqAgJfizDNXihicDEegT2u5tws2";

async function main() {
  let serviceAccount;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8")
    );
  } else if (process.argv[2]) {
    serviceAccount = require(path.resolve(process.argv[2]));
  } else {
    console.error("Error: se necesita la service account.");
    console.error("  Opción A: node scripts/set-admin-claim.cjs ruta/sa.json");
    console.error("  Opción B: $env:FIREBASE_SERVICE_ACCOUNT_B64='...' ; node scripts/set-admin-claim.cjs");
    process.exit(1);
  }

  if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
  }

  const auth = getAuth();

  // Verificar que el UID existe antes de setear
  const user = await auth.getUser(ADMIN_UID);
  console.log(`Usuario encontrado: ${user.email} (${user.uid})`);

  // Leer claims actuales para no pisarlos
  const current = user.customClaims || {};
  const updated = { ...current, admin: true };

  await auth.setCustomUserClaims(ADMIN_UID, updated);

  // Verificar
  const verify = await auth.getUser(ADMIN_UID);
  const claims = verify.customClaims || {};
  if (claims.admin === true) {
    console.log("OK — custom claim { admin: true } seteado correctamente.");
    console.log("Claims actuales:", JSON.stringify(claims));
    console.log("");
    console.log("Proximo paso: en el admin dashboard, cerrar sesion y volver a entrar.");
  } else {
    console.error("ERROR: el claim no se aplicó. Verificar permisos de la service account.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
