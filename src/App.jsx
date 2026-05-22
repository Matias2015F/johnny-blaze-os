import React, { useEffect, useMemo, useRef, useState } from "react";
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { shouldAutoBackup, exportBackup } from "./lib/backup.js";
import { DEFAULT_ADMIN_SETTINGS, ensureAccountProfile } from "./lib/telemetry.js";
import { leerAdminSettings, normalizeDateMs, resolveAccountAccess } from "./services/accessService.js";
import { LS } from "./lib/storage.js";
import { CONFIG_DEFAULT } from "./lib/constants.js";
import { abrirEnlaceExterno } from "./lib/whatsappService.js";

import TallerPanel from "./TallerPanel.jsx";
import LoginScreen from "./LoginScreen.jsx";

function formatMoney(value) {
  return "ARS " + new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function buildPlansForUi(settings = DEFAULT_ADMIN_SETTINGS) {
  const plans = settings.plans || DEFAULT_ADMIN_SETTINGS.plans || {};
  return Object.entries(plans).map(([key, plan]) => ({
    key,
    label: plan.label || key,
    precio: formatMoney(plan.price || 0),
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
    const horasLeft = Math.max(0, Math.ceil((graceEndsAt - now) / (60 * 60 * 1000)));
    const tiempoStr = horasLeft <= 24
      ? `${horasLeft} ${horasLeft === 1 ? "hora" : "horas"}`
      : `${Math.ceil(horasLeft / 24)} dias`;
    tone = "amber";
    titulo = "Periodo de gracia activo";
    detalle = `Tenes ${tiempoStr} de acceso completo para regularizar tu suscripcion.`;
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

function PagoOkSheet({ account, onClose }) {
  const activoHasta = normalizeDateMs(account?.activoHasta);
  const fechaStr = activoHasta
    ? new Date(activoHasta).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    : null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full rounded-t-[2rem] bg-zinc-900 border-t border-zinc-700 shadow-2xl animate-in slide-in-from-bottom duration-300">
        <div className="mx-auto max-w-[440px] p-6 space-y-5">
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <span className="text-emerald-400 font-black text-2xl">✓</span>
            </div>
            <div>
              <h3 className="text-base font-black text-white uppercase tracking-tight">Pago recibido</h3>
              {fechaStr ? (
                <p className="text-sm text-zinc-300 mt-1">
                  Tu cuenta esta activa hasta el{" "}
                  <span className="text-emerald-400 font-black">{fechaStr}</span>
                </p>
              ) : (
                <p className="text-sm text-zinc-400 mt-1">
                  Estamos activando tu acceso. En unos segundos todo queda habilitado.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
          >
            Entrar al taller
          </button>
        </div>
      </div>
    </div>
  );
}

function PantallaBloqueo({ account, settings }) {
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState("");

  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const tel = (config.telefonoTaller || "").replace(/\D/g, "");
  const waLink = tel ? `https://wa.me/${tel.startsWith("549") ? tel : tel.startsWith("54") ? "549" + tel.slice(2) : "549" + tel}` : null;
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
      const idToken = await auth.currentUser.getIdToken();
      const res = await fetch("/api/mp-create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ uid: auth.currentUser.uid, plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.mpError || data.detail || data.error || "Error al generar el link de pago");
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
          <p className="text-red-400/60 text-[10px] font-bold uppercase tracking-widest mt-1">Moto Gestión</p>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-zinc-900 rounded-2xl p-4 text-center space-y-1">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{motivoLabel}</p>
            {vencioStr && <p className="text-sm font-black text-zinc-300">{vencioStr}</p>}
            {userLabel && <p className="text-[10px] text-zinc-500 truncate">{userLabel}</p>}
          </div>

          <p className="text-zinc-400 text-xs text-center leading-relaxed">
            Tus datos estan guardados y seguros.
            <br />
            Renovando el acceso los recuperas al instante.
          </p>

          <div className="space-y-2">
            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest text-center">Elegi tu plan</p>
            {plansUi.map((plan) => (
              <button
                key={plan.key}
                onClick={() => handlePagar(plan.key)}
                disabled={pagando}
                className="w-full flex items-center justify-between bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 active:scale-[0.98] transition-all rounded-2xl p-4 disabled:opacity-50"
              >
                <div className="text-left">
                  <p className="text-sm font-black text-white">{plan.label}</p>
                  <p className="text-[10px] text-zinc-400 font-bold">{plan.detalle}</p>
                </div>
                <span className="text-orange-400 font-black text-sm">{pagando ? "..." : plan.precio}</span>
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-[10px] font-bold text-center">{error}</p>}

          {waLink && (
            <a
              href={waLink}
              rel="noreferrer"
              onClick={(e) => {
                e.preventDefault();
                abrirEnlaceExterno(waLink);
              }}
              className="w-full flex items-center justify-center gap-2 bg-green-900/30 border border-green-800/40 text-green-400 py-3 rounded-2xl font-black text-[10px] uppercase tracking-wide active:scale-95 transition-all"
            >
              <span>💬</span> Consultar por WhatsApp
            </a>
          )}

          <button
            onClick={() => auth.signOut()}
            className="w-full text-zinc-600 hover:text-zinc-400 transition-colors text-[10px] font-black uppercase tracking-widest py-2"
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
  const [pagoResult, setPagoResult] = useState(null);
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
    setPagoResult(pago);
    if (pago !== "ok") setTimeout(() => setPagoResult(null), 5000);
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
        setEstado(access.acceso === true ? "ok" : access.acceso === "lectura" ? "lectura" : "bloqueado");
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

  const modoLectura = estado === "lectura";

  return (
    <>
      {modoLectura && (
        <div className="fixed bottom-[64px] left-0 right-0 z-[180] px-4">
          <div className="mx-auto max-w-[440px] rounded-2xl bg-red-950/95 border border-red-800/50 px-4 py-3 flex items-center justify-between gap-3 backdrop-blur shadow-xl">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-red-300">Plan vencido — Modo lectura</p>
              <p className="text-[9px] text-red-400/60 mt-0.5">No podes crear nuevas ordenes</p>
            </div>
            <button
              onClick={abrirSuscripcion}
              className="shrink-0 rounded-xl bg-red-600 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white active:scale-95 transition-all"
            >
              Renovar
            </button>
          </div>
        </div>
      )}

      {!modoLectura && banner && !hideBanner && (
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

      <TallerPanel modoLectura={modoLectura} />

      {pagoResult === "ok" && (
        <PagoOkSheet account={account} onClose={() => setPagoResult(null)} />
      )}
      {pagoResult && pagoResult !== "ok" && (
        <div className="fixed inset-x-0 bottom-[calc(2.5rem+env(safe-area-inset-bottom))] z-[220] flex justify-center px-4 pointer-events-none">
          <div className="w-full max-w-sm rounded-3xl bg-white px-5 py-4 text-center text-xs font-black leading-relaxed text-black shadow-2xl break-words">
            {pagoResult === "error" ? "El pago no se completo. Intenta de nuevo." : "El pago quedo pendiente de confirmacion."}
          </div>
        </div>
      )}
    </>
  );
}
