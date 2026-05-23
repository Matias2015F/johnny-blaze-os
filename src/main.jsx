import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import VerifyReceiptView from "./views/VerifyReceiptView.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";
import { APP_BUILD } from "./generated/appVersion.js";

const verifyMatch = window.location.pathname.match(/^\/verificar\/([a-zA-Z0-9_-]{10,})/);
const VERIFY_TOKEN = verifyMatch ? verifyMatch[1] : null;

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    {VERIFY_TOKEN ? <VerifyReceiptView token={VERIFY_TOKEN} /> : <App />}
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
