import React, { useState, useEffect } from "react";
import { ArrowLeft, Wrench, DollarSign, FileText, MessageSquare, Truck, Trash2, Edit2, Activity, ShieldCheck } from "lucide-react";
import { LS } from "../lib/storage.js";
import { ESTADO_LABEL, ESTADO_CSS, CONFIG_DEFAULT } from "../lib/constants.js";
import { calcularResultadosOrden, generarMensajePresupuesto, evaluarEstado, calcularNuevoRango } from "../lib/calc.js";
import { obtenerAprendizaje } from "../lib/priceLearning.js";
import { iniciarCronometro, pausarCronometro, obtenerTiempoActual, formatTiempo } from "../lib/timer.js";
import { mensajeBloqueo, abrirWhatsApp } from "../lib/messages.js";
import { MOTIVOS_BLOQUEO } from "../lib/theme.js";
import { formatMoney } from "../utils/format.js";

export default function OrderDetailView({ order, clients, bikes, setView, showToast, setServiceToEdit }) {
  const [tiempoActual, setTiempoActual] = useState(0);
  const [motivoBloqueo, setMotivoBloqueo] = useState(MOTIVOS_BLOQUEO[0]);
  const [motivoManual, setMotivoManual] = useState("");

  useEffect(() => {
    const id = setInterval(() => setTiempoActual(obtenerTiempoActual(order)), 1000);
    return () => clearInterval(id);
  }, [order]);

  if (!order) return null;
  const b = bikes.find((x) => x.id === order.bikeId) || {};
  const c = clients.find((x) => x.id === order.clientId) || {};
  const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const res = calcularResultadosOrden(order);
  const valorHora = config.valorHoraCliente || 15000;
  const { estadoCron, costoActual } = evaluarEstado({
    tiempoHoras: tiempoActual,
    valorHora,
    maxAutorizado: order.maxAutorizado || 0,
  });

  // Rango estimado para el mensaje de bloqueo
  const promedioHoras = (order.tareas || []).reduce((s, t) => {
    const apr = obtenerAprendizaje(t.nombre, b.cilindrada);
    return s + (apr ? apr.promedio : (t.horasBase || 1));
  }, 0) || 1;
  const { nuevoMin, nuevoMax } = calcularNuevoRango({
    tiempoActual,
    costoHora: valorHora,
    promedioHoras,
    desvioHoras: promedioHoras * 0.3,
  });

  const handleStart = () => LS.updateDoc("ordenes", order.id, iniciarCronometro(order));
  const handlePause = () => LS.updateDoc("ordenes", order.id, pausarCronometro(order));
  const handleSetMax = () => {
    const val = prompt("Máximo autorizado por el cliente ($):");
    if (val && !isNaN(val) && Number(val) > 0) LS.updateDoc("ordenes", order.id, { maxAutorizado: Number(val) });
  };
  const totalPagado = (order.pagos || []).reduce((s, p) => s + (p.monto || 0), 0);
  const saldoPendiente = res.total - totalPagado;
  const isLocked = !!order.pdfEntregado;

  const cambiarEstado = (nuevo) => {
    if (isLocked) { showToast("Orden bloqueada (PDF enviado)"); return; }
    LS.updateDoc("ordenes", order.id, { estado: nuevo });
    showToast(`Estado: ${ESTADO_LABEL[nuevo]} ✓`);
  };

  const eliminarItem = (lista, index) => {
    if (isLocked) { showToast("Orden bloqueada"); return; }
    const nuevaLista = [...(order[lista] || [])];
    nuevaLista.splice(index, 1);
    const t = lista === "tareas" ? nuevaLista : order.tareas;
    const r = lista === "repuestos" ? nuevaLista : order.repuestos;
    const f = lista === "fletes" ? nuevaLista : order.fletes;
    const nTotal = (t || []).reduce((s, x) => s + (x.monto || 0), 0) +
      (r || []).reduce((s, x) => s + ((x.monto || 0) * (x.cantidad || 1)), 0) +
      (f || []).reduce((s, x) => s + (x.monto || 0), 0);
    LS.updateDoc("ordenes", order.id, { [lista]: nuevaLista, total: nTotal });
    showToast("Eliminado ✓");
  };

  const copiarPresupuesto = () => {
    const msg = generarMensajePresupuesto(order, b, c);
    navigator.clipboard?.writeText(msg).catch(() => {
      const ta = document.createElement("textarea");
      ta.value = msg;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    });
    showToast("Presupuesto copiado ✓");
  };

  return (
    <div className="min-h-screen bg-slate-100 text-left animate-in slide-in-from-right duration-300 pb-32">
      <div className="bg-slate-900 p-8 text-white">
        <button onClick={() => setView("ordenes")} className="mb-6 text-blue-500 flex items-center gap-2 text-xs font-black uppercase active:scale-90 transition-all">
          <ArrowLeft size={16} /> Volver
        </button>
        <div className="flex justify-between items-start">
          <div className="text-left font-bold">
            <div className="flex items-center gap-3">
              <h2 className="text-4xl font-black tracking-tighter leading-none">{b?.patente || "---"}</h2>
              {isLocked && <ShieldCheck className="text-blue-500" size={24} />}
            </div>
            <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{c?.nombre || "Cliente Desconocido"}</p>
            <div className="flex gap-2 items-center mt-3">
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${ESTADO_CSS[order.estado]}`}>
                {ESTADO_LABEL[order.estado]}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-1">Precio Cliente</p>
            <p className="text-3xl font-black tracking-tighter">{formatMoney(res.total)}</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {isLocked && (
          <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-3xl flex items-center gap-3">
            <div className="bg-blue-500 p-2 rounded-xl text-white"><ShieldCheck size={20} /></div>
            <p className="text-[10px] font-black text-blue-700 uppercase leading-tight">Orden BLOQUEADA — ya generaste un PDF. No se pueden editar tareas ni montos.</p>
          </div>
        )}

        <div className="bg-white p-6 rounded-[2.5rem] border-2 border-slate-200 shadow-sm grid grid-cols-2 gap-y-6 gap-x-4">
          <div className="text-left font-bold">
            <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">A Cobrar</p>
            <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatMoney(res.total)}</p>
          </div>
          <div className="text-right border-l border-slate-100 pl-4 font-bold">
            <p className="text-[10px] font-black uppercase text-blue-500 leading-none mb-1">Saldo</p>
            <p className={`text-2xl font-black tracking-tighter ${saldoPendiente > 0 ? "text-red-600" : "text-slate-400"}`}>
              {formatMoney(saldoPendiente)}
            </p>
            {totalPagado > 0 && <p className="text-[8px] text-green-600 uppercase font-black">Seña: {formatMoney(totalPagado)} ✓</p>}
          </div>
          <div className="border-t border-slate-100 pt-4 text-left font-bold">
            <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Costo Interno</p>
            <p className="text-xl font-black text-slate-500 tracking-tighter">{formatMoney(res.costoInterno)}</p>
          </div>
          <div className="text-right border-l border-slate-100 pl-4 border-t border-slate-100 pt-4 font-bold">
            <p className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">Rentabilidad</p>
            <div className="flex items-center justify-end gap-2">
              <p className={`text-2xl font-black tracking-tighter ${res.rentabilidad < 25 ? "text-red-600" : "text-blue-600"}`}>
                {Math.round(res.rentabilidad)}%
              </p>
              <Activity size={16} className={res.rentabilidad < 25 ? "text-red-500 animate-pulse" : "text-blue-500"} />
            </div>
          </div>
        </div>

        {order.estado !== "entregada" && !isLocked && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {order.estado === "diagnostico" && <button onClick={() => cambiarEstado("presupuesto")} className="bg-purple-600 text-white px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Pasar a Presupuesto</button>}
            {order.estado === "presupuesto" && <button onClick={() => cambiarEstado("aprobacion")} className="bg-yellow-500 text-black px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Esperando Aprobación</button>}
            {order.estado === "aprobacion" && <button onClick={() => cambiarEstado("reparacion")} className="bg-blue-600 text-white px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Iniciar Reparación</button>}
            {order.estado === "reparacion" && <button onClick={() => cambiarEstado("finalizada")} className="bg-green-600 text-white px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Finalizar Trabajo</button>}
            {order.estado === "finalizada" && <button onClick={() => cambiarEstado("entregada")} className="bg-black text-white px-6 py-4 rounded-2xl text-[10px] uppercase font-black flex-shrink-0 active:scale-95">Marcar Entregado</button>}
          </div>
        )}

        {order.estado === "reparacion" && (
          <div className="bg-slate-900 rounded-3xl p-5 space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cronómetro</p>
              <p className="text-2xl font-black text-white font-mono tracking-widest">{formatTiempo(tiempoActual)}</p>
            </div>

            <div className="bg-slate-800 rounded-2xl p-4 flex justify-between items-center">
              <p className="text-[10px] font-black text-slate-400 uppercase">Costo actual</p>
              <p className="text-lg font-black text-blue-400">{formatMoney(costoActual)}</p>
            </div>

            {order.maxAutorizado > 0 && (() => {
              const pct = Math.min((costoActual / order.maxAutorizado) * 100, 100);
              return (
                <div>
                  <div className="flex justify-between text-[9px] font-black text-slate-500 uppercase mb-1.5">
                    <span>Progreso</span>
                    <span>{Math.round(pct)}% de {formatMoney(order.maxAutorizado)}</span>
                  </div>
                  <div className="bg-slate-700 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all ${pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-yellow-400" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            {estadoCron === "ALERTA" && (
              <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-2xl p-3 text-center">
                <p className="text-yellow-400 font-black text-[10px] uppercase tracking-wider">⚠️ Cerca del límite autorizado</p>
              </div>
            )}

            {estadoCron === "BLOQUEADO" && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-4 space-y-3">
                <p className="text-red-400 font-black text-[10px] uppercase tracking-wider text-center">⛔ Límite superado</p>
                <select
                  value={motivoBloqueo}
                  onChange={e => setMotivoBloqueo(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 text-white text-xs font-bold rounded-xl p-3 outline-none"
                >
                  {MOTIVOS_BLOQUEO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                {motivoBloqueo === "Otro (manual)" && (
                  <textarea
                    value={motivoManual}
                    onChange={e => setMotivoManual(e.target.value)}
                    placeholder="Describí el motivo..."
                    className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-xl p-3 outline-none resize-none h-16"
                  />
                )}
                <button
                  onClick={() => abrirWhatsApp(c.tel, mensajeBloqueo({
                    bike: b, client: c,
                    tareas: order.tareas,
                    repuestos: order.repuestos,
                    motivo: motivoBloqueo === "Otro (manual)" ? motivoManual : motivoBloqueo,
                    costoActual, nuevoMin, nuevoMax,
                  }))}
                  className="w-full bg-green-600 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all"
                >
                  Enviar WhatsApp
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <button onClick={handleStart} disabled={order.cronometroActivo}
                className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${order.cronometroActivo ? "bg-slate-700 text-slate-500" : "bg-green-600 text-white"}`}>
                ▶ Iniciar
              </button>
              <button onClick={handlePause} disabled={!order.cronometroActivo}
                className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${!order.cronometroActivo ? "bg-slate-700 text-slate-500" : "bg-blue-500 text-white"}`}>
                ⏸ Pausar
              </button>
            </div>

            {!order.maxAutorizado && (
              <button onClick={handleSetMax} className="w-full border border-slate-700 text-slate-500 py-3 rounded-2xl font-black text-[10px] uppercase tracking-wider active:scale-95 transition-all">
                + Definir máx. autorizado
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button onClick={copiarPresupuesto} className="bg-slate-900 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            <MessageSquare size={16} /> Copiar Presup.
          </button>
          <button onClick={() => setView("prePdf")} className="bg-red-600 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            <FileText size={16} /> Generar PDF
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-2">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-tighter">Resumen del Trabajo</h3>
            {!isLocked && (
              <button onClick={() => setView("logistica")} className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-1 active:scale-90">
                <Truck size={14} /> + Logística
              </button>
            )}
          </div>
          <div className="space-y-2">
            {res.tareasAnalizadas?.map((t, idx) => (
              <div key={idx} className={`flex items-center p-4 rounded-2xl border-2 shadow-sm transition-all ${t.perdida ? "border-red-300 bg-red-50" : "border-slate-100 bg-white"}`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-[9px] font-black uppercase tracking-tighter ${t.perdida ? "text-red-600" : "text-blue-500"}`}>
                    {t.perdida ? "⚠️ REVISAR: BAJA RENTABILIDAD" : "Mano de Obra"}
                  </p>
                  <p className="text-sm font-black text-slate-800 truncate pr-2 leading-none mt-1 uppercase">{t.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm font-black mr-1 ${t.perdida ? "text-red-700" : "text-slate-900"}`}>{formatMoney(t.monto)}</p>
                  {!isLocked && (
                    <>
                      <button onClick={() => { setServiceToEdit(t); setView("gestionarTareas"); }} className="p-2.5 text-blue-500 bg-blue-50 rounded-xl active:scale-90"><Edit2 size={16} /></button>
                      <button onClick={() => eliminarItem("tareas", idx)} className="p-2.5 text-red-500 bg-red-50 rounded-xl active:scale-90"><Trash2 size={16} /></button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {order.repuestos?.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-blue-50/30 p-4 rounded-2xl border border-blue-100 shadow-sm">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-0.5">Repuesto</p>
                  <p className="text-sm font-bold text-blue-900 leading-tight uppercase truncate">{t.cantidad > 1 ? `${t.cantidad}x ` : ""}{t.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-blue-600 mr-2">{formatMoney(t.monto * (t.cantidad || 1))}</p>
                  {!isLocked && <button onClick={() => eliminarItem("repuestos", idx)} className="p-2 text-blue-200 active:text-red-500 transition-colors"><Trash2 size={18} /></button>}
                </div>
              </div>
            ))}
            {order.fletes?.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
                <Truck size={14} className="text-slate-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-700 leading-tight uppercase truncate">{t.nombre}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-black text-slate-900 mr-2">{formatMoney(t.monto)}</p>
                  {!isLocked && <button onClick={() => eliminarItem("fletes", idx)} className="p-2 text-slate-300 active:text-red-500 transition-colors"><Trash2 size={18} /></button>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button disabled={isLocked} onClick={() => setView("gestionarTareas")} className={`py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-sm flex items-center justify-center gap-2 active:scale-95 transition-all ${isLocked ? "bg-slate-50 text-slate-300" : "bg-slate-200 text-slate-900"}`}>
            <Wrench size={14} /> Editar Tareas
          </button>
          <button onClick={() => setView("pagos")} className="bg-green-600 text-white py-5 rounded-3xl font-black uppercase text-[10px] tracking-widest shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">
            <DollarSign size={14} /> Cobrar
          </button>
        </div>
      </div>
    </div>
  );
}
