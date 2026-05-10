import React, { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, X, Sparkles, Bell, Search } from "lucide-react";
import { LS, useCollection, generateId, buscarRepuestosAutocomplete, guardarRepuestoHistorial } from "../lib/storage.js";
import { CONFIG_DEFAULT, SERVICIOS_DEFAULT } from "../lib/constants.js";
import { calcularNuevoTotal } from "../lib/calc.js";
import { obtenerAprendizaje, evaluarConfianza } from "../lib/priceLearning.js";
import { formatMoney } from "../utils/format.js";
import { TIPOS_SERVICIO, detectarProximoControl, buildProximoControl } from "../lib/proximoControl.js";
import { trackEvent } from "../lib/telemetry.js";

const PRESETS = [10, 20, 30, 50, 80];

const TIPOS_RAPIDOS = [
  { id: null,            label: "Sin recordatorio" },
  { id: "cambio_aceite", label: "Cambio de aceite" },
  { id: "frenos",        label: "Frenos" },
  { id: "transmision",   label: "Transmisión" },
  { id: "control_general", label: "Control general" },
  { id: "otro",          label: "Otro" },
];

const PLAZOS_KM  = [1000, 2500];
const PLAZOS_DIAS= [30, 60];
const PLAZOS_TEST= [
  { label: "Alerta inmediata", unidad: "km",      valor: 0,   test: true },
  { label: "+10 km",           unidad: "km",      valor: 10,  test: true },
  { label: "+50 km",           unidad: "km",      valor: 50,  test: true },
  { label: "En 1 min",         unidad: "minutos", valor: 1,   test: true },
  { label: "En 5 min",         unidad: "minutos", valor: 5,   test: true },
];

function normalizarTexto(value = "") {
  return String(value).trim().toLowerCase();
}

function mismaMoto(a = {}, b = {}) {
  return (
    normalizarTexto(a.marca) === normalizarTexto(b.marca) &&
    normalizarTexto(a.modelo) === normalizarTexto(b.modelo) &&
    Number(a.cilindrada || 0) === Number(b.cilindrada || 0)
  );
}

function clonarLista(items = []) {
  return items.map((item) => ({ ...item }));
}

const SECCION_POR_TIPO = {
  tareas: "servicio",
  repuestos: "repuestos",
  insumos: "insumos",
  fletes: "fletes",
};

function limpiarMateriales(items = []) {
  return (items || [])
    .map((item) => ({
      ...item,
      nombre: String(item.nombre || item.descripcion || "").trim(),
      cantidad: Math.max(1, Number(item.cantidad || 1)),
      monto: Number(item.monto || 0),
    }))
    .filter((item) => item.nombre && item.monto > 0);
}

function limpiarFletes(items = []) {
  return (items || [])
    .map((item) => ({
      ...item,
      nombre: String(item.nombre || item.descripcion || "").trim(),
      monto: Number(item.monto || 0),
    }))
    .filter((item) => item.nombre && item.monto > 0);
}

