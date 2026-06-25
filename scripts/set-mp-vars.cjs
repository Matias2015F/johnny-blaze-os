const https = require("https");
const fs = require("fs");

const mpToken = process.argv[2];
const mpSecret = process.argv[3];

if (!mpToken || !mpSecret) {
  console.log("Uso: node scripts/set-mp-vars.cjs MP_ACCESS_TOKEN MP_WEBHOOK_SECRET");
  process.exit(1);
}

const token = JSON.parse(
  fs.readFileSync("C:/Users/Usuario/AppData/Roaming/xdg.data/com.vercel.cli/auth.json", "utf8")
).token;

const PROJECT_ID = "prj_X415e2TPGQsMXnjvfCBXqgh0m5Fn";
const TEAM_ID = "team_OgNau5oUaKcCcbaHcrRQOGAf";

function addVar(key, value) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      key,
      value: value.trim(),
      type: "encrypted",
      target: ["production"],
    });
    const req = https.request(
      {
        hostname: "api.vercel.com",
        path: `/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`,
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  const r1 = await addVar("MP_ACCESS_TOKEN", mpToken);
  console.log(r1.status === 201 ? "MP_ACCESS_TOKEN: GUARDADO OK" : "MP_ACCESS_TOKEN ERROR: " + (r1.body.error?.message || r1.status));

  const r2 = await addVar("MP_WEBHOOK_SECRET", mpSecret);
  console.log(r2.status === 201 ? "MP_WEBHOOK_SECRET: GUARDADO OK" : "MP_WEBHOOK_SECRET ERROR: " + (r2.body.error?.message || r2.status));
}

run().catch(e => console.error("ERR:", e.message));
