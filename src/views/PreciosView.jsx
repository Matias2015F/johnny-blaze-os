import React, { useState, useMemo } from 'react';
import { LS, useCollection } from '../lib/storage.js';

const MOCK_INICIAL = [
  { tarea: "AJUSTE DE VÁLVULAS", precio: 7000, cilindrada: 110 },
  { tarea: "AJUSTE DE VÁLVULAS", precio: 8500, cilindrada: 150 },
  { tarea: "AJUSTE DE VÁLVULAS", precio: 9000, cilindrada: 150 },
  { tarea: "AJUSTE DE VÁLVULAS", precio: 12000, cilindrada: 250 },
  { tarea: "AJUSTE DE VÁLVULAS", precio: 25000, cilindrada: 600 },
  { tarea: "CAMBIO DE PASTILLAS", precio: 5000, cilindrada: 125 },
  { tarea: "CAMBIO DE PASTILLAS", precio: 5500, cilindrada: 150 },
  { tarea: "CAMBIO DE PASTILLAS", precio: 12000, cilindrada: 600 },
  { tarea: "LIMPIEZA DE CARBURADOR", precio: 10000, cilindrada: 110 },
  { tarea: "LIMPIEZA DE CARBURADOR", precio: 14000, cilindrada: 150 },
  { tarea: "CAMBIO DE TRANSMISIÓN", precio: 8000, cilindrada: 150 },
  { tarea: "CAMBIO DE TRANSMISIÓN", precio: 15000, cilindrada: 300 },
  { tarea: "SERVICE GENERAL", precio: 15000, cilindrada: 150 },
  { tarea: "SERVICE GENERAL", precio: 18000, cilindrada: 250 },
  { tarea: "SERVICE GENERAL", precio: 35000, cilindrada: 600 },
];

if (LS.getAll("precioHistorial").length === 0) {
  MOCK_INICIAL.forEach(d => LS.addDoc("precioHistorial", d));
}

