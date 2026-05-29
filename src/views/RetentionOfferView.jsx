import React, { useEffect, useState } from "react";
import { auth } from "../firebase.js";
import { leerAdminSettings } from "../services/saasService.js";
import { formatMoney } from "../utils/format.js";

export default function RetentionOfferView({ token }) {
  const [estado, setEstado] = useState("cargando"); // cargando | login | ok | error
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
        if (!res.ok || !data.ok) {
          throw new Error(data.error || "No se pudo cargar la oferta");
        }
        setOffer(data);
        const s = await leerAdminSettings();
        setSettings(s);
        setEstado("ok");
      } catch (e) {
        setErr(e.message || "No se pudo cargar la oferta");
        setEstado("error");
      }
    });
    return () => unsub();
  }, [token]);

  const pagar = async () => {
    try {
      if (!offer?.planKey) return;
      setSending(true);
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/mp-create-preference?mode=retention", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ plan: offer.planKey, offerToken: token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "No se pudo iniciar el pago");
      window.location.href = data.url;
    } catch (e) {
      setErr(e.message || "No se pudo iniciar el pago");
      setEstado("error");
      setSending(false);
    }
  };

  if (estado === "login") {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 text-white space-y-4">
          <p className="text-sm font-black uppercase tracking-widest text-orange-400">Oferta de retención</p>
          <p className="text-sm font-bold text-zinc-300">Iniciá sesión para usar la oferta.</p>
          <p className="text-xs text-zinc-500">Después de iniciar sesión, volvé a abrir este link.</p>
        </div>
      </div>
    );
  }

  if (estado === "error") {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center p-6">
        <div className="w-full max-w-sm rounded-[2rem] border border-red-900/40 bg-zinc-950 p-6 text-white space-y-3">
          <p className="text-sm font-black uppercase tracking-widest text-red-400">No disponible</p>
          <p className="text-sm font-bold text-zinc-300">{err || "La oferta no está disponible."}</p>
          <a href="https://app.motogestion.ar" className="inline-flex w-full items-center justify-center rounded-2xl bg-orange-600 py-4 text-[10px] font-black uppercase tracking-widest text-white">
            Volver a MotoGestión
          </a>
        </div>
      </div>
    );
  }

  if (estado !== "ok" || !offer || !settings) {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white font-black uppercase text-[10px]">
        Cargando...
      </div>
    );
  }

  const planKey = offer.planKey;
  const plan = settings.plans?.[planKey];
  const basePrice = Number(plan?.price || settings.precios?.[planKey] || 0);
  const pct = Number(offer.discountPct || 0) || 0;
  const discounted = Math.max(1, Math.round(basePrice * (1 - pct / 100)));
  const expiresStr = offer.expiresAt ? new Date(offer.expiresAt).toLocaleString("es-AR") : "";

  return (
    <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 text-white space-y-5">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Oferta por única vez</p>
          <h1 className="text-2xl font-black text-white">{plan?.label || "Plan"}</h1>
          <p className="text-xs font-bold text-zinc-400">Descuento: {pct}%</p>
          {expiresStr && <p className="text-[10px] text-zinc-500">Válido hasta {expiresStr}</p>}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Monto</p>
          <p className="mt-1 text-xl font-black text-white">{formatMoney(discounted)}</p>
          <p className="mt-1 text-[10px] text-zinc-500 line-through">{formatMoney(basePrice)}</p>
        </div>

        <button
          onClick={pagar}
          disabled={sending}
          className="w-full rounded-2xl bg-orange-600 py-4 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 disabled:opacity-50"
        >
          {sending ? "Procesando..." : "Pagar con descuento"}
        </button>
      </div>
    </div>
  );
}

