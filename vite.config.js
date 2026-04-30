import { execSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function getBuildInfo() {
  const pkgVersion = process.env.npm_package_version || "1.0.0";
  const envSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "";
  let sha = envSha ? envSha.slice(0, 7) : "";

  if (!sha) {
    try {
      sha = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
        .toString()
        .trim();
    } catch {
      sha = "dev";
    }
  }

  const buildTime = new Date().toISOString();
  return {
    version: `${pkgVersion}-${sha}`,
    sha,
    buildTime,
  };
}

const appBuild = getBuildInfo();

export default defineConfig({
  define: {
    __APP_BUILD_VERSION__: JSON.stringify(appBuild.version),
    __APP_BUILD_SHA__: JSON.stringify(appBuild.sha),
    __APP_BUILD_TIME__: JSON.stringify(appBuild.buildTime),
  },
  plugins: [
    react(),
    {
      name: "jbos-version-asset",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify(appBuild, null, 2) + "\n",
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react":    ["react", "react-dom"],
          "vendor-firebase": ["firebase/app", "firebase/auth", "firebase/firestore"],
        },
      },
    },
  },
});
