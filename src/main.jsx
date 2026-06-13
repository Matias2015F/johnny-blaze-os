import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import AppLoadingScreen from "./components/AppLoadingScreen.jsx";
import "./index.css";
import { APP_BUILD } from "./generated/appVersion.js";
import { resolveDiagnosticsEntry } from "./app/diagnostics/diagnosticsEntry.js";

const diagnosticsEntry = resolveDiagnosticsEntry({
  pathname: window.location.pathname,
  search: window.location.search,
  env: import.meta.env,
});
const OrdenShadowDiagnosticsView = lazy(() => import("./modules/ordenes/views/OrdenShadowDiagnosticsView.jsx"));
const VerifyReceiptView = lazy(() => import("./views/VerifyReceiptView.jsx"));
const RetentionOfferView = lazy(() => import("./views/RetentionOfferView.jsx"));
const TallerPublicView = lazy(() => import("./views/TallerPublicView.jsx"));
const verifyMatch = window.location.pathname.match(/^\/verificar\/([a-zA-Z0-9_-]{10,})/);
const VERIFY_TOKEN = verifyMatch ? verifyMatch[1] : null;
const offerMatch = window.location.pathname.match(/^\/oferta\/([^/]+)$/);
const OFFER_TOKEN = offerMatch ? offerMatch[1] : null;
const tallerMatch = window.location.pathname.match(/^\/taller\/([^/]+)$/);
const TALLER_UID = tallerMatch ? tallerMatch[1] : null;

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    {diagnosticsEntry === "ORDEN_SHADOW" ? (
      <Suspense
        fallback={<AppLoadingScreen title="Diagnostico interno" detail="Preparando el panel de sombra..." />}
      >
        <OrdenShadowDiagnosticsView />
      </Suspense>
    ) : VERIFY_TOKEN ? (
      <Suspense fallback={<AppLoadingScreen title="Verificacion pública" detail="Cargando comprobante..." />}>
        <VerifyReceiptView token={VERIFY_TOKEN} />
      </Suspense>
    ) : OFFER_TOKEN ? (
      <Suspense fallback={<AppLoadingScreen title="Oferta de retención" detail="Cargando beneficio..." />}>
        <RetentionOfferView token={OFFER_TOKEN} />
      </Suspense>
    ) : TALLER_UID ? (
      <Suspense fallback={<AppLoadingScreen title="Perfil público" detail="Cargando información del taller..." />}>
        <TallerPublicView uid={TALLER_UID} />
      </Suspense>
    ) : (
      <App />
    )}
  </ErrorBoundary>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(APP_BUILD.version)}`, { updateViaCache: "none" })
      .then((registration) => registration.update().catch(() => null))
      .catch((error) => {
        console.error("No se pudo registrar el service worker", error);
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  });
}
