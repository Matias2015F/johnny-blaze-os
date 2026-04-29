const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

function getGitSha() {
  try {
    return execSync("git rev-parse --short HEAD", { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

const sha = getGitSha();
const buildTime = new Date().toISOString();
const version = `${pkg.version}-${sha}`;

const versionPayload = {
  version,
  sha,
  buildTime,
};

const publicDir = path.join(root, "public");
const generatedDir = path.join(root, "src", "generated");

fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(generatedDir, { recursive: true });

fs.writeFileSync(
  path.join(publicDir, "version.json"),
  JSON.stringify(versionPayload, null, 2) + "\n",
  "utf8"
);

fs.writeFileSync(
  path.join(generatedDir, "appVersion.js"),
  `export const APP_BUILD = ${JSON.stringify(versionPayload, null, 2)};\n`,
  "utf8"
);

console.log(`Version generada: ${version}`);