function AccordionSection({ titulo, numero, completo, activo, onClick, children }) {
  return (
    <div className="rounded-[2rem] border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button
        onClick={onClick}
        className={`w-full flex items-center justify-between p-5 transition-all ${
          activo ? "bg-orange-600/20 border-b border-orange-500/30" : "hover:bg-zinc-800/50"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
            completo ? "bg-green-500/20 text-green-400" : "bg-zinc-700 text-zinc-300"
          }`}>
            {completo ? "✓" : numero}
          </div>
          <span className={`font-black uppercase text-sm ${
            activo ? "text-orange-300" : completo ? "text-green-300" : "text-zinc-300"
          }`}>{titulo}</span>
        </div>
        <svg className={`w-5 h-5 transition-transform ${activo ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {activo && (
        <div className="p-5 space-y-4 animate-in slide-in-from-top duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

function RepuestoConAutocomplete({ repuesto, cilindrada, onUpdate, onSelect, onDelete }) {
  const [busqueda, setBusqueda] = useState(repuesto.nombre || "");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  useEffect(() => { setBusqueda(repuesto.nombre || ""); }, [repuesto.nombre]);

  const handleBusqueda = (valor) => {
    setBusqueda(valor);
    onUpdate("nombre", valor);
    if (valor.length > 0) {
      const r = buscarRepuestosAutocomplete(valor, cilindrada, "repuesto");
      setSugerencias(r);
      setMostrarSugerencias(r.length > 0);
    } else {
      setSugerencias([]);
      setMostrarSugerencias(false);
    }
  };

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-3 relative">
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2">
          <Search size={14} className="text-zinc-500" />
          <input
            type="text"
            className="w-full border-none bg-transparent text-xs font-black uppercase text-white outline-none placeholder:text-zinc-600"
            placeholder="Buscar repuesto..."
            value={busqueda}
            onChange={(e) => handleBusqueda(e.target.value)}
            onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
          />
        </div>
        {mostrarSugerencias && sugerencias.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-white/10 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
            {sugerencias.map((rep) => (
              <button
                key={rep.id}
                onMouseDown={() => { onSelect(rep); setBusqueda(rep.nombre); setMostrarSugerencias(false); }}
                className="w-full text-left px-3 py-2 hover:bg-orange-600/20 transition-colors border-b border-white/5 last:border-b-0"
              >
                <p className="text-xs font-black text-white">{rep.nombre}</p>
                <p className="text-[9px] text-orange-400">{formatMoney(rep.precio)} · Usos: {rep.usos}</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-[80px_minmax(0,1fr)_auto] gap-2 items-end">
        <div>
          <p className="text-[9px] font-black text-zinc-300 uppercase mb-1">Cant.</p>
          <input
            type="text" inputMode="numeric"
            className="w-full rounded-xl border border-white/10 bg-zinc-950/80 p-2 text-center text-xs font-black text-white outline-none focus:border-orange-500"
            value={repuesto.cantidad || 1}
            onChange={(e) => onUpdate("cantidad", Number(e.target.value.replace(/\D/g, "")) || 1)}
          />
        </div>
        <div>
          <p className="text-[9px] font-black text-zinc-300 uppercase mb-1">Precio unit.</p>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2">
            <span className="text-[10px] font-black text-zinc-300">$</span>
            <input
              type="text" inputMode="numeric"
              className="w-full min-w-0 bg-transparent text-right text-xs font-black text-orange-400 outline-none"
              placeholder="0"
              value={repuesto.monto > 0 ? repuesto.monto.toLocaleString("es-AR") : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                const monto = digits ? Number(digits) : 0;
                onUpdate("monto", monto);
                if (monto && repuesto.nombre) guardarRepuestoHistorial(repuesto.nombre, monto, cilindrada, "repuesto");
              }}
            />
          </div>
        </div>
        <button onClick={onDelete} className="self-center p-1 text-zinc-500 hover:text-red-400 transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="flex justify-between items-center border-t border-white/10 pt-2">
        <p className="text-[9px] font-black text-zinc-400 uppercase">Total repuesto</p>
        <p className="text-sm font-black text-orange-400">{formatMoney((repuesto.cantidad || 1) * (repuesto.monto || 0))}</p>
      </div>
    </div>
  );
}

function InsumoConAutocomplete({ insumo, cilindrada, onUpdate, onSelect, onDelete }) {
  const [busqueda, setBusqueda] = useState(insumo.nombre || "");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  useEffect(() => { setBusqueda(insumo.nombre || ""); }, [insumo.nombre]);

  const handleBusqueda = (valor) => {
    setBusqueda(valor);
    onUpdate("nombre", valor);
    if (!valor.trim()) { setSugerencias([]); setMostrarSugerencias(false); return; }
    const r = buscarRepuestosAutocomplete(valor, cilindrada, "insumo");
    setSugerencias(r);
    setMostrarSugerencias(r.length > 0);
  };

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-3">
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2">
          <Search size={14} className="text-zinc-500 flex-shrink-0" />
          <input
            className="w-full min-w-0 bg-transparent text-xs font-black uppercase text-white outline-none placeholder:text-zinc-600"
            placeholder="Insumo / servicio..."
            value={busqueda}
            onChange={(e) => handleBusqueda(e.target.value)}
            onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
            autoComplete="off"
          />
        </div>
        {mostrarSugerencias && sugerencias.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
            {sugerencias.map((item, i) => (
              <button
                key={i}
                onMouseDown={() => { onSelect(item); setBusqueda(item.nombre); setMostrarSugerencias(false); }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-800 border-b border-white/5 text-[10px] last:border-b-0 active:bg-zinc-700"
              >
                <p className="font-black text-white">{item.nombre}</p>
                <p className="text-zinc-400">{formatMoney(item.precio)} · {item.usos || 0} usos</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-[80px_minmax(0,1fr)_auto] gap-2 items-end">
        <div>
          <p className="text-[9px] font-black text-zinc-300 uppercase mb-1">Cant.</p>
          <input
            type="text" inputMode="numeric"
            className="w-full rounded-xl border border-white/10 bg-zinc-950/80 p-2 text-center text-xs font-black text-white outline-none"
            value={insumo.cantidad || 1}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "");
              onUpdate("cantidad", Math.max(1, Number(digits) || 1));
            }}
          />
        </div>
        <div>
          <p className="text-[9px] font-black text-zinc-300 uppercase mb-1">Costo unit.</p>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2">
            <span className="text-[10px] font-black text-zinc-300">$</span>
            <input
              type="text" inputMode="numeric"
              className="w-full min-w-0 bg-transparent text-right text-xs font-black text-orange-400 outline-none"
              value={insumo.monto > 0 ? insumo.monto.toLocaleString("es-AR") : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                const monto = digits ? Number(digits) : 0;
                onUpdate("monto", monto);
                if (monto && insumo.nombre) guardarRepuestoHistorial(insumo.nombre, monto, cilindrada, "insumo");
              }}
              placeholder="0"
            />
          </div>
        </div>
        <button onClick={onDelete} className="self-center p-1 text-zinc-500 active:text-red-400">
          <X size={16} />
        </button>
      </div>
      <div className="flex justify-between items-center border-t border-white/10 pt-2">
        <p className="text-[9px] font-black text-zinc-300 uppercase">Total gasto</p>
        <p className="text-[11px] font-black text-orange-400">{formatMoney((insumo.monto || 0) * (insumo.cantidad || 1))}</p>
      </div>
    </div>
  );
}

function FleteConAutocomplete({ flete, onUpdate, onDelete }) {
  const [busqueda, setBusqueda] = useState(flete.nombre || "");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  useEffect(() => { setBusqueda(flete.nombre || ""); }, [flete.nombre]);

  const handleBusqueda = (valor) => {
    setBusqueda(valor);
    onUpdate("nombre", valor);
    if (!valor.trim()) { setSugerencias([]); setMostrarSugerencias(false); return; }
    const r = buscarRepuestosAutocomplete(valor, null, "flete");
    setSugerencias(r);
    setMostrarSugerencias(r.length > 0);
  };

  return (
    <div className="space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-3">
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2">
          <Search size={14} className="text-zinc-500 flex-shrink-0" />
          <input
            className="w-full min-w-0 bg-transparent text-xs font-black uppercase text-white outline-none placeholder:text-zinc-600"
            placeholder="Ej: Cadetería zona norte..."
            value={busqueda}
            onChange={(e) => handleBusqueda(e.target.value)}
            onBlur={() => setTimeout(() => setMostrarSugerencias(false), 150)}
            autoComplete="off"
          />
        </div>
        {mostrarSugerencias && sugerencias.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
            {sugerencias.map((item, i) => (
              <button
                key={i}
                onMouseDown={() => {
                  onUpdate("nombre", item.nombre);
                  onUpdate("monto", item.precio);
                  setBusqueda(item.nombre);
                  setMostrarSugerencias(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-800 border-b border-white/5 text-[10px] last:border-b-0 active:bg-zinc-700"
              >
                <p className="font-black text-white">{item.nombre}</p>
                <p className="text-zinc-400">{formatMoney(item.precio)} · {item.usos || 0} usos</p>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 items-end">
        <div>
          <p className="text-[9px] font-black text-zinc-300 uppercase mb-1">Monto</p>
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-zinc-950/80 px-3 py-2">
            <span className="text-[10px] font-black text-zinc-300">$</span>
            <input
              type="text" inputMode="numeric"
              className="w-full min-w-0 bg-transparent text-right text-xs font-black text-purple-400 outline-none"
              value={flete.monto > 0 ? flete.monto.toLocaleString("es-AR") : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                const monto = digits ? Number(digits) : 0;
                onUpdate("monto", monto);
                if (monto && flete.nombre) guardarRepuestoHistorial(flete.nombre, monto, null, "flete");
              }}
              placeholder="0"
            />
          </div>
        </div>
        <button onClick={onDelete} className="self-center p-1 text-zinc-500 active:text-red-400">
          <X size={16} />
        </button>
      </div>
      {flete.monto > 0 && (
        <div className="flex justify-between items-center border-t border-white/10 pt-2">
          <p className="text-[9px] font-black text-zinc-300 uppercase">Total flete</p>
          <p className="text-[11px] font-black text-purple-400">{formatMoney(flete.monto)}</p>
        </div>
      )}
    </div>
  );
}

export default function TaskManagerView({ order, setView, showToast, serviceToEdit, setServiceToEdit }) {
  const catalogData = useCollection("catalogoTareas");
  const bikes       = useCollection("motos");
  const orders      = useCollection("trabajos");
  const config      = LS.getDoc("config", "global") || CONFIG_DEFAULT;
  const bike        = bikes.find(b => b.id === order.bikeId) || {};
  const testMode    = config.testModeRecordatorios || false;

  const defaultMargen = config.margenPolitica ?? 25;

  const [seccionActiva, setSeccionActiva] = useState("servicio");
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: "", horasBase: 1, dificultad: "normal", repuestos: [], insumos: [], fletes: order.fletes || [], observacionesProxima: "",
  });
  const [sugerencia, setSugerencia] = useState(null);
  const [margenPct, setMargenPct] = useState(defaultMargen);
  const [customMode, setCustomMode] = useState(false);
  const modoEdicion = serviceToEdit?._editType || null;

  // Próximo control
  const [proximoTipo, setProximoTipo] = useState(order.proximoControl?.tipo || null);
  const [proximoUnidad, setProximoUnidad] = useState("km");
  const [proximoValor, setProximoValor] = useState(null);
  const [proximoDesc, setProximoDesc] = useState("");
  const [proximoCustom, setProximoCustom] = useState(false);
  const [proximoCustomInput, setProximoCustomInput] = useState("");
  const [deteccion, setDeteccion] = useState(null); // {tipo,descripcion,unidad,valorObjetivo,textoOrigen}

  useEffect(() => {
    trackEvent("open_gestionar_tareas", {
      screen: "gestionarTareas",
      entityType: "trabajo",
      entityId: order.id,
      metadata: {
        bikeId: order.bikeId,
        estado: order.estado || "",
      },
    }).catch(console.error);
  }, [order.bikeId, order.estado, order.id]);

  // Cargar datos de tarea existente al editar — FIX: incluye repuestos e insumos guardados
  useEffect(() => {
    if (serviceToEdit) {
      const tipoEdicion = serviceToEdit._editType || "tareas";
      setSeccionActiva(SECCION_POR_TIPO[tipoEdicion] || "servicio");

      if (tipoEdicion !== "tareas") {
        setSugerencia(null);
        setEditForm({
          nombre: "",
          horasBase: 1,
          dificultad: "normal",
          repuestos: tipoEdicion === "repuestos" ? clonarLista(order.repuestos || []) : [],
          insumos: tipoEdicion === "insumos" ? clonarLista(order.insumos || []) : [],
          fletes: clonarLista(order.fletes || []),
          observacionesProxima: order.observacionesProxima || "",
        });
        return;
      }

      const apr = obtenerAprendizaje(serviceToEdit.nombre, bike.cilindrada);
      setSugerencia(apr ? { apr, confianza: evaluarConfianza(apr) } : null);
      setEditForm({
        nombre: serviceToEdit.nombre,
        horasBase: serviceToEdit.horasBase || 1,
        dificultad: serviceToEdit.dificultad || "normal",
        repuestos: clonarLista(serviceToEdit.repuestos || []),
        insumos: clonarLista(serviceToEdit.insumos || []),
        fletes: clonarLista(order.fletes || []),
        observacionesProxima: serviceToEdit.observacionesProxima || order.observacionesProxima || "",
      });
      setMargenPct(serviceToEdit.margenPct ?? defaultMargen);
    }
  }, [serviceToEdit, order.fletes, order.insumos, order.observacionesProxima, order.repuestos, bike.cilindrada, defaultMargen]);

  // Auto-detectar próximo control desde observaciones
  useEffect(() => {
    const texto = editForm.observacionesProxima;
    if (!texto?.trim()) { setDeteccion(null); return; }
    // Solo detectar si el usuario no seleccionó algo manualmente
    if (proximoTipo) return;
    const d = detectarProximoControl(texto);
    setDeteccion(d || null);
  }, [editForm.observacionesProxima]);

  useEffect(() => {
    const nombre = editForm.nombre?.trim();
    if (!nombre || selectedId) return;
    const previo = obtenerServicioPrevio(nombre);
    if (!previo) return;
    if ((editForm.repuestos?.length || 0) > 0 || (editForm.insumos?.length || 0) > 0) return;

    setEditForm((actual) => ({
      ...actual,
      horasBase: previo.tarea?.horasBase || actual.horasBase,
      dificultad: previo.tarea?.dificultad || actual.dificultad,
      repuestos: clonarLista(previo.tarea?.repuestos || []),
      insumos: clonarLista(previo.tarea?.insumos || []),
      observacionesProxima: actual.observacionesProxima || previo.trabajo?.observacionesProxima || "",
    }));
    setMargenPct(previo.tarea?.margenPct ?? defaultMargen);
    if (previo?.trabajo?.proximoControl) {
      setProximoTipo(previo.trabajo.proximoControl.tipo || null);
      setProximoUnidad(previo.trabajo.proximoControl.unidad === "dias" ? "dias" : "km");
      setProximoValor(previo.trabajo.proximoControl.valorObjetivo || null);
      setProximoDesc(previo.trabajo.proximoControl.descripcion || "");
    }
  }, [editForm.nombre, selectedId]);

  const aplicarHistorial = (nombre, horasBase) => {
    const apr = obtenerAprendizaje(nombre, bike.cilindrada);
    if (apr) {
      setSugerencia({ apr, confianza: evaluarConfianza(apr) });
      return Math.round(apr.promedio * 10) / 10;
    }
    setSugerencia(null);
    return horasBase;
  };

  function obtenerServicioPrevio(nombreServicio) {
    const servicioBuscado = normalizarTexto(nombreServicio);
    if (!servicioBuscado || !bike?.marca || !bike?.modelo || !bike?.cilindrada) return null;

    const historial = (orders || [])
      .filter((trabajo) => trabajo.id !== order.id && trabajo.bikeId)
      .map((trabajo) => {
        const motoTrabajo = bikes.find((item) => item.id === trabajo.bikeId);
        return { trabajo, motoTrabajo };
      })
      .filter(({ motoTrabajo }) => mismaMoto(motoTrabajo, bike))
      .flatMap(({ trabajo }) =>
        (trabajo.tareas || [])
          .filter((tarea) => normalizarTexto(tarea.nombre) === servicioBuscado)
          .map((tarea) => ({
            tarea,
            trabajo,
            fecha: trabajo.updatedAt || trabajo.createdAt || 0,
          }))
      )
      .sort((a, b) => b.fecha - a.fecha);

    return historial[0] || null;
  }

  const serviciosDisponibles = useMemo(() => {
    const porNombre = new Map();
    const agregar = (servicio, prioridad = 0) => {
      const nombre = servicio?.nombre?.trim();
      if (!nombre) return;
      const clave = normalizarTexto(nombre);
      const actual = porNombre.get(clave);
      if (!actual || prioridad > actual.prioridad) {
        porNombre.set(clave, { ...servicio, prioridad });
      }
    };

    const historialMismaMoto = (orders || [])
      .filter((trabajo) => trabajo.id !== order.id && trabajo.bikeId)
      .map((trabajo) => ({
        trabajo,
        motoTrabajo: bikes.find((item) => item.id === trabajo.bikeId),
      }))
      .filter(({ motoTrabajo }) => mismaMoto(motoTrabajo, bike))
      .flatMap(({ trabajo }) =>
        (trabajo.tareas || []).map((tarea) => ({
          id: `hist-${normalizarTexto(tarea.nombre)}`,
          nombre: tarea.nombre,
          horasBase: tarea.horasBase || 1,
          dificultad: tarea.dificultad || "normal",
          repuestos: clonarLista(tarea.repuestos || []),
          insumos: clonarLista(tarea.insumos || []),
          observacionesProxima: trabajo.observacionesProxima || "",
          proximoControl: trabajo.proximoControl || null,
          margenPct: tarea.margenPct ?? defaultMargen,
        }))
      );

    historialMismaMoto.forEach((servicio) => agregar(servicio, 3));

    catalogData.forEach((servicio) => {
      const coincideMoto =
        !servicio.marca ||
        (normalizarTexto(servicio.marca) === normalizarTexto(bike.marca) &&
          normalizarTexto(servicio.modelo) === normalizarTexto(bike.modelo) &&
          Number(servicio.cilindrada || 0) === Number(bike.cilindrada || 0));
      if (!coincideMoto) return;
      agregar(servicio, servicio.marca ? 2 : 1);
    });

    SERVICIOS_DEFAULT.forEach((servicio) => agregar(servicio, 0));

    return Array.from(porNombre.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [bike, bikes, catalogData, defaultMargen, order.id, orders]);

  const handleSelect = (id) => {
    setSelectedId(id);
    if (!id) {
      setEditForm({ nombre: "", horasBase: 1, dificultad: "normal", repuestos: [], insumos: [], fletes: order.fletes || [], observacionesProxima: "" });
      setSugerencia(null);
      return;
    }
    const s = serviciosDisponibles.find(x => x.id === id);
    if (s) {
      const previo = obtenerServicioPrevio(s.nombre);
      const repuestosBase = previo?.tarea?.repuestos || s.repuestos || [];
      const insumosBase = previo?.tarea?.insumos || s.insumos || [];
      const horasBase = previo?.tarea?.horasBase || aplicarHistorial(s.nombre, s.horasBase || 1);
      setEditForm({
        nombre: s.nombre,
        horasBase,
        dificultad: previo?.tarea?.dificultad || s.dificultad || "normal",
        repuestos: clonarLista(repuestosBase),
        insumos: clonarLista(insumosBase),
        fletes: order.fletes || [],
        observacionesProxima: previo?.trabajo?.observacionesProxima || s.observacionesProxima || order.observacionesProxima || "",
      });
      setMargenPct(previo?.tarea?.margenPct ?? s.margenPct ?? defaultMargen);
      const proximoBase = previo?.trabajo?.proximoControl || s.proximoControl;
      if (proximoBase) {
        setProximoTipo(proximoBase.tipo || null);
        setProximoUnidad(proximoBase.unidad === "dias" ? "dias" : "km");
        setProximoValor(proximoBase.valorObjetivo || null);
        setProximoDesc(proximoBase.descripcion || "");
      }
    }
  };

  const completoServicio = () => editForm.nombre.trim().length > 0;
  const toggleSeccion = (seccion) => setSeccionActiva(actual => actual === seccion ? null : seccion);

  const abrirSiguiente = (seccionActual) => {
    if (seccionActual === "servicio" && completoServicio()) setSeccionActiva("repuestos");
    else if (seccionActual === "repuestos") setSeccionActiva("insumos");
    else if (seccionActual === "insumos") setSeccionActiva("fletes");
    else if (seccionActual === "fletes") setSeccionActiva("observaciones");
  };

  const updateListItem = (lista, idx, field, val) => {
    const numFields = ["monto", "cantidad", "montoCosto"];
    const parsed = numFields.includes(field) ? (typeof val === "number" ? val : Number(String(val).replace(/\D/g, "")) || 0) : val;
    const list = editForm[lista].map((item, i) => i === idx ? { ...item, [field]: parsed } : item);
    setEditForm({ ...editForm, [lista]: list });
  };

  const stats = useMemo(() => {
    const factor  = (config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[editForm.dificultad] || 1;
    const pct     = Number(margenPct || 0);

    // Mano de obra: costo real → precio con margen (0 si no hay nombre de tarea)
    const activa   = editForm.nombre.trim().length > 0;
    const moCosto  = activa ? editForm.horasBase * (config.valorHoraInterno || 12000) * factor : 0;
    const moPrecio = Math.round(moCosto * (1 + pct / 100));

    // Repuestos: al cliente al costo (sin markup)
    const repCosto  = editForm.repuestos.reduce((s, r) => s + ((r.montoCosto || r.monto || 0) * (r.cantidad || 1)), 0);
    const repPrecio = repCosto;

    // Fletes: al cliente al costo
    const fleCosto  = (editForm.fletes || []).reduce((s, f) => s + (f.monto || 0), 0);
    const flePrecio = fleCosto;

    // Insumos/terceros: al cliente al costo
    const insCosto  = editForm.insumos.reduce((s, i) => s + ((i.monto || 0) * (i.cantidad || 1)), 0);
    const insPrecio = insCosto;

    const totalCosto  = moCosto + repCosto + fleCosto + insCosto;
    const totalCobrar = moPrecio + repPrecio + flePrecio + insPrecio;
    const margen      = moPrecio - moCosto;
    const rentabilidad = moCosto > 0 ? (margen / moCosto) * 100 : 0;

    return { moCosto, moPrecio, repCosto, repPrecio, fleCosto, flePrecio, insCosto, insPrecio, totalCosto, totalCobrar, margen, rentabilidad };
  }, [editForm, config, margenPct, order.fletes]);

  const guardarProximoControl = (tipoOverride, unidadOverride, valorOverride, esTest = false, testLabel = "") => {
    const tipo  = tipoOverride   ?? proximoTipo;
    const unidad= unidadOverride ?? proximoUnidad;
    const valor = valorOverride  ?? proximoValor;
    if (!tipo || !valor) return;

    const kmBase = bike.kilometrajeActual || bike.km || order.kmIngreso || 0;
    const desc   = tipo === "otro" ? (proximoDesc || "Otro control") : (TIPOS_SERVICIO[tipo] || tipo);

    let rec;
    if (esTest) {
      const ahora = Date.now();
      if (unidad === "minutos") {
        rec = {
          activo: true, origen: "test", tipo, descripcion: desc, unidad: "minutos",
          valorObjetivo: valor,
          kmBase: null, kmObjetivo: null, kmAviso: null,
          fechaBase: new Date(ahora).toISOString().slice(0, 10),
          fechaObjetivo: new Date(ahora + valor * 60000).toISOString(),
          textoOrigen: testLabel,
        };
      } else {
        rec = {
          activo: true, origen: "test", tipo, descripcion: desc, unidad: "km",
          valorObjetivo: valor,
          kmBase, kmObjetivo: kmBase + valor, kmAviso: kmBase + valor,
          fechaBase: null, fechaObjetivo: null,
          textoOrigen: testLabel,
        };
      }
    } else {
      const unidadFinal = unidad === "km" ? "km" : "dias";
      rec = buildProximoControl({ tipo, descripcion: desc, unidad: unidadFinal, valorObjetivo: valor, kmBase, textoOrigen: "" });
    }

    // Guardar en el trabajo
    const patch = {
      proximoControl: rec,
      notasProximoService: desc,
    };
    LS.updateDoc("trabajos", order.id, patch);

    // Crear recordatorio en colección separada
    const clienteId = order.clientId;
    const motoId    = order.bikeId;
    LS.addDoc("recordatorios", {
      trabajoId: order.id,
      clienteId,
      motoId,
      tipo:   "service_" + (rec.unidad === "km" ? "km" : "fecha"),
      subtipo: tipo,
      estado: "pendiente",
      enviado: false,
      testMode: esTest,
      testLabel: esTest ? testLabel : "",
      ...(rec.unidad === "km" ? { kmAviso: rec.kmAviso, kmObjetivo: rec.kmObjetivo } : {}),
      ...(rec.unidad === "minutos" ? { fechaObjetivo: rec.fechaObjetivo, unidad: "minutos" } : {}),
      ...(rec.unidad === "dias" ? { fechaObjetivo: rec.fechaObjetivo } : {}),
      descripcion: desc,
      createdAt: Date.now(),
    });
  };

  const aplicar = () => {
    const nombreTarea = editForm.nombre.trim();
    let nuevasTareas = [...(order.tareas || [])];
    let nuevosRepuestos = [...(order.repuestos || [])];
    let nuevosInsumos = [...(order.insumos || [])];
    const repuestosLimpios = limpiarMateriales(editForm.repuestos);
    const insumosLimpios = limpiarMateriales(editForm.insumos);
    const fletesLimpios = limpiarFletes(editForm.fletes);
    const hayServicio = nombreTarea.length > 0;
    const hayParcial = repuestosLimpios.length > 0 || insumosLimpios.length > 0 || fletesLimpios.length > 0 || !!editForm.observacionesProxima?.trim() || !!proximoTipo;
    let mensajeGuardado = "Presupuesto actualizado ✓";

    if (!hayServicio && !hayParcial) {
      showToast("No hay cambios para guardar");
      return;
    }

    if (hayServicio) {
      const tareaId = nombreTarea.toLowerCase();
      const tareaOriginalId = (serviceToEdit?.nombre || nombreTarea).trim().toLowerCase();
      const repuestosGuardados = repuestosLimpios.map(r => ({ ...r, _tareaId: tareaId }));
      const insumosGuardados = insumosLimpios.map(i => ({ ...i, _tareaId: tareaId }));

      const datosTarea = {
        nombre: nombreTarea,
        monto: stats.moPrecio,
        horasBase: editForm.horasBase,
        dificultad: editForm.dificultad,
        horasReal: editForm.horasBase,
        repuestos: repuestosLimpios,
        insumos: insumosLimpios,
        margenPct,
      };

      const idxPorMeta = typeof serviceToEdit?._editIndex === "number" ? serviceToEdit._editIndex : -1;
      const idx = idxPorMeta >= 0
        ? idxPorMeta
        : nuevasTareas.findIndex(t => t.nombre.trim().toLowerCase() === tareaOriginalId || t.nombre.trim().toLowerCase() === tareaId);

      if (idx !== -1) { nuevasTareas[idx] = datosTarea; mensajeGuardado = "Trabajo actualizado ✓"; }
      else            { nuevasTareas.push(datosTarea);  mensajeGuardado = "Trabajo agregado ✓"; }

      nuevosRepuestos = nuevosRepuestos.filter(r => ![tareaOriginalId, tareaId].includes((r._tareaId || "").trim().toLowerCase()));
      nuevosInsumos = nuevosInsumos.filter(i => ![tareaOriginalId, tareaId].includes((i._tareaId || "").trim().toLowerCase()));
      nuevosRepuestos = [...nuevosRepuestos, ...repuestosGuardados];
      nuevosInsumos = [...nuevosInsumos, ...insumosGuardados];

      // Catálogo: solo datos del servicio
      const existente = catalogData.find(s => s.nombre.trim().toLowerCase() === tareaId);
      const idCat = existente?.id || generateId();
      LS.setDoc("catalogoTareas", idCat, {
        id: idCat,
        nombre: nombreTarea,
        marca: bike.marca || "",
        modelo: bike.modelo || "",
        cilindrada: bike.cilindrada || "",
        horasBase: editForm.horasBase,
        dificultad: editForm.dificultad,
        margenPct,
        repuestos: repuestosLimpios,
        insumos: insumosLimpios,
        observacionesProxima: editForm.observacionesProxima || "",
        proximoControl: proximoTipo && proximoValor
          ? {
              tipo: proximoTipo,
              unidad: proximoUnidad,
              valorObjetivo: proximoValor,
              descripcion: proximoTipo === "otro" ? proximoDesc : (TIPOS_SERVICIO[proximoTipo] || proximoTipo),
            }
          : null,
      });
    } else {
      if (modoEdicion === "repuestos") nuevosRepuestos = repuestosLimpios;
      else if (repuestosLimpios.length) nuevosRepuestos = [...nuevosRepuestos, ...repuestosLimpios.map(r => ({ ...r, _tareaId: "" }))];

      if (modoEdicion === "insumos") nuevosInsumos = insumosLimpios;
      else if (insumosLimpios.length) nuevosInsumos = [...nuevosInsumos, ...insumosLimpios.map(i => ({ ...i, _tareaId: "" }))];
    }

    const nTotal = calcularNuevoTotal(nuevasTareas, nuevosRepuestos, fletesLimpios, nuevosInsumos);
    LS.updateDoc("trabajos", order.id, {
      tareas: nuevasTareas,
      repuestos: nuevosRepuestos,
      insumos: nuevosInsumos,
      fletes: fletesLimpios,
      total: nTotal,
      observacionesProxima: editForm.observacionesProxima || order.observacionesProxima,
    });

    // Guardar próximo control si el usuario seleccionó uno
    if (proximoTipo && proximoValor) {
      guardarProximoControl();
    }

    trackEvent("guardar_trabajo", {
      screen: "gestionarTareas",
      entityType: "trabajo",
      entityId: order.id,
      metadata: {
        tareas: nuevasTareas.length,
        repuestos: nuevosRepuestos.length,
        insumos: nuevosInsumos.length,
        total: nTotal,
      },
    }).catch(console.error);

    showToast(mensajeGuardado);
    setServiceToEdit(null);
    setView("detalleOrden");
  };

  const factor = (config.factorDificultad || CONFIG_DEFAULT.factorDificultad)[editForm.dificultad] || 1;

  return (
    <div className="animate-in slide-in-from-bottom duration-300 bg-zinc-950 px-4 pb-32 pt-4 text-left">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => { setServiceToEdit(null); setView("detalleOrden"); }}
          className="p-3 bg-zinc-900 rounded-2xl border border-white/5 text-white active:scale-90 transition-all">
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-2xl font-black text-white uppercase">Gestionar Tarea</h1>
      </div>

      <div className="space-y-3">

        {/* SECCIÓN 1: SERVICIO */}
        <AccordionSection
          numero="1"
          titulo="Servicio"
          completo={completoServicio()}
          activo={seccionActiva === "servicio"}
          onClick={() => toggleSeccion("servicio")}
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-zinc-400 ml-1">Seleccionar servicio</label>
              <select value={selectedId || ""} onChange={e => handleSelect(e.target.value)}
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm font-black text-white outline-none focus:border-orange-500">
                <option value="">-- Escribir manualmente --</option>
                {serviciosDisponibles.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-zinc-500">Nombre del servicio</label>
              <input value={editForm.nombre} onChange={e => setEditForm({ ...editForm, nombre: e.target.value })}
                placeholder="Ej: Cambio de cubierta"
                className="w-full rounded-[1.5rem] border border-white/10 bg-black/20 p-4 font-black text-white outline-none placeholder:text-zinc-600 focus:border-orange-500"
              />
            </div>

            {sugerencia && (
              <div className={`rounded-[2rem] border p-4 space-y-2 ${sugerencia.confianza?.badge || "bg-zinc-50 border-zinc-200"}`}>
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="flex-shrink-0" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    Sugerencia · {sugerencia.apr.muestras} {sugerencia.apr.muestras === 1 ? "trabajo" : "trabajos"}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-bold opacity-70 uppercase">Promedio real</p>
                    <p className="text-xl font-black">{Math.round(sugerencia.apr.promedio * 10) / 10}h</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold opacity-70 uppercase">Variabilidad</p>
                    <p className="text-sm font-black">±{Math.round(sugerencia.apr.desvio * 10) / 10}h</p>
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border text-[9px] font-black uppercase ${sugerencia.confianza?.badge || ""}`}>
                    {sugerencia.confianza?.texto || "Sin datos"}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="ml-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Horas</label>
                <input type="text" inputMode="decimal" value={editForm.horasBase || ""}
                  onChange={e => {
                    const cleaned = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                    setEditForm({ ...editForm, horasBase: cleaned === "" ? 0 : Number(cleaned) });
                  }}
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-center font-black text-white outline-none focus:border-orange-500" />
              </div>
              <div className="space-y-1">
                <label className="ml-1 text-[9px] font-bold uppercase tracking-widest text-zinc-500">Dificultad</label>
                <select value={editForm.dificultad} onChange={e => setEditForm({ ...editForm, dificultad: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/20 p-3 text-xs font-black uppercase text-white outline-none focus:border-orange-500">
                  <option value="facil">Fácil</option>
                  <option value="normal">Normal</option>
                  <option value="dificil">Difícil</option>
                  <option value="complicado">Complicado</option>
                </select>
              </div>
            </div>

            {completoServicio() && (
              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => abrirSiguiente("servicio")}
                  className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase text-sm active:scale-95 transition-all">
                  Siguiente → Repuestos
                </button>
                <button onClick={aplicar}
                  className="w-full rounded-2xl border border-green-500/40 bg-green-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-green-300 active:scale-95 transition-all">
                  ✓ Guardar y volver
                </button>
              </div>
            )}
          </div>
        </AccordionSection>

        {/* SECCIÓN 2: REPUESTOS */}
        <AccordionSection
          numero="2"
          titulo="Repuestos"
          completo={editForm.repuestos.length > 0}
          activo={seccionActiva === "repuestos"}
          onClick={() => toggleSeccion("repuestos")}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Repuestos y materiales</p>
                <p className="text-[9px] text-zinc-400 font-bold">Se cobran al cliente sin ganancia adicional</p>
              </div>
              <button
                onClick={() => setEditForm({ ...editForm, repuestos: [...editForm.repuestos, { nombre: "", monto: 0, cantidad: 1 }] })}
                className="rounded-xl bg-orange-500/10 p-2 text-orange-400">
                <Plus size={18} />
              </button>
            </div>
            {editForm.repuestos.length === 0 && (
              <p className="text-[10px] text-zinc-400 font-bold text-center py-4 bg-zinc-800/30 rounded-2xl">Sin repuestos cargados</p>
            )}
            {editForm.repuestos.map((item, idx) => (
              <RepuestoConAutocomplete
                key={idx}
                repuesto={item}
                cilindrada={bike.cilindrada}
                onUpdate={(field, value) => updateListItem("repuestos", idx, field, value)}
                onSelect={(rep) => {
                  const updated = editForm.repuestos.map((r, i) => i === idx ? { ...r, nombre: rep.nombre, monto: rep.precio, cantidad: r.cantidad || 1 } : r);
                  setEditForm({ ...editForm, repuestos: updated });
                }}
                onDelete={() => setEditForm({ ...editForm, repuestos: editForm.repuestos.filter((_, i) => i !== idx) })}
              />
            ))}
            {editForm.repuestos.length > 0 && stats.repPrecio > 0 && (
              <div className="flex justify-between border-t border-white/10 px-1 pt-2 text-[10px] font-black">
                <span className="text-zinc-500">Total repuestos</span>
                <span className="text-orange-400">{formatMoney(stats.repPrecio)}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => abrirSiguiente("repuestos")}
                className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase text-sm active:scale-95 transition-all">
                Siguiente → Insumos
              </button>
              <button onClick={aplicar}
                className="w-full rounded-2xl border border-green-500/40 bg-green-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-green-300 active:scale-95 transition-all">
                ✓ Guardar y volver
              </button>
            </div>
          </div>
        </AccordionSection>

        {/* SECCIÓN 3: INSUMOS */}
        <AccordionSection
          numero="3"
          titulo="Insumos / Servicios Externos"
          completo={editForm.insumos.length > 0}
          activo={seccionActiva === "insumos"}
          onClick={() => toggleSeccion("insumos")}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Otros gastos</p>
                <p className="text-[9px] text-zinc-400 font-bold">Se cobran al cliente sin ganancia adicional</p>
              </div>
              <button
                onClick={() => setEditForm({ ...editForm, insumos: [...editForm.insumos, { nombre: "", monto: 0, cantidad: 1 }] })}
                className="rounded-xl bg-orange-500/10 p-2 text-orange-400">
                <Plus size={18} />
              </button>
            </div>
            {editForm.insumos.length === 0 && (
              <p className="text-[10px] text-zinc-400 font-bold text-center py-4 bg-zinc-800/30 rounded-2xl">Sin insumos cargados</p>
            )}
            {editForm.insumos.map((item, idx) => (
              <InsumoConAutocomplete
                key={idx}
                insumo={item}
                cilindrada={bike.cilindrada}
                onUpdate={(field, value) => updateListItem("insumos", idx, field, value)}
                onSelect={(ins) => {
                  const updated = editForm.insumos.map((r, i) => i === idx ? { ...r, nombre: ins.nombre, monto: ins.precio, cantidad: r.cantidad || 1 } : r);
                  setEditForm({ ...editForm, insumos: updated });
                }}
                onDelete={() => setEditForm({ ...editForm, insumos: editForm.insumos.filter((_, i) => i !== idx) })}
              />
            ))}
            {editForm.insumos.length > 0 && stats.insPrecio > 0 && (
              <div className="flex justify-between border-t border-white/10 px-1 pt-2 text-[10px] font-black">
                <span className="text-zinc-500">Total insumos</span>
                <span className="text-orange-400">{formatMoney(stats.insPrecio)}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => abrirSiguiente("insumos")}
                className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase text-sm active:scale-95 transition-all">
                Siguiente → Flete
              </button>
              <button onClick={aplicar}
                className="w-full rounded-2xl border border-green-500/40 bg-green-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-green-300 active:scale-95 transition-all">
                ✓ Guardar y volver
              </button>
            </div>
          </div>
        </AccordionSection>

        {/* SECCIÓN 4: FLETE / CADETERÍA */}
        <AccordionSection
          numero="4"
          titulo="Flete / Cadetería"
          completo={editForm.fletes.length > 0}
          activo={seccionActiva === "fletes"}
          onClick={() => toggleSeccion("fletes")}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Envíos y cadetería</p>
                <p className="text-[9px] text-zinc-400 font-bold">Se cobran al cliente sin ganancia adicional</p>
              </div>
              <button
                onClick={() => setEditForm({ ...editForm, fletes: [...editForm.fletes, { nombre: "", monto: 0 }] })}
                className="rounded-xl bg-purple-500/10 p-2 text-purple-400">
                <Plus size={18} />
              </button>
            </div>
            {editForm.fletes.length === 0 && (
              <p className="text-[10px] text-zinc-400 font-bold text-center py-4 bg-zinc-800/30 rounded-2xl">Sin fletes cargados</p>
            )}
            {editForm.fletes.map((item, idx) => (
              <FleteConAutocomplete
                key={idx}
                flete={item}
                onUpdate={(field, value) => {
                  const updated = editForm.fletes.map((f, i) => i === idx ? { ...f, [field]: value } : f);
                  setEditForm({ ...editForm, fletes: updated });
                }}
                onDelete={() => setEditForm({ ...editForm, fletes: editForm.fletes.filter((_, i) => i !== idx) })}
              />
            ))}
            {editForm.fletes.length > 0 && stats.flePrecio > 0 && (
              <div className="flex justify-between border-t border-white/10 px-1 pt-2 text-[10px] font-black">
                <span className="text-zinc-500">Total flete</span>
                <span className="text-purple-400">{formatMoney(stats.flePrecio)}</span>
              </div>
            )}
            <div className="grid grid-cols-1 gap-2">
              <button onClick={() => abrirSiguiente("fletes")}
                className="w-full bg-orange-600 text-white py-4 rounded-2xl font-black uppercase text-sm active:scale-95 transition-all">
                Siguiente → Observaciones
              </button>
              <button onClick={aplicar}
                className="w-full rounded-2xl border border-green-500/40 bg-green-500/10 py-4 text-[10px] font-black uppercase tracking-widest text-green-300 active:scale-95 transition-all">
                ✓ Guardar y volver
              </button>
            </div>
          </div>
        </AccordionSection>

        {/* SECCIÓN 5: OBSERVACIONES Y PRÓXIMO CONTROL */}
        <AccordionSection
          numero="5"
          titulo="Observaciones y Próximo Control"
          completo={editForm.observacionesProxima.trim().length > 0 || !!proximoTipo}
          activo={seccionActiva === "observaciones"}
          onClick={() => toggleSeccion("observaciones")}
        >
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] uppercase text-zinc-400 ml-1 font-black tracking-widest">Notas para la próxima visita</label>
              <textarea
                value={editForm.observacionesProxima}
                onChange={e => setEditForm({ ...editForm, observacionesProxima: e.target.value })}
                rows="2"
                className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 font-bold text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500"
                placeholder="Ej: Revisar transmisión en 2000km..."
              />
            </div>

            <div className="space-y-5 rounded-[2.5rem] border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-yellow-500" />
                <p className="text-[10px] font-black uppercase text-zinc-700 tracking-widest">Próximo control (opcional)</p>
              </div>
              <p className="text-[10px] text-zinc-400 font-bold -mt-2">Dejá avisado si esta moto tiene que volver por revisión o service</p>

              {deteccion && !proximoTipo && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 space-y-3">
                  <p className="text-[10px] font-black text-yellow-700 uppercase">
                    Detectamos: {deteccion.descripcion} en {deteccion.valorObjetivo} {deteccion.unidad}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => { setProximoTipo(deteccion.tipo); setProximoUnidad(deteccion.unidad); setProximoValor(deteccion.valorObjetivo); setDeteccion(null); }}
                      className="flex-1 bg-yellow-500 text-white py-2.5 rounded-xl font-black text-[10px] uppercase active:scale-95">Usar</button>
                    <button onClick={() => setDeteccion(null)}
                      className="flex-1 bg-zinc-100 text-zinc-600 py-2.5 rounded-xl font-black text-[10px] uppercase active:scale-95">Ignorar</button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Paso 1: qué hay que controlar</p>
                <div className="grid grid-cols-3 gap-2">
                  {TIPOS_RAPIDOS.map(t => (
                    <button key={String(t.id)}
                      onClick={() => { setProximoTipo(t.id); if (!t.id) { setProximoValor(null); setProximoUnidad("km"); setProximoCustom(false); setProximoCustomInput(""); } }}
                      className={`py-3 px-2 rounded-2xl text-[10px] font-black uppercase text-center transition-all active:scale-95 leading-tight ${
                        proximoTipo === t.id ? (t.id ? "bg-yellow-500 text-white" : "bg-zinc-200 text-zinc-700") : "bg-zinc-50 border border-zinc-100 text-zinc-600"
                      }`}>{t.label}
                    </button>
                  ))}
                </div>
              </div>

              {proximoTipo === "otro" && (
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Paso 2: escribí el control</p>
                  <input value={proximoDesc} onChange={e => setProximoDesc(e.target.value)} placeholder="¿Qué hay que controlar?"
                    className="w-full border-2 border-zinc-100 rounded-2xl p-3 text-sm font-bold outline-none focus:border-yellow-500" />
                </div>
              )}

              {proximoTipo && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    {proximoTipo === "otro" ? "Paso 3: cuándo avisar" : "Paso 2: cuándo avisar"}
                  </p>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Por kilómetros</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PLAZOS_KM.map(v => (
                        <button key={v}
                          onClick={() => { setProximoUnidad("km"); setProximoValor(v); setProximoCustom(false); setProximoCustomInput(""); }}
                          className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all active:scale-95 ${
                            proximoUnidad === "km" && proximoValor === v ? "bg-orange-600 text-white" : "bg-zinc-50 border border-zinc-100 text-zinc-600"
                          }`}>{v.toLocaleString("es-AR")} km</button>
                      ))}
                      <button onClick={() => { setProximoUnidad("km"); setProximoValor(null); setProximoCustom(true); setProximoCustomInput(""); }}
                        className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all active:scale-95 ${
                          proximoCustom && proximoUnidad === "km" ? "bg-orange-600 text-white" : "bg-zinc-50 border border-zinc-100 text-zinc-600"
                        }`}>Personalizado</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Por días</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PLAZOS_DIAS.map(v => (
                        <button key={v}
                          onClick={() => { setProximoUnidad("dias"); setProximoValor(v); setProximoCustom(false); setProximoCustomInput(""); }}
                          className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all active:scale-95 ${
                            proximoUnidad === "dias" && proximoValor === v ? "bg-orange-600 text-white" : "bg-zinc-50 border border-zinc-100 text-zinc-600"
                          }`}>{v} días</button>
                      ))}
                      <button onClick={() => { setProximoUnidad("dias"); setProximoValor(null); setProximoCustom(true); setProximoCustomInput(""); }}
                        className={`py-3 rounded-2xl text-[10px] font-black uppercase transition-all active:scale-95 ${
                          proximoCustom && proximoUnidad === "dias" ? "bg-orange-600 text-white" : "bg-zinc-50 border border-zinc-100 text-zinc-600"
                        }`}>Personalizado</button>
                    </div>
                  </div>
                  {proximoCustom && (
                    <div className="grid grid-cols-[1fr_auto] gap-2">
                      <input value={proximoCustomInput} onChange={e => setProximoCustomInput(e.target.value)}
                        placeholder={proximoUnidad === "km" ? "Ej: 1800" : "Ej: 45"}
                        className="w-full border-2 border-zinc-100 rounded-2xl p-3 text-sm font-bold outline-none focus:border-orange-500" />
                      <button onClick={() => { const v = Number(String(proximoCustomInput).replace(/\D/g, "")); if (v) setProximoValor(v); }}
                        className="px-4 rounded-2xl bg-zinc-900 text-white text-[10px] font-black uppercase active:scale-95">Usar</button>
                    </div>
                  )}
                  {proximoValor && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-3 flex items-center justify-between">
                      <p className="text-[10px] font-black text-yellow-800">
                        {proximoTipo === "otro" ? "Paso 4" : "Paso 3"}: {TIPOS_SERVICIO[proximoTipo] || proximoDesc || "Control"} en {proximoValor.toLocaleString("es-AR")} {proximoUnidad === "km" ? "km" : "días"} ✓
                      </p>
                      <button onClick={() => { setProximoTipo(null); setProximoValor(null); setProximoCustom(false); setProximoCustomInput(""); }}
                        className="text-yellow-600 active:scale-90 p-1"><X size={14} /></button>
                    </div>
                  )}
                </div>
              )}

              {testMode && (
                <div className="border-t border-zinc-100 pt-4 space-y-2">
                  <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-1">
                    <span className="bg-purple-500 text-white px-2 py-0.5 rounded text-[8px]">PRUEBA</span>
                    Opciones de test
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PLAZOS_TEST.map(t => (
                      <button key={t.label}
                        onClick={() => { const tipo = proximoTipo || "control_general"; guardarProximoControl(tipo, t.unidad, t.valor, true, t.label); showToast(`Recordatorio de prueba creado: ${t.label} ✓`); }}
                        className="py-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 text-[9px] font-black uppercase active:scale-95 transition-all">
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button onClick={aplicar}
              className="w-full rounded-[2rem] bg-green-600 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-xl transition-all active:scale-95">
              ✓ Guardar y volver
            </button>
          </div>
        </AccordionSection>

      </div>
    </div>
  );
}
