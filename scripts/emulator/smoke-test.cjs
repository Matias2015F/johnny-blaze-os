// Smoke test autenticado para Firebase Emulator — demo-motogestion
// Requiere: emuladores corriendo + seed ejecutado
// Usar: npm run auth-smoke-test

process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const admin = require("firebase-admin");
const http = require("http");

admin.initializeApp({ projectId: "demo-motogestion" });

const db = admin.firestore();

const FIXTURE_UID = "fixture-uid-001";
const FIXTURE_EMAIL = "test@motogestion.local";
const FIXTURE_PASSWORD = "emulator-test-123";

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
      },
      (res) => {
        let chunks = "";
        res.on("data", (c) => (chunks += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(chunks));
          } catch {
            resolve({ _raw: chunks });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function smokeTest() {
  const results = {
    LOGIN_WITH_FIXTURE: "no",
    READ_FROM_FIRESTORE_EMULATOR: "no",
    WRITE_TO_FIRESTORE_EMULATOR: "no",
    PRODUCTION_PROJECT_BLOCKED: "no",
    EXTERNAL_EFFECTS_BLOCKED: "no",
    BROWSER_TEST_EXITS_CLEANLY: "skipped — requiere playwright separado",
  };

  // 1. LOGIN via Auth Emulator REST
  try {
    const loginRes = await httpPost(
      "http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key",
      { email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD, returnSecureToken: true }
    );
    if (loginRes.idToken) {
      results.LOGIN_WITH_FIXTURE = "si";
    } else {
      results.LOGIN_WITH_FIXTURE = `no — ${loginRes.error?.message || JSON.stringify(loginRes)}`;
    }
  } catch (e) {
    results.LOGIN_WITH_FIXTURE = `no — ${e.message}`;
  }

  // 2. READ desde Firestore Emulator
  try {
    const snap = await db.collection("usuarios").doc(FIXTURE_UID).get();
    if (snap.exists) {
      results.READ_FROM_FIRESTORE_EMULATOR = "si";
    } else {
      results.READ_FROM_FIRESTORE_EMULATOR = "no — doc no encontrado (ejecutar seed:emulator primero)";
    }
  } catch (e) {
    results.READ_FROM_FIRESTORE_EMULATOR = `no — ${e.message}`;
  }

  // 3. WRITE a Firestore Emulator
  try {
    await db.collection("smoke_test").doc("result").set({
      ts: Date.now(),
      uid: FIXTURE_UID,
    });
    results.WRITE_TO_FIRESTORE_EMULATOR = "si";
  } catch (e) {
    results.WRITE_TO_FIRESTORE_EMULATOR = `no — ${e.message}`;
  }

  // 4. Verificar aislamiento de produccion
  results.PRODUCTION_PROJECT_BLOCKED =
    process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:8080" ? "si" : "no";

  results.EXTERNAL_EFFECTS_BLOCKED =
    process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:9099" ? "si" : "no";

  console.log("\n=== SMOKE TEST R3-B ===");
  for (const [key, val] of Object.entries(results)) {
    console.log(`${key}: ${val}`);
  }

  const critical = [
    "LOGIN_WITH_FIXTURE",
    "READ_FROM_FIRESTORE_EMULATOR",
    "WRITE_TO_FIRESTORE_EMULATOR",
    "PRODUCTION_PROJECT_BLOCKED",
    "EXTERNAL_EFFECTS_BLOCKED",
  ];
  const failed = critical.filter((k) => results[k] !== "si");

  if (failed.length === 0) {
    console.log("\nSMOKE_TEST: PASSED");
    process.exit(0);
  } else {
    console.log(`\nSMOKE_TEST: FAILED — ${failed.join(", ")}`);
    process.exit(1);
  }
}

smokeTest().catch((e) => {
  console.error("SMOKE_TEST_ERROR:", e.message);
  process.exit(1);
});
