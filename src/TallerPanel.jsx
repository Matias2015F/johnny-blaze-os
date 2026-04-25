import React, { useState, useEffect } from "react";
import { auth, db } from "./firebase.js";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Wrench, Clock, Settings } from "lucide-react";

import { useCollection } from "./lib/storage.js";
import HomeView from "./views/HomeView.jsx";
import OrderListView from "./views/OrderListView.jsx";
import NewOrderView from "./views/NewOrderView.jsx";
import ConfigView from "./views/ConfigView.jsx";
import OrderDetailView from "./components/OrderDetailView.jsx";

export default function TallerPanel() {
  const [view, setView] = useState("home");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [config, setConfig] = useState(null);

  const bikes = useCollection("motos");
  const orders = useCollection("ordenes");
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "usuarios", uid);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists() && snap.data().config) {
        setConfig(snap.data().config);
        console.log("✅ Sincronización Johnny Blaze activa");
      }
    });
    return () => unsub();
  }, [uid]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { if (u) setView("home"); });
    return () => unsub();
  }, []);

  const showToast = (msg) => { setToastMessage(msg); setTimeout(() => setToastMessage(null), 2500); };
  const handleLogout = async () => { try { await signOut(auth); } catch (e) { console.error(e); } };
  const stats = { activas: orders.filter(o => o.estado !== "entregada").length };

  const renderView = () => {
    switch (view) {
      case "home":      return <HomeView stats={stats} setView={setView} bikes={bikes} handleLogout={handleLogout} />;
      case "ordenes":   return <OrderListView orders={orders} setView={setView} setSelectedOrder={setSelectedOrder} />;
      case "nuevaOrden":return <NewOrderView setView={setView} showToast={showToast} />;
      case "detalle":   return <OrderDetailView order={selectedOrder} setView={setView} showToast={showToast} configGlobal={config} />;
      case "config":    return <ConfigView setView={setView} showToast={showToast} configGlobal={config} />;
      default:          return <HomeView stats={stats} setView={setView} bikes={bikes} handleLogout={handleLogout} />;
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#0A0A0A] relative text-left selection:bg-orange-500 overflow-x-hidden pb-20">
      {renderView()}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-black/95 backdrop-blur-3xl border-t border-white/10 p-5 flex justify-around items-center z-50 rounded-t-[3rem] shadow-2xl">
        <button onClick={() => setView("home")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "home" ? "text-orange-500 scale-110" : "text-slate-500"}`}>
          <Wrench size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Taller</span>
        </button>
        <button onClick={() => setView("ordenes")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "ordenes" || view === "detalle" ? "text-orange-500 scale-110" : "text-slate-500"}`}>
          <Clock size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Trabajos</span>
        </button>
        <button onClick={() => setView("config")} className={`flex flex-col items-center gap-1.5 transition-all ${view === "config" ? "text-orange-500 scale-110" : "text-slate-500"}`}>
          <Settings size={26} /><span className="text-[10px] font-black uppercase tracking-widest">Ajustes</span>
        </button>
      </nav>
      {toastMessage && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 bg-white text-black px-10 py-5 rounded-3xl font-black text-xs uppercase shadow-2xl z-[100] animate-bounce border-2 border-orange-500">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
