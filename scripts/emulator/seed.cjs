// Seed de fixture para Firebase Emulator — demo-motogestion
// Requiere que los emuladores esten corriendo antes de ejecutar.
// Usar: npm run seed:emulator

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const admin = require("firebase-admin");

admin.initializeApp({ projectId: "demo-motogestion" });

const auth = admin.auth();
const db = admin.firestore();

const FIXTURE_UID = "fixture-uid-001";
const FIXTURE_EMAIL = "test@motogestion.local";
const FIXTURE_PASSWORD = "emulator-test-123";

async function seed() {
  // Auth fixture
  try {
    await auth.createUser({
      uid: FIXTURE_UID,
      email: FIXTURE_EMAIL,
      password: FIXTURE_PASSWORD,
      emailVerified: true,
    });
    console.log("AUTH_FIXTURE_CREATED: ok");
  } catch (e) {
    if (e.code === "auth/uid-already-exists") {
      console.log("AUTH_FIXTURE_CREATED: ya existe");
    } else {
      throw e;
    }
  }

  // Doc SaaS del usuario en Firestore Emulator
  await db.collection("usuarios").doc(FIXTURE_UID).set({
    email: FIXTURE_EMAIL,
    estado: "activo",
    plan: "base",
    activoHasta: Date.now() + 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  });
  console.log("FIRESTORE_USUARIOS_SEED: ok");

  // Cliente de prueba
  await db
    .collection("users")
    .doc(FIXTURE_UID)
    .collection("clientes")
    .add({
      nombre: "Cliente Fixture",
      tel: "1100000000",
      activo: true,
    });
  console.log("FIRESTORE_CLIENT_SEED: ok");

  console.log("SEED_COMPLETED: ok");
  process.exit(0);
}

seed().catch((e) => {
  console.error("SEED_FAILED:", e.message);
  process.exit(1);
});
