import React from "react";
import { auth } from "../firebase.js";
import { PlusCircle, Clock, ChevronRight, LogOut, Settings } from "lucide-react";

export default function HomeView({ stats, setView, bikes, handleLogout }) {
  return (
    <div className="p-4 space-y-5 pb-28 text-left animate-in fade-in duration-500">
      <header className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-left">
        <button onClick={handleLogout} className="absolute top-4 right-4 p-4 bg-white/10 rounded-2xl text-orange-500 active:scale-90 transition-all z-50">
          <LogOut size={20} />
        </button>
        <div className="relative z-10 text-left font-bold">
          <p className="text-orange-500 font-black text-[10px] uppercase tracking-[0.4em] mb-2">Taller OS</p>
          <h1 className="text-4xl font-black text-white tracking-tighter leading-none mb-2 italic uppercase">Johnny Blaze</h1>
          <p className="text-[10px] text-slate-400 mb-6 font-normal">{auth.currentUser?.email}</p>
          <div className="flex gap-4">
            <div className="text-left border-l-2 border-orange-500 pl-3">
              <div className="text-2xl font-black text-white leading-none">{stats.activas}</div>
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Activas</div>
            </div>
            <div className="text-left border-l-2 border-blue-500 pl-3">
              <div className="text-2xl font-black text-white leading-none">{bikes.length}</div>
              <div className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Motos</div>
            </div>
          </div>
        </div>
      </header>

      <button onClick={() => setView("nuevaOrden")} className="w-full bg-orange-600 text-white p-8 rounded-[2.5rem] flex items-center justify-between shadow-xl active:scale-[0.98] transition-all">
        <div className="flex items-center gap-5 text-left font-bold">
          <div className="bg-white/20 p-4 rounded-3xl"><PlusCircle size={32} /></div>
          <div>
            <p className="text-2xl font-black uppercase tracking-tighter leading-none mb-1 text-left">Nuevo Ingreso</p>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">Ingresar moto al taller</p>
          </div>
        </div>
        <ChevronRight size={28} />
      </button>

      <div className="grid grid-cols-2 gap-4">
        <button onClick={() => setView("ordenes")} className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex flex-col gap-3 shadow-sm active:scale-95 transition-all text-left">
          <Clock className="text-blue-600" size={24} />
          <span className="font-black uppercase text-[10px] tracking-widest text-slate-900 text-left">Trabajos</span>
        </button>
        <button onClick={() => setView("config")} className="bg-white p-6 rounded-3xl border-2 border-slate-100 flex flex-col gap-3 shadow-sm active:scale-95 transition-all text-left">
          <Settings className="text-orange-600" size={24} />
          <span className="font-black uppercase text-[10px] tracking-widest text-slate-900 text-left">Ajustes</span>
        </button>
      </div>
    </div>
  );
}
