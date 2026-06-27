import { useState } from "react";
import { auth } from "../firebase.js";
import { LS } from "../lib/storage.js";

export function usePublicarRedCard() {
  const [publicando, setPublicando] = useState(false);
  const [resultado,  setResultado]  = useState(null);
  const [err,        setErr]        = useState("");

  const uid      = auth.currentUser?.uid;
  const perfilUrl = uid ? `https://app.motogestion.ar/taller/${uid}` : null;

  const publicar = async () => {
    if (publicando) return;
    setPublicando(true);
    setErr("");
    setResultado(null);
    try {
      const token     = await auth.currentUser.getIdToken();
      const cfgActual = LS.getDoc("config", "global") || {};
      const res = await fetch("/api/publish-workshop", {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ciudadTaller:    cfgActual.ciudadTaller    || "",
          provinciaTaller: cfgActual.provinciaTaller || "",
          lat: typeof cfgActual.lat === "number" ? cfgActual.lat : null,
          lng: typeof cfgActual.lng === "number" ? cfgActual.lng : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo publicar.");
      setResultado(data);
    } catch (e) {
      setErr(e.message || "Error al publicar.");
    } finally {
      setPublicando(false);
    }
  };

  return { publicando, resultado, err, uid, perfilUrl, publicar };
}
