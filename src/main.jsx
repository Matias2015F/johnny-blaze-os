import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { APP_BUILD } from "./generated/appVersion.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(APP_BUILD.version)}`, { updateViaCache: "none" })
      .then((registration) => registration.update().catch(() => null))
      .catch((error) => {
        console.error("No se pudo registrar el service worker", error);
      });
  });
}
