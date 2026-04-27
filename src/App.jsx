import React, { useEffect, useRef, useState } from "react";
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { shouldAutoBackup, exportBackup } from "./lib/backup.js";

import TallerPanel from "./TallerPanel.jsx";
import LoginScreen from "./LoginScreen.jsx";

export default function App() {
  const [estado, setEstado] = useState("loading");
  // loading | login | ok | bloqueado
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
      // 🔴 NO LOGUEADO
      if (!u) {
        setEstado("login");
        if (unsubFirestore) unsubFirestore();
        return;
      }

      const ref = doc(db, "usuarios", u.uid);

      // 🔥 TIEMPO REAL (soluciona todo)
      unsubFirestore = onSnapshot(ref, (snap) => {

        // ⏳ todavía no existe (usuario recién creado)
        if (!snap.exists()) {
          console.log("⏳ Esperando documento en Firestore...");
          return; // NO bloquea
        }

        const data = snap.data();
        const trialFin = Number(data.trialFin);
        const ahora = Date.now();

        console.log("--- EVALUACIÓN ---");

        // 🟢 USUARIO ACTIVO
        if (data.estado === "activo") {
          setEstado("ok");
          return;
        }

        // 🟡 TRIAL
        if (!isNaN(trialFin) && trialFin > ahora) {
          setEstado("ok");
          return;
        }

        // 🔴 BLOQUEADO
        setEstado("bloqueado");
      });
    });

    return () => {
      unsubAuth();
      if (unsubFirestore) unsubFirestore();
    };
  }, []);

  // --- RENDERS ---

  if (estado === "loading") {
    return (
      <div className="min-h-screen bg-[#0b0b0b] flex items-center justify-center text-white font-black uppercase text-[10px]">
        Iniciando sistema...
      </div>
    );
  }

  if (estado === "login") {
    return <LoginScreen />;
  }

  if (estado === "bloqueado") {
    return (
      <div className="min-h-screen bg-[#0b0b0b] text-white flex flex-col items-center justify-center p-10 text-center">
        <div className="bg-[#151515] p-10 rounded-[2.5rem] border border-red-900/30 shadow-2xl max-w-sm">
          <h2 className="text-3xl font-black text-red-500 mb-4 uppercase">
            Acceso Restringido
          </h2>

          <p className="text-slate-400 text-sm mb-8">
            Tu trial venció o no tenés una suscripción activa.
          </p>

          <button
            onClick={() => auth.signOut()}
            className="text-slate-500 text-xs uppercase"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return <TallerPanel />;
}