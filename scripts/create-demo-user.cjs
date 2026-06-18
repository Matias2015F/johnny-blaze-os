// Crea usuario demo en Firebase Auth productivo via REST API
// No requiere Admin SDK — usa solo la API key pública
// Uso: node scripts/create-demo-user.cjs

const https = require("https");

const API_KEY = "AIzaSyBp3QTOLvsro8blyhqevJ2m5mvBRmCHIBQ";
const DEMO_EMAIL = "demo@motogestion.ar";
const DEMO_PASSWORD = "MotoDemo2026!";

function post(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const u = new URL(url);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
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
          try { resolve({ status: res.statusCode, body: JSON.parse(chunks) }); }
          catch { resolve({ status: res.statusCode, body: chunks }); }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log(`Creando usuario: ${DEMO_EMAIL}`);

  const res = await post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { email: DEMO_EMAIL, password: DEMO_PASSWORD, returnSecureToken: true }
  );

  if (res.status === 200 && res.body.localId) {
    console.log("DEMO_USER_CREATED: ok");
    console.log(`UID: ${res.body.localId}`);
    console.log(`EMAIL: ${DEMO_EMAIL}`);
    console.log(`PASSWORD: ${DEMO_PASSWORD}`);
    console.log("NOTA: Al hacer el primer login la app crea el perfil SaaS (trial 14 dias).");
  } else if (res.body?.error?.message === "EMAIL_EXISTS") {
    console.log("DEMO_USER_CREATED: ya existe — probando login para confirmar UID");

    const login = await post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
      { email: DEMO_EMAIL, password: DEMO_PASSWORD, returnSecureToken: true }
    );

    if (login.status === 200 && login.body.localId) {
      console.log("DEMO_USER_EXISTS_CONFIRMED: ok");
      console.log(`UID: ${login.body.localId}`);
      console.log(`EMAIL: ${DEMO_EMAIL}`);
      console.log(`PASSWORD: ${DEMO_PASSWORD}`);
    } else {
      console.log("LOGIN_FAILED:", JSON.stringify(login.body?.error));
    }
  } else {
    console.log("ERROR:", JSON.stringify(res.body?.error || res.body));
    process.exit(1);
  }
}

run().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
