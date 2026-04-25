import React from "react";
import { PlusCircle, Clock, History, LogOut } from "lucide-react";
import { auth } from "../firebase.js";

export default function HomeView({ stats, setView, bikes, loadDemoData, clearAllData, handleLogout }) {
  return (
    <div className="p-4 space-y-5 pb-28 text-left animate-in fade-in duration-500">
      <header className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <button onClick={handleLogout} className="absolute top-5 right-5 p-3 bg-white/10 rounded-2xl text-orange-500 active:scale-90 transition-all z-20">
          <LogOut size={18} />
        </button>
        <div className="relative z-10 text-left font-bold">
          <p className="text-orange-500 font-black text-xs uppercase tracking-[0.4em] mb-1">Taller OS</p>
          <h1 className="text-4xl font-black text-white tracking-tighter leading-none mb-1">JOHNNY BLAZE</h1>
          <p className="text-[10px] text-slate-400 font-normal mb-5">{auth.currentUser?.email}</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["Activas", stats.activas, "text-orange-500"],
              ["Hoy", stats.hoy, "text-blue-400"],
              ["Motos", bikes.length, "text-green-400"],
            ].map(([l, v, c]) => (
              <div key={l} className="bg-black/40 border border-white/5 p-3 rounded-2xl text-center">
                <div className={`text-2xl font-black ${c}`}>{v}</div>
                <div className="text-[10px] uppercase font-bold text-slate-300 tracking-wider">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <button onClick={() => setView("nuevaOrden")} className="w-full bg-orange-600 text-white p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl active:scale-[0.98] transition-all">
        <div className="flex items-center gap-5 text-left font-bold">
          <div className="bg-white/20 p-4 rounded-3xl"><PlusCircle size={32} /></div>
          <div>
            <p className="text-2xl font-black uppercase tracking-tighter leading-none mb-1">Nuevo Ingreso</p>
            <p className="text-xs font-bold uppercase tracking-widest text-white/80">Ingresar moto al taller</p>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-4 font-bold">
        <button onClick={() => setView("ordenes")} className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex flex-col gap-3 shadow-sm active:scale-95 transition-all text-left">
          <Clock className="text-blue-600" size={24} />
          <span className="font-black uppercase text-xs tracking-widest text-slate-900">Trabajos</span>
        </button>
        <button onClick={() => setView("historial")} className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex flex-col gap-3 shadow-sm active:scale-95 transition-all text-left">
          <History className="text-orange-600" size={24} />
          <span className="font-black uppercase text-xs tracking-widest text-slate-900">Historial</span>
        </button>
      </div>

      <div className="flex gap-2 pt-2">
        <button onClick={loadDemoData} className="flex-1 bg-slate-800 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all">Cargar Demo</button>
        <button onClick={clearAllData} className="flex-1 bg-red-900/10 text-red-500 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-900/20 active:scale-95 transition-all">Borrar Todo</button>
      </div>
    </div>
  );
}
