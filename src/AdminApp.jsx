import React, { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { LogOut, Shield } from "lucide-react";
import { auth } from "./firebase.js";
import LoginScreen from "./LoginScreen.jsx";
import { PantallaAdmin } from "./views/AdminPanelView.jsx";

function AdminLoadingScreen() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="text-center space-y-2">
        <Shield size={32} className="text-orange-500 mx-auto" />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
          Admin MotoGestión
        </p>
        <p className="text-[10px] font-bold text-zinc-600">Verificando acceso...</p>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed inset-x-0 bottom-5 z-[260] flex justify-center px-4 pointer-events-none">
      <div className="w-full max-w-sm rounded-3xl bg-white px-5 py-4 text-center text-xs font-black leading-relaxed text-black shadow-2xl">
        {message}
      </div>
    </div>
  );
}

export default function AdminApp() {
  const [status, setStatus] = useState("loading");
  const [toast, setToast] = useState("");
  const scrollRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setStatus(user ? "ready" : "login");
    });
    return () => unsub();
  }, []);

  const showToast = (message) => {
    setToast(String(message || ""));
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(""), 3500);
  };

  if (status === "loading") return <AdminLoadingScreen />;
  if (status === "login") return <LoginScreen />;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-zinc-950/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Shield size={16} className="text-orange-500 shrink-0" />
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-orange-500">
                admin.motogestion.ar
              </p>
            </div>
            <h1 className="mt-0.5 truncate text-xl font-black uppercase tracking-tight">
              Panel de plataforma
            </h1>
            <p className="truncate text-[11px] font-bold text-zinc-500">
              {auth.currentUser?.email || "Administrador"}
            </p>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-zinc-300 transition-all active:scale-95"
          >
            <LogOut size={14} />
            Salir
          </button>
        </div>
      </header>

      <main ref={scrollRef} className="mx-auto max-w-6xl px-4 py-5 pb-20">
        <PantallaAdmin showToast={showToast} scrollRef={scrollRef} />
      </main>

      <Toast message={toast} />
    </div>
  );
}
