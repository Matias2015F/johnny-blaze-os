import React, { useEffect, useRef, useState } from "react";
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { shouldAutoBackup, exportBackup } from "./lib/backup.js";
import { DURACION_TRIAL } from "./services/accessService.js";
import { LS } from "./lib/storage.js";
import { CONFIG_DEFAULT } from "./lib/constants.js";

import TallerPanel from "./TallerPanel.jsx";
import LoginScreen from "./LoginScreen.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// PLANES visibles al usuario — deben coincidir en precio con api/mp-create-preference.js
// Modificar labels, precios y descripciones según tu oferta comercial.
// ─────────────────────────────────────────────────────────────────────────────
const PLANES_UI = [
  { key: "mensual",     label: "Mensual",     precio: "$5.000",  detalle: "30 días" },
  { key: "trimestral",  label: "Trimestral",  precio: "$12.000", detalle: "90 días · ahorrás $3.000" },
  { key: "anual",       label: "Anual",       precio: "$40.000", detalle: "365 días · ahorrás $20.000" },
];

function PantallaBloqueo({ snapData }) {
  const [pagando, setPagando] = useState(false);
  const [error, setError]     = useState("");

  const config     = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const tel        = (config.telefonoTaller || "").replace(/\D/g, "");
  const waLink     = tel ? `https://wa.me/54${tel}` : null;
  const vencioTs   = snapData?.trialFin || snapData?.activoHasta;
  const vencioStr  = vencioTs
    ? new Date(vencioTs).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
    : null;
  const userLabel  = auth.currentUser?.email || auth.currentUser?.phoneNumber || "";

  const handlePagar = async (planKey) => {
    if (pagando) return;
    setPagando(true);
    setError("");
    try {
      const res = await fetch("/api/mp-create-preference", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ uid: auth.currentUser.uid, plan: planKey }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "Error al generar el link de pago");
      // Redirige al checkout de Mercado Pago
      window.location.href = data.url;
    } catch (e) {
      setError(e.message);
      setPagando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col items-center justify-center p-6">
      <div className="bg-[#151515] rounded-[2.5rem] border border-red-900/30 shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-red-950/40 border-b border-red-900/30 p-8 text-center">
          <div className="text-5xl mb-3">🔒</div>
          <h2 className="text-2xl font-black text-red-400 uppercase tracking-tighter">Acceso Restringido</h2>
          <p className="text-red-400/60 text-[10px] font-bold uppercase tracking-widest mt-1">Johnny Blaze OS</p>
        </div>

        <div className="p-6 space-y-4">

          {/* Info vencimiento */}
          <div className="bg-slate-900 rounded-2xl p-4 text-center space-y-1">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
              {snapData?.estado === "trial" ? "Trial vencido" : "Suscripción vencida"}
            </p>
            {vencioStr && <p className="text-sm font-black text-slate-300">{vencioStr}</p>}
            {userLabel  && <p className="text-[10px] text-slate-500 truncate">{userLabel}</p>}
          </div>

          <p className="text-slate-400 text-xs text-center leading-relaxed">
            Tus datos están guardados y seguros.<br />
            Renovando el acceso los recuperás al instante.
          </p>

          {/* Planes */}
          <div className="space-y-2">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">Elegí tu plan</p>
            {PLANES_UI.map(plan => (
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

          {/* WhatsApp alternativo */}
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
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [estado, setEstado] = useState("loading");
  const [snapData, setSnapData] = useState(null);
  const [pagoToast, setPagoToast] = useState(""); // mensaje de retorno desde MP
  const autoBackupDone = useRef(false);

  // Detecta retorno desde Mercado Pago (?pago=ok|error|pendiente)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pago = params.get("pago");
    if (!pago) return;
    // Limpiar el parámetro de la URL sin recargar la página
    window.history.replaceState({}, "", window.location.pathname);
    if (pago === "ok")         setPagoToast("✅ Pago recibido — activando acceso...");
    if (pago === "error")      setPagoToast("❌ El pago no se completó. Intentá de nuevo.");
    if (pago === "pendiente")  setPagoToast("⏳ Pago pendiente de confirmación.");
    setTimeout(() => setPagoToast(""), 5000);
  }, []);

  useEffect(() => {
    if (estado === "ok" && !autoBackupDone.current) {
      autoBackupDone.current = true;
      if (shouldAutoBackup()) exportBackup();
    }
  }, [estado]);

  useEffect(() => {
    let unsubFirestore = null;

    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (!u) {
        setEstado("login");
        if (unsubFirestore) unsubFirestore();
        return;
      }

      const ref = doc(db, "usuarios", u.uid);

      unsubFirestore = onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
          const isPhone = u.providerData?.[0]?.providerId === "phone";
          const ahora = Date.now();
          setDoc(ref, {
            email: isPhone ? u.phoneNumber : u.email,
            estado: "trial",
            trialInicio: ahora,
            trialFin: ahora + DURACION_TRIAL,
            createdAt: ahora,
          });
          return;
        }

        const data = snap.data();
        const trialFin = Number(data.trialFin);
        const ahora = Date.now();

        setSnapData(data);

        if (data.estado === "activo") { setEstado("ok"); return; }
        if (!isNaN(trialFin) && trialFin > ahora) { setEstado("ok"); return; }
        setEstado("bloqueado");
      });
    });

    return () => { unsubAuth(); if (unsubFirestore) unsubFirestore(); };
  }, []);

  if (estado === "loading") {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white font-black uppercase text-[10px]">
        Iniciando sistema...
      </div>
    );
  }

  if (estado === "login") return <LoginScreen />;

  if (estado === "bloqueado") {
    return <PantallaBloqueo snapData={snapData} />;
  }

  return (
    <>
      <TallerPanel />
      {pagoToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-white text-black px-8 py-4 rounded-3xl font-black text-xs shadow-2xl z-[200]">
          {pagoToast}
        </div>
      )}
    </>
  );
}