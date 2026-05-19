import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, Info, Mic, MicOff } from "lucide-react";

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

function normalizar(value = "") {
  return String(value).trim().toUpperCase();
}

export default function NewOrderView({ handleCreateAll, setView, prefill, bikes = [], clients = [] }) {
  const [f, setF] = useState({
    nombre: prefill?.client?.nombre || "",
    tel: prefill?.client?.tel || "",
    patente: prefill?.bike?.patente || "",
    marca: prefill?.bike?.marca || "",
    modelo: prefill?.bike?.modelo || "",
    cilindrada: prefill?.bike?.cilindrada || 110,
    km: prefill?.bike?.km || "",
    falla: "",
  });
  const [ignorarSugerencia, setIgnorarSugerencia] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const reconRef = useRef(null);

  const toggleDictado = () => {
    if (!SpeechRecognitionAPI) return;
    if (escuchando) {
      reconRef.current?.stop();
      return;
    }
    const rec = new SpeechRecognitionAPI();
    rec.lang = "es-AR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const texto = e.results[0][0].transcript;
      setF((prev) => ({ ...prev, falla: prev.falla ? prev.falla + " " + texto : texto }));
    };
    rec.onend = () => setEscuchando(false);
    rec.onerror = () => setEscuchando(false);
    reconRef.current = rec;
    rec.start();
    setEscuchando(true);
  };

  // Autocomplete: detecta moto conocida apenas se escribe la patente
  const coincidenciaMoto = useMemo(() => {
    if (prefill) return null;
    const patente = normalizar(f.patente);
    if (patente.length < 3) return null;
    const moto = bikes.find((b) => normalizar(b.patenteNormalizada || b.patente) === patente);
    if (!moto) return null;
    const cliente = clients.find((c) => c.id === moto.clienteId) || null;
    return { moto, cliente };
  }, [bikes, clients, f.patente, prefill]);

  const usarHistorial = () => {
    if (!coincidenciaMoto) return;
    setF((actual) => ({
      ...actual,
      marca: coincidenciaMoto.moto?.marca || actual.marca,
      modelo: coincidenciaMoto.moto?.modelo || actual.modelo,
      cilindrada: coincidenciaMoto.moto?.cilindrada || actual.cilindrada,
      nombre: coincidenciaMoto.cliente?.nombre || actual.nombre,
      tel: coincidenciaMoto.cliente?.tel || coincidenciaMoto.cliente?.telefono || actual.tel,
      km: actual.km || coincidenciaMoto.moto?.kilometrajeActual || coincidenciaMoto.moto?.km || "",
    }));
    setIgnorarSugerencia(false);
  };

  return (
    <div className="p-6 text-left animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView(prefill ? "historial" : "home")} className="p-3 bg-zinc-900 rounded-2xl border border-white/5 text-white active:scale-90 transition-all">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase">
          {prefill ? "Nuevo Service" : "Nuevo Ingreso"}
        </h1>
      </div>
      <div className="bg-[#141414] p-8 rounded-[2.5rem] space-y-4 border border-white/5 shadow-2xl">
        {coincidenciaMoto && !ignorarSugerencia && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-[2rem] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="bg-orange-500 text-white p-2 rounded-xl flex-shrink-0">
                <Info size={16} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Moto encontrada en el historial</p>
                <p className="mt-1 text-sm font-black text-white uppercase">
                  {coincidenciaMoto.moto?.patente} · {coincidenciaMoto.moto?.marca} {coincidenciaMoto.moto?.modelo}
                </p>
                <p className="mt-1 text-[10px] font-bold text-zinc-400">
                  Cliente guardado: {coincidenciaMoto.cliente?.nombre || "Sin cliente"} · {coincidenciaMoto.cliente?.tel || coincidenciaMoto.cliente?.telefono || "---"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={usarHistorial}
                className="bg-orange-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95"
              >
                Usar historial
              </button>
              <button
                onClick={() => setIgnorarSugerencia(true)}
                className="bg-zinc-900 border border-white/10 text-zinc-300 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95"
              >
                Seguir con lo escrito
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Patente</label>
            <input
              className="w-full border rounded-2xl p-4 font-black uppercase outline-none bg-zinc-900 text-white border-white/5 focus:border-orange-600"
              value={f.patente}
              onChange={(e) => setF({ ...f, patente: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Km Actual</label>
            <input
              className="w-full border border-white/5 rounded-2xl p-4 font-black text-white outline-none focus:border-orange-600 bg-zinc-900"
              type="text"
              inputMode="numeric"
              value={f.km}
              onChange={(e) => setF({ ...f, km: e.target.value.replace(/\D/g, "") })}
              placeholder="Ej: 15400"
            />
          </div>
        </div>
        {!prefill && (
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Marca</label>
              <input className="w-full border border-white/5 bg-zinc-900 rounded-2xl p-4 font-black text-white outline-none focus:border-orange-600 text-sm" value={f.marca} onChange={(e) => setF({ ...f, marca: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Modelo</label>
              <input className="w-full border border-white/5 bg-zinc-900 rounded-2xl p-4 font-black text-white outline-none focus:border-orange-600 text-sm" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Cilindrada</label>
              <input className="w-full border border-white/5 bg-zinc-900 rounded-2xl p-4 font-black text-white outline-none focus:border-orange-600 text-sm" type="text" inputMode="numeric" placeholder="Ej: 250" value={f.cilindrada} onChange={(e) => setF({ ...f, cilindrada: e.target.value.replace(/\D/g, "") })} />
            </div>
          </div>
        )}
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Cliente</label>
          <input
            className="w-full border rounded-2xl p-4 font-black outline-none bg-zinc-900 text-white border-white/5 focus:border-orange-600"
            placeholder="Nombre completo"
            value={f.nombre}
            onChange={(e) => setF({ ...f, nombre: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Teléfono</label>
          <input
            className="w-full border rounded-2xl p-4 font-black outline-none bg-zinc-900 text-white border-white/5 focus:border-orange-600"
            placeholder="Ej: 3434123456"
            value={f.tel}
            onChange={(e) => setF({ ...f, tel: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between ml-2 mr-1">
            <label className="text-[10px] font-black uppercase text-zinc-500">Motivo del Ingreso</label>
            {SpeechRecognitionAPI && (
              <button
                type="button"
                onClick={toggleDictado}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all active:scale-90 ${
                  escuchando
                    ? "bg-red-600/20 border border-red-500/40 text-red-300 animate-pulse"
                    : "bg-zinc-800 border border-zinc-700 text-zinc-400"
                }`}
              >
                {escuchando ? <MicOff size={12} /> : <Mic size={12} />}
                {escuchando ? "Detener" : "Dictado"}
              </button>
            )}
          </div>
          <textarea
            className={`w-full border bg-zinc-900 rounded-2xl p-4 font-bold text-white outline-none transition-all ${
              escuchando ? "border-red-500/50 focus:border-red-500" : "border-white/5 focus:border-orange-600"
            }`}
            rows="2"
            value={f.falla}
            onChange={(e) => setF({ ...f, falla: e.target.value })}
            placeholder="¿Qué le pasa hoy?"
          />
        </div>
        <button onClick={() => handleCreateAll(f)} className="w-full bg-orange-600 text-white py-5 rounded-[2.5rem] font-black uppercase shadow-xl shadow-orange-600/20 active:scale-95 transition-all tracking-widest">
          {prefill ? "Abrir Nueva Orden" : "Ingresar al Taller"}
        </button>
      </div>
    </div>
  );
}

