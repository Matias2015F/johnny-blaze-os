import { useState, useEffect } from "react";
import { auth } from "../firebase.js";
import { leerAdminSettings, leerUsuarioSaasRawDesdeServidor, resolveSaasAccess } from "../services/saasService.js";

export function useRetentionOffer(token) {
  const [estado, setEstado] = useState("cargando"); // cargando | login | ok | activa | error
  const [err, setErr] = useState("");
  const [offer, setOffer] = useState(null);
  const [settings, setSettings] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        setEstado("login");
        return;
      }
      setEstado("cargando");
      try {
        const idToken = await u.getIdToken();
        const res = await fetch("/api/retention-offer", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ offerToken: token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo cargar la oferta");
        setOffer(data);
        const s = await leerAdminSettings();
        setSettings(s);
        setEstado("ok");
      } catch (e) {
        try {
          const freshAccount = await leerUsuarioSaasRawDesdeServidor(u.uid);
          const access = resolveSaasAccess(freshAccount);
          if (access.acceso === true) {
            setErr("Tu suscripción ya está activa. La oferta anterior quedó cerrada.");
            setEstado("activa");
            return;
          }
        } catch (refreshError) {
          console.warn("[retention-offer] No se pudo verificar suscripción vigente:", refreshError.message);
        }
        setErr(e.message || "No se pudo cargar la oferta");
        setEstado("error");
      }
    });
    return () => unsub();
  }, [token]);

  const pagar = async () => {
    if (!offer?.planKey || sending) return { ok: false };
    setSending(true);
    try {
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/mp-create-preference?mode=retention", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ plan: offer.planKey, offerToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "No se pudo iniciar el pago");
      window.location.href = data.url;
      return { ok: true };
    } catch (e) {
      setErr(e.message || "No se pudo iniciar el pago");
      setEstado("error");
      return { ok: false, mensaje: e.message };
    } finally {
      setSending(false);
    }
  };

  return { estado, err, offer, settings, sending, pagar };
}
