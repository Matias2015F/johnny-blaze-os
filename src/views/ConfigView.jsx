import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase.js";
import { doc, setDoc } from "firebase/firestore";
import { ArrowLeft, Landmark, Target, Plus, Trash2, Save } from "lucide-react";
import { formatMoney, formatMoneyInput, formatQtyInput, parseMonto } from "../utils/format.js";

export default function ConfigView({ setView, showToast, configGlobal }) {
  const [perfil, setPerfil] = useState({ nombreTaller: "", responsable: "", formacion: "", direccion: "", telefono: "" });
  const [gastos, setGastos] = useState([]);
  const [objetivos, setObjetivos] = useState({ horasMes: "", gananciaDeseada: "" });
  const [lastUpdate, setLastUpdate] = useState("");

  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (configGlobal) {
      setPerfil(configGlobal.perfil || {});
      setGastos(configGlobal.gastos || []);
      setObjetivos({
        horasMes: configGlobal.objetivos?.horasMes?.toString() || "",
        gananciaDeseada: configGlobal.objetivos?.gananciaDeseada?.toString() || "",
      });
      setLastUpdate(configGlobal.lastUpdate || "");
    }
  }, [configGlobal]);

  const addGasto = () => setGastos([...gastos, { id: Date.now(), desc: "", monto: "" }]);
  const updateGasto = (id, field, value) => setGastos(gastos.map(g => g.id === id ? { ...g, [field]: value } : g));
  const removeGasto = (id) => setGastos(gastos.filter(g => g.id !== id));

  const save = async () => {
    const hoy = new Date().toLocaleDateString("es-AR");
    const config = {
      perfil,
      gastos: gastos.map(g => ({ ...g, monto: parseMonto(g.monto) })),
      objetivos: {
        horasMes: Number(objetivos.horasMes) || 0,
        gananciaDeseada: parseMonto(objetivos.gananciaDeseada),
      },
      lastUpdate: hoy,
    };
    try {
      await setDoc(doc(db, "usuarios", uid), { config }, { merge: true });
      showToast("Ajustes guardados ✓");
    } catch (e) {
      showToast("Error al guardar");
    }
  };

  const totalCostos = gastos.reduce((acc, g) => acc + parseMonto(g.monto), 0);
  const valorHora = (totalCostos + parseMonto(objetivos.gananciaDeseada)) / (Number(objetivos.horasMes) || 1);

  return (
    <div className="p-4 space-y-6 pb-28 text-left animate-in slide-in-from-right duration-500">
      <div className="flex items-center justify-between">
        <button onClick={() => setView("home")} className="p-4 bg-white/5 border border-white/10 rounded-2xl text-white active:scale-95 transition-all"><ArrowLeft size={20} /></button>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Última actualización</p>
          <p className="text-white font-bold text-xs">{lastUpdate || "Pendiente"}</p>
        </div>
      </div>

      <div className="bg-orange-600 p-8 rounded-[2.5rem] shadow-xl text-white text-left">
        <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1 text-left leading-none">Mano de Obra Sugerida</p>
        <h2 className="text-5xl font-black tracking-tighter text-left leading-none">{formatMoney(valorHora)}</h2>
      </div>

      <div className="bg-[#151515] p-8 rounded-[2.5rem] border border-white/5 space-y-4 shadow-2xl text-left">
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-3 text-blue-500">
            <Landmark size={18} />
            <h3 className="font-black uppercase text-xs tracking-widest text-left">Gastos Mensuales</h3>
          </div>
          <button onClick={addGasto} className="p-2 bg-blue-600/20 text-blue-500 rounded-xl active:scale-90 transition-all"><Plus size={20} /></button>
        </div>
        {gastos.map((g) => (
          <div key={g.id} className="flex gap-2 items-end animate-in zoom-in duration-300">
            <input className="flex-1 bg-black border border-white/10 p-4 rounded-2xl text-white text-sm" placeholder="Ej: Alquiler" value={g.desc} onChange={(e) => updateGasto(g.id, "desc", e.target.value)} />
            <input className="w-32 bg-black border border-white/10 p-4 rounded-2xl text-white text-sm font-bold" placeholder="0" inputMode="numeric" value={formatMoneyInput(g.monto)} onChange={(e) => updateGasto(g.id, "monto", e.target.value)} />
            <button onClick={() => removeGasto(g.id)} className="p-4 text-red-500 active:scale-90"><Trash2 size={20} /></button>
          </div>
        ))}
      </div>

      <div className="bg-[#151515] p-8 rounded-[2.5rem] border border-white/5 space-y-4 shadow-2xl text-left italic">
        <div className="flex items-center gap-3 mb-2 text-green-500 italic">
          <Target size={18} />
          <h3 className="font-black uppercase text-xs tracking-widest text-left italic">Meta de Ganancia</h3>
        </div>
        <input
          className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white text-2xl font-black outline-none"
          placeholder="Monto neto mensual"
          inputMode="numeric"
          value={formatMoneyInput(objetivos.gananciaDeseada)}
          onChange={(e) => setObjetivos({ ...objetivos, gananciaDeseada: e.target.value })}
        />
        <div className="pt-2 text-left italic">
          <label className="text-[10px] text-slate-500 font-bold uppercase ml-1 block text-left italic">Horas Facturables / Mes</label>
          <input
            type="text"
            inputMode="numeric"
            className="w-full bg-black border border-white/10 p-4 rounded-2xl text-white text-lg font-bold outline-none"
            placeholder="Ej: 160"
            value={formatQtyInput(objetivos.horasMes)}
            onChange={(e) => setObjetivos({ ...objetivos, horasMes: formatQtyInput(e.target.value) })}
          />
        </div>
      </div>

      <button onClick={save} className="w-full bg-white text-black p-6 rounded-[2rem] font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl">
        <Save size={18} /> Guardar Ajustes
      </button>
    </div>
  );
}
