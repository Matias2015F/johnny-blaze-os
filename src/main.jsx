import "./firebase.js"; // initialize Firebase before any component mounts
import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import VerifyReceiptView from "./views/VerifyReceiptView.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import { APP_BUILD } from "./generated/appVersion.js";
import { applyRemoteUpdate, fetchRemoteVersion, isNewerBuild } from "./lib/appUpdate.js";
import { isAdminSurface } from "./lib/surfaces.js";

const AdminApp = lazy(() => import("./AdminApp.jsx"));

const verifyMatch = window.location.pathname.match(/^\/verificar\/([a-zA-Z0-9_-]{10,})/);
const VERIFY_TOKEN = verifyMatch ? verifyMatch[1] : null;

let updateCheckInFlight = false;
async function checkAndApplyRemoteUpdate() {
  if (updateCheckInFlight) return;
  updateCheckInFlight = true;
  try {
    const remoteBuild = await fetchRemoteVersion();
    if (isNewerBuild(APP_BUILD, remoteBuild)) await applyRemoteUpdate(remoteBuild);
  } catch (e) {
    console.warn("[app-update]", e.message);
  } finally {
    updateCheckInFlight = false;
  }
}

function AdminFallback() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Cargando panel...</p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    {isAdminSurface() ? (
      <Suspense fallback={<AdminFallback />}>
        <AdminApp />
      </Suspense>
    ) : VERIFY_TOKEN ? (
      <VerifyReceiptView token={VERIFY_TOKEN} />
    ) : (
      <App />
    )}
  </ErrorBoundary>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(APP_BUILD.version)}`, { updateViaCache: "none" })
      .then((registration) => {
        registration.update().catch(() => null);
        checkAndApplyRemoteUpdate();
      })
      .catch((error) => {
        console.error("No se pudo registrar el service worker", error);
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  });
}

window.addEventListener("focus", checkAndApplyRemoteUpdate);
window.addEventListener("online", checkAndApplyRemoteUpdate);
window.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkAndApplyRemoteUpdate();
});
window.setInterval(() => {
  if (!document.hidden) checkAndApplyRemoteUpdate();
}, 5 * 60 * 1000);
