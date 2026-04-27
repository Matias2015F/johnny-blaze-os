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

export default function App() {
  const [estado, setEstado] = useState("loading");
  const [snapData, setSnapData] = useState(null);
  const autoBackupDone = useRef(false);

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
    const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
    const tel = (config.telefonoTaller || "").replace(/\D/g, "");
    const waLink = tel ? `https://wa.me/54${tel}` : null;
    const vencioTs = snapData?.trialFin || snapData?.activoHasta;
    const vencioStr = vencioTs
      ? new Date(vencioTs).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" })
      : null;
    const userLabel = auth.currentUser?.email || auth.currentUser?.phoneNumber || "";

    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col items-center justify-center p-6">
        <div className="bg-[#151515] rounded-[2.5rem] border border-red-900/30 shadow-2xl w-full max-w-sm overflow-hidden">

          {/* Header rojo */}
          <div className="bg-red-950/40 border-b border-red-900/30 p-8 text-center">
            <div className="text-5xl mb-3">🔒</div>
            <h2 className="text-2xl font-black text-red-400 uppercase tracking-tighter">Acceso Restringido</h2>
            <p className="text-red-400/60 text-[10px] font-bold uppercase tracking-widest mt-1">Johnny Blaze OS</p>
          </div>

          {/* Cuerpo */}
          <div className="p-8 space-y-5">

            {/* Info vencimiento */}
            <div className="bg-slate-900 rounded-2xl p-4 space-y-1 text-center">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                {snapData?.estado === "trial" ? "Trial vencido" : "Suscripción vencida"}
              </p>
              {vencioStr && (
                <p className="text-sm font-black text-slate-300">{vencioStr}</p>
              )}
              {userLabel && (
                <p className="text-[10px] text-slate-500 truncate">{userLabel}</p>
              )}
            </div>

            <p className="text-slate-400 text-xs text-center leading-relaxed">
              Tus datos están guardados y seguros.<br />
              Renovando el acceso los recuperás al instante.
            </p>

            {/* Botón principal: contacto WhatsApp */}
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-500 active:scale-95 transition-all text-white py-5 rounded-2xl font-black text-sm uppercase tracking-wide"
              >
                <span className="text-xl">💬</span> Contactar para renovar
              </a>
            ) : (
              <div className="bg-slate-800 rounded-2xl p-4 text-center">
                <p className="text-[10px] text-slate-400 font-bold">Contactá al administrador para renovar el acceso</p>
              </div>
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

  return <TallerPanel />;
}