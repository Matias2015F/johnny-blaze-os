import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";     // ← ESTA LÍNEA FALTABA
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <App />
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("No se pudo registrar el service worker", error);
    });
  });
}