export default function PreciosView({ setView }) {
  const historial = useCollection("precioHistorial");
  const [busqueda, setBusqueda] = useState("");
  const [ccFiltro, setCcFiltro] = useState(150);
  const [mostrandoForm, setMostrandoForm] = useState(false);
  const [form, setForm] = useState({ id: null, tarea: "", precio: "", cilindrada: "" });

  const handleGuardar = (e) => {
    e.preventDefault();
    const data = {
      tarea: form.tarea.toUpperCase(),
      precio: Number(form.precio),
      cilindrada: Number(form.cilindrada),
    };
    if (form.id) {
      LS.updateDoc("precioHistorial", form.id, data);
    } else {
      LS.addDoc("precioHistorial", data);
    }
    setForm({ id: null, tarea: "", precio: "", cilindrada: "" });
    setMostrandoForm(false);
  };

  const sugerencias = useMemo(() => {
    const unicas = [...new Set(historial.map(h => h.tarea))];
    if (!busqueda) return unicas.slice(0, 5);
    return unicas
      .filter(t => t.includes(busqueda.toUpperCase()) && t !== busqueda.toUpperCase())
      .slice(0, 5);
  }, [busqueda, historial]);

  const { stats, filtrados } = useMemo(() => {
    if (busqueda.length < 2) return { stats: null, filtrados: [] };
    const match = historial.filter(h => h.tarea.includes(busqueda.toUpperCase()));
    if (!match.length) return { stats: null, filtrados: [] };
    const precios = match.map(h => h.precio);
    const matchCC = match.filter(h => Math.abs(h.cilindrada - ccFiltro) <= 50);
    return {
      filtrados: match,
      stats: {
        min: Math.min(...precios),
        max: Math.max(...precios),
        avgCC: matchCC.length
          ? Math.round(matchCC.reduce((a, b) => a + b.precio, 0) / matchCC.length)
          : null,
        count: match.length,
      },
    };
  }, [busqueda, ccFiltro, historial]);

  return (
    <div className="text-white font-sans p-4 max-w-md mx-auto pb-32">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-none">Precios</h1>
          <p className="text-blue-500 text-[10px] font-bold tracking-[0.3em] uppercase">Memoria Técnica</p>
        </div>
        <button
          onClick={() => { setForm({ id: null, tarea: busqueda, precio: "", cilindrada: ccFiltro }); setMostrandoForm(true); }}
          className="bg-blue-500 hover:bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/40 transition-transform active:scale-90"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      </div>

      {/* BÚSQUEDA */}
      <div className="space-y-4 mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="ESCRIBÍ LA TAREA..."
            className="w-full bg-gray-800 border-2 border-gray-700 rounded-2xl p-5 text-lg font-black uppercase focus:border-blue-500 outline-none transition-all placeholder:text-gray-700"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button onClick={() => setBusqueda("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        {sugerencias.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sugerencias.map((s, i) => (
              <button key={i} onClick={() => setBusqueda(s)}
                className="bg-gray-800 border border-gray-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight hover:border-blue-500 active:bg-blue-500 active:text-white transition-all text-gray-400">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CILINDRADA */}
      <div className="mb-8">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3 ml-1">Cilindrada (CC)</p>
        <div className="grid grid-cols-4 gap-2">
          {[110, 150, 250, 600].map(cc => (
            <button key={cc} onClick={() => setCcFiltro(cc)}
              className={`py-3 rounded-xl font-black text-sm border-2 transition-all ${ccFiltro === cc ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-900/20' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
              {cc}
            </button>
          ))}
        </div>
        <input type="number" placeholder="OTRA CC..."
          className="w-full mt-3 bg-gray-900 border-b border-gray-800 p-2 text-center text-xs font-bold focus:border-blue-500 outline-none text-gray-500"
          onChange={e => setCcFiltro(Number(e.target.value))}
        />
      </div>

      {/* RESULTADO */}
      {stats ? (
        <div className="space-y-4">
          <div className="bg-blue-500 rounded-3xl p-6 shadow-2xl shadow-blue-900/40">
            <p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] mb-1">Sugerencia para {ccFiltro}cc</p>
            <h2 className="text-5xl font-black tracking-tighter italic">
              {stats.avgCC ? `$${stats.avgCC.toLocaleString()}` : "---"}
            </h2>
            <p className="text-[10px] font-bold text-blue-100 mt-2 opacity-80 uppercase italic">Memoria del taller activa</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Mínimo Cobrado</p>
              <p className="text-xl font-black text-green-500">${stats.min.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-2xl p-4 border border-gray-700">
              <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Máximo Cobrado</p>
              <p className="text-xl font-black text-red-500">${stats.max.toLocaleString()}</p>
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-4 px-2">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Desglose</p>
              <span className="text-[10px] font-bold text-blue-500">{stats.count} Trabajos</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {[...filtrados].sort((a, b) => b.precio - a.precio).map(f => (
                <div key={f.id} className="bg-gray-800/40 p-3 rounded-xl border border-gray-700/50 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className={`text-[8px] font-black px-1 rounded uppercase italic leading-none w-fit ${Math.abs(f.cilindrada - ccFiltro) <= 50 ? 'bg-blue-500/20 text-blue-500' : 'bg-gray-700 text-gray-500'}`}>
                      {f.cilindrada} CC
                    </span>
                    <span className="text-xs font-bold text-white uppercase mt-1">{f.tarea}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black">${f.precio.toLocaleString()}</span>
                    <button onClick={() => { setForm(f); setMostrandoForm(true); }} className="text-gray-700 hover:text-blue-500">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gray-800/30 border-2 border-dashed border-gray-800 rounded-3xl p-16 text-center">
          <p className="text-gray-700 text-[10px] font-black uppercase italic tracking-widest leading-relaxed">
            {busqueda ? "Sin registros para esta tarea" : "Consultá el historial técnico"}
          </p>
        </div>
      )}

      {/* MODAL CARGA */}
      {mostrandoForm && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleGuardar} className="bg-gray-800 w-full max-w-sm rounded-3xl p-6 border border-gray-700 shadow-2xl space-y-5">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-black italic uppercase tracking-tighter">Cargar Tarea</h3>
              <button type="button" onClick={() => setMostrandoForm(false)} className="bg-gray-700 text-white w-8 h-8 rounded-full flex items-center justify-center">×</button>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="TAREA" required
                className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 font-black uppercase outline-none focus:border-blue-500"
                value={form.tarea} onChange={e => setForm({ ...form, tarea: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="PRECIO $" required
                  className="bg-gray-900 border border-gray-700 rounded-xl p-4 font-black outline-none focus:border-blue-500"
                  value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })}
                />
                <input type="number" placeholder="CC" required
                  className="bg-gray-900 border border-gray-700 rounded-xl p-4 font-black outline-none focus:border-blue-500"
                  value={form.cilindrada} onChange={e => setForm({ ...form, cilindrada: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" className="w-full bg-blue-500 py-5 rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg active:scale-95 transition-all text-sm">
              {form.id ? "Guardar Cambios" : "Sumar al Historial"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
