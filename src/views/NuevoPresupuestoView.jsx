import React, { useMemo, useState } from "react";
import { ArrowLeft, Info } from "lucide-react";

function normalizar(value = "") {
  return String(value).trim().toUpperCase();
}

export default function NuevoPresupuestoView({ onCrear, setView, bikes = [], clients = [] }) {
  const [f, setF] = useState({
    nombre: "",
    tel: "",
    patente: "",
    marca: "",
    modelo: "",
    cilindrada: 110,
    km: "",
    consulta: "",
    validezDias: 7,
  });
  const [ignorarSugerencia, setIgnorarSugerencia] = useState(false);

  const coincidenciaMoto = useMemo(() => {
    const patente = normalizar(f.patente);
    if (patente.length < 3) return null;
    const moto = bikes.find((b) => normalizar(b.patenteNormalizada || b.patente) === patente);
    if (!moto) return null;
    const cliente = clients.find((c) => c.id === moto.clienteId) || null;
    return { moto, cliente };
  }, [bikes, clients, f.patente]);

  const usarHistorial = () => {
    if (!coincidenciaMoto) return;
    setF((prev) => ({
      ...prev,
      marca: coincidenciaMoto.moto?.marca || prev.marca,
      modelo: coincidenciaMoto.moto?.modelo || prev.modelo,
      cilindrada: coincidenciaMoto.moto?.cilindrada || prev.cilindrada,
      nombre: coincidenciaMoto.cliente?.nombre || prev.nombre,
      tel: coincidenciaMoto.cliente?.tel || coincidenciaMoto.cliente?.telefono || prev.tel,
      km: prev.km || coincidenciaMoto.moto?.kilometrajeActual || coincidenciaMoto.moto?.km || "",
    }));
    setIgnorarSugerencia(false);
  };

  return (
    <div className="p-6 text-left animate-in slide-in-from-bottom duration-300">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => setView("presupuestos")} className="p-3 bg-zinc-900 rounded-2xl border border-white/5 text-white active:scale-90 transition-all">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-3xl font-black text-white tracking-tighter uppercase">Nuevo Presupuesto</h1>
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
                  Cliente: {coincidenciaMoto.cliente?.nombre || "Sin cliente"} · {coincidenciaMoto.cliente?.tel || "---"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={usarHistorial} className="bg-orange-600 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95">
                Usar historial
              </button>
              <button onClick={() => setIgnorarSugerencia(true)} className="bg-zinc-900 border border-white/10 text-zinc-300 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95">
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
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Km (opcional)</label>
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
            <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">CC</label>
            <input className="w-full border border-white/5 bg-zinc-900 rounded-2xl p-4 font-black text-white outline-none focus:border-orange-600 text-sm" type="text" inputMode="numeric" placeholder="250" value={f.cilindrada} onChange={(e) => setF({ ...f, cilindrada: e.target.value.replace(/\D/g, "") })} />
          </div>
        </div>

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
          <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Teléfono / WhatsApp</label>
          <input
            className="w-full border rounded-2xl p-4 font-black outline-none bg-zinc-900 text-white border-white/5 focus:border-orange-600"
            placeholder="Ej: 3434123456"
            value={f.tel}
            onChange={(e) => setF({ ...f, tel: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Motivo / Consulta</label>
          <textarea
            className="w-full border border-white/5 bg-zinc-900 rounded-2xl p-4 font-bold text-white outline-none focus:border-orange-600"
            rows="2"
            value={f.consulta}
            onChange={(e) => setF({ ...f, consulta: e.target.value })}
            placeholder="¿Qué necesita el cliente?"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-zinc-500 ml-2">Validez (días)</label>
          <input
            className="w-full border border-white/5 bg-zinc-900 rounded-2xl p-4 font-black text-white outline-none focus:border-orange-600"
            type="text"
            inputMode="numeric"
            value={f.validezDias}
            onChange={(e) => setF({ ...f, validezDias: e.target.value.replace(/\D/g, "") })}
          />
        </div>

        <button
          onClick={() => onCrear(f)}
          className="w-full bg-orange-600 text-white py-5 rounded-[2.5rem] font-black uppercase shadow-xl shadow-orange-600/20 active:scale-95 transition-all tracking-widest"
        >
          Crear Presupuesto
        </button>
      </div>
    </div>
  );
}
