import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { shouldAutoBackup, exportBackup } from "./lib/backup.js";
import { DEFAULT_ADMIN_SETTINGS, ensureAccountProfile } from "./lib/telemetry.js";
import { leerAdminSettings, normalizeDateMs, resolveAccountAccess } from "./services/accessService.js";
import { LS } from "./lib/storage.js";
import { CONFIG_DEFAULT } from "./lib/constants.js";

import TallerPanel from "./TallerPanel.jsx";
import LoginScreen from "./LoginScreen.jsx";

function formatMoney(value, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function buildPlansForUi(settings = DEFAULT_ADMIN_SETTINGS) {
  const plans = settings.plans || DEFAULT_ADMIN_SETTINGS.plans || {};
  return Object.entries(plans).map(([key, plan]) => ({
    key,
    label: plan.label || key,
    precio: formatMoney(plan.price || 0, plan.currency || settings.subscriptionCurrency || "ARS"),
    detalle: `${Number(plan.billingDays || 30)} dias`,
  }));
}

function buildBannerData(account, settings) {
  const access = resolveAccountAccess(account || {});
  const now = Date.now();
  const trialEndsAt = normalizeDateMs(account?.trialEndsAt) || (account?.estado === "trial" ? normalizeDateMs(account?.activoHasta) : null);
  const nextBillingAt = normalizeDateMs(account?.nextBillingAt) || (account?.estado === "activo" ? normalizeDateMs(account?.activoHasta) : null);
  const graceEndsAt = normalizeDateMs(account?.graceEndsAt);

  let tone = "blue";
  let titulo = "";
  let detalle = "";

  if (access.motivo === "trial" && trialEndsAt) {
    const daysLeft = Math.max(0, Math.ceil((trialEndsAt - now) / (24 * 60 * 60 * 1000)));
    if (daysLeft <= 5) {
      tone = "amber";
      titulo = `Tu prueba vence en ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`;
      detalle = "Podes seguir usando la app, pero conviene regularizar el plan antes del vencimiento.";
    }
  }

  if ((access.motivo === "vigente" || access.motivo === "activo") && nextBillingAt) {
    const daysLeft = Math.ceil((nextBillingAt - now) / (24 * 60 * 60 * 1000));
    if (daysLeft >= 0 && daysLeft <= 5) {
      tone = "amber";
      titulo = `Tu plan vence en ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}`;
      detalle = "Conviene renovar para evitar que la cuenta pase a gracia o suspension.";
    }
  }

  if ((access.motivo === "gracia" || access.motivo === "gracia_pago") && graceEndsAt) {
    const daysLeft = Math.max(0, Math.ceil((graceEndsAt - now) / (24 * 60 * 60 * 1000)));
    tone = "red";
    titulo = "Estas en periodo de gracia";
    detalle = `Te quedan ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"} para renovar antes de la suspension.`;
  }

  if (!titulo) return null;
  return {
    tone,
    titulo,
    detalle,
    price: settings.subscriptionPrice,
    key: [
      account?.uid || "anon",
      access.motivo || "",
      titulo,
      account?.activoHasta || account?.trialEndsAt || account?.nextBillingAt || account?.graceEndsAt || "",
    ].join("::"),
  };
}

function PantallaBloqueo({ account, settings }) {
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState("");

  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const tel = (config.telefonoTaller || "").replace(/\D/g, "");
  const waLink = tel ? `https://wa.me/54${tel}` : null;
  const userLabel = auth.currentUser?.email || auth.currentUser?.phoneNumber || "";
  const access = resolveAccountAccess(account || {});
  const plansUi = buildPlansForUi(settings);
  const vencioTs =
    normalizeDateMs(account?.trialEndsAt) ||
    normalizeDateMs(account?.nextBillingAt) ||
    normalizeDateMs(account?.graceEndsAt);
  const vencioStr = vencioTs
    ? new Date(vencioTs).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  const handlePagar = async (planKey) => {
    if (pagando) return;
    setPagando(true);
    setError("");
    try {
      const res = await fetch("/api/mp-create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: auth.currentUser.uid, plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error((data.detail || data.error || "Error al generar el link de pago"));
      window.location.href = data.url;
    } catch (e) {
      setError(e.message);
      setPagando(false);
    }
  };

  const motivoLabel =
    access.motivo === "trial_vencido"
      ? "Periodo de prueba vencido"
      : access.motivo === "plan_vencido"
        ? "Suscripcion vencida"
        : access.motivo === "suspendido"
          ? "Cuenta suspendida"
          : "Acceso no disponible";

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col items-center justify-center p-6">
      <div className="bg-[#151515] rounded-[2.5rem] border border-red-900/30 shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="bg-red-950/40 border-b border-red-900/30 p-8 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-2xl font-black text-red-400 uppercase tracking-tighter">Tu acceso esta suspendido</h2>
          <p className="text-red-400/60 text-[10px] font-bold uppercase tracking-widest mt-1">Johnny Blaze OS</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-slate-900 rounded-2xl p-4 text-center space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{motivoLabel}</p>
            {vencioStr && <p className="text-sm font-black text-slate-300">{vencioStr}</p>}
            {userLabel && <p className="text-[10px] text-slate-500 truncate">{userLabel}</p>}
          </div>

          <p className="text-slate-400 text-xs text-center leading-relaxed">
            Tus datos estan guardados y seguros.
            <br />
            Renovando el acceso los recuperas al instante.
          </p>

          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Elegi tu plan</p>
            {plansUi.map((plan) => (
              <button
                key={plan.key}
                onClick={() => handlePagar(plan.key)}
                disabled={pagando}
                className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 border border-slate-700 active:scale-[0.98] transition-all rounded-2xl p-4 disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="text-sm font-black text-white">{plan.label}</p>
                  <p className="text-[10px] text-slate-400 font-bold">{plan.detalle}</p>
                </div>
                <span className="text-blue-400 font-black text-sm">{pagando ? "..." : plan.precio}</span>
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-[10px] font-bold text-center">{error}</p>}

          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-green-900/30 border border-green-800/40 text-green-400 py-3 rounded-2xl font-black text-[10px] uppercase tracking-wide active:scale-95 transition-all"
            >
              <span>💬</span> Consultar por WhatsApp
            </a>
          )}

          <button
            onClick={() => auth.signOut()}
            className="w-full text-slate-600 hover:text-slate-400 transition-colors text-[10px] font-black uppercase tracking-widest py-2"
          >
            Cerrar sesion
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [estado, setEstado] = useState("loading");
  const [account, setAccount] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_ADMIN_SETTINGS);
  const [pagoToast, setPagoToast] = useState("");
  const autoBackupDone = useRef(false);
  const [dismissedBannerKey, setDismissedBannerKey] = useState("");

  const banner = useMemo(() => buildBannerData(account, settings), [account, settings]);

  useEffect(() => {
    const stored = window.localStorage.getItem(`jbos_banner_dismissed_${auth.currentUser?.uid || "anon"}`) || "";
    setDismissedBannerKey(stored);
  }, [account?.uid]);

  const hideBanner = banner && dismissedBannerKey === banner.key;

  const cerrarBanner = () => {
    if (!banner) return;
    const storageKey = `jbos_banner_dismissed_${auth.currentUser?.uid || "anon"}`;
    window.localStorage.setItem(storageKey, banner.key);
    setDismissedBannerKey(banner.key);
  };

  const abrirSuscripcion = () => {
    window.localStorage.setItem("jbos_config_tab", "sistema");
    window.dispatchEvent(new CustomEvent("jbos-open-config"));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pago = params.get("pago");
    if (!pago) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (pago === "ok") setPagoToast("Pago recibido. Estamos activando tu acceso.");
    if (pago === "error") setPagoToast("El pago no se completo. Intenta de nuevo.");
    if (pago === "pendiente") setPagoToast("El pago quedo pendiente de confirmacion.");
    setTimeout(() => setPagoToast(""), 5000);
  }, []);

  useEffect(() => {
    if (estado === "ok" && !autoBackupDone.current) {
      autoBackupDone.current = true;
      if (shouldAutoBackup()) exportBackup();
    }
  }, [estado]);

  useEffect(() => {
    let unsubAccount = null;
    let cancelled = false;

    const unsubAuth = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setEstado("login");
        setAccount(null);
        if (unsubAccount) unsubAccount();
        return;
      }

      try {
        await ensureAccountProfile();
      } catch (error) {
        console.error(error);
      }

      try {
        const remoteSettings = await leerAdminSettings();
        if (!cancelled) setSettings(remoteSettings);
      } catch (error) {
        console.error(error);
      }

      const ref = doc(db, "usuarios", u.uid);
      if (unsubAccount) unsubAccount();
      unsubAccount = onSnapshot(ref, async (snap) => {
        if (!snap.exists()) {
          setEstado("loading");
          return;
        }

        const data = { id: snap.id, ...snap.data() };
        setAccount(data);
        const access = resolveAccountAccess(data);
        setEstado(access.acceso ? "ok" : "bloqueado");
      });
    });

    return () => {
      cancelled = true;
      unsubAuth();
      if (unsubAccount) unsubAccount();
    };
  }, []);

  if (estado === "loading") {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white font-black uppercase text-[10px]">
        Verificando tu acceso...
      </div>
    );
  }

  if (estado === "login") return <LoginScreen />;
  if (estado === "bloqueado") return <PantallaBloqueo account={account} settings={settings} />;

  return (
    <>
      {banner && !hideBanner && (
        <div
          className={`fixed top-4 left-1/2 z-[210] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-3xl border px-5 py-4 shadow-2xl ${
            banner.tone === "red"
              ? "border-red-800 bg-red-950/95 text-red-50"
              : "border-amber-700 bg-amber-950/95 text-amber-50"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Estado de la suscripcion</p>
              <p className="mt-1 text-sm font-black">{banner.titulo}</p>
              <p className="mt-1 text-xs opacity-90">{banner.detalle}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={abrirSuscripcion}
                  className="rounded-2xl bg-white/15 px-3 py-2 text-[10px] font-black uppercase tracking-widest"
                >
                  Ver suscripcion
                </button>
              </div>
            </div>
            <button
              onClick={cerrarBanner}
              className="rounded-full bg-black/20 px-3 py-1 text-[11px] font-black uppercase tracking-widest"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      <TallerPanel />
      {pagoToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white text-black px-8 py-4 rounded-3xl font-black text-xs shadow-2xl z-[220]">
          {pagoToast}
        </div>
      )}
    </>
  );
}
