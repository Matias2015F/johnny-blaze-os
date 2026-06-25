import { useMemo, useState } from "react";
import { LS } from "../lib/storage.js";
import { CONFIG_DEFAULT } from "../lib/constants.js";

function normalizar(value = "") {
  return String(value).trim().toUpperCase();
}

export function useNewOrderView({ bikes, clients, prefill }) {
  const [f, setF] = useState({
    nombre:     prefill?.client?.nombre      || "",
    tel:        prefill?.client?.tel         || "",
    patente:    prefill?.bike?.patente       || "",
    marca:      prefill?.bike?.marca         || "",
    modelo:     prefill?.bike?.modelo        || "",
    cilindrada: prefill?.bike?.cilindrada    || 110,
    km:         prefill?.bike?.km            || "",
    falla: "",
  });

  const [ignorarSugerencia, setIgnorarSugerencia] = useState(false);
  const [listaAbierta,      setListaAbierta]      = useState(false);
  const [nuevoMotivo,       setNuevoMotivo]       = useState("");
  const [editandoIdx,       setEditandoIdx]       = useState(null);
  const [editandoTexto,     setEditandoTexto]     = useState("");

  // ── Config de motivos — lectura sincrónica del cache ─────────────────────────

  const motivosList = useMemo(() => {
    const config = LS.getDoc("config", "global") || CONFIG_DEFAULT;
    return config.motivosIngreso || CONFIG_DEFAULT.motivosIngreso;
  }, []);

  // ── Coincidencia de patente — dominio ────────────────────────────────────────

  const coincidenciaMoto = useMemo(() => {
    if (prefill) return null;
    const patente = normalizar(f.patente);
    if (patente.length < 3) return null;
    const moto    = bikes.find((b) => normalizar(b.patenteNormalizada || b.patente) === patente);
    if (!moto) return null;
    const cliente = clients.find((c) => c.id === moto.clienteId) || null;
    return { moto, cliente };
  }, [bikes, clients, f.patente, prefill]);

  const showSuggestion = !!coincidenciaMoto && !ignorarSugerencia;

  // ── Acciones de dominio ──────────────────────────────────────────────────────

  const usarHistorial = () => {
    if (!coincidenciaMoto) return;
    setF((prev) => ({
      ...prev,
      marca:      coincidenciaMoto.moto?.marca      || prev.marca,
      modelo:     coincidenciaMoto.moto?.modelo     || prev.modelo,
      cilindrada: coincidenciaMoto.moto?.cilindrada || prev.cilindrada,
      nombre:     coincidenciaMoto.cliente?.nombre  || prev.nombre,
      tel:        coincidenciaMoto.cliente?.tel || coincidenciaMoto.cliente?.telefono || prev.tel,
      km:         prev.km || coincidenciaMoto.moto?.kilometrajeActual || coincidenciaMoto.moto?.km || "",
    }));
    setIgnorarSugerencia(false);
  };

  const agregarChip = (texto) => {
    setF((prev) => {
      const actual = prev.falla.trim();
      if (!actual) return { ...prev, falla: texto };
      if (actual.includes(texto)) return prev;
      return { ...prev, falla: actual + ", " + texto };
    });
  };

  // Escribe lista de motivos al config persistido
  const guardarMotivos = (lista) => {
    LS.updateDoc("config", "global", { motivosIngreso: lista });
  };

  const agregarMotivo = () => {
    const texto = nuevoMotivo.trim();
    if (!texto || motivosList.includes(texto)) return;
    guardarMotivos([...motivosList, texto]);
    setNuevoMotivo("");
  };

  const confirmarEdicion = (idx) => {
    const texto = editandoTexto.trim();
    if (!texto) return;
    const nueva = [...motivosList];
    nueva[idx] = texto;
    guardarMotivos(nueva);
    setEditandoIdx(null);
    setEditandoTexto("");
  };

  const eliminarMotivo = (idx) => {
    guardarMotivos(motivosList.filter((_, i) => i !== idx));
  };

  // Permite que el dictado de voz (Web Speech API, gestionado por la vista)
  // escriba en el campo falla sin acceder directamente al estado del hook
  const appendToFalla = (texto) => {
    setF((prev) => ({
      ...prev,
      falla: prev.falla ? prev.falla + " " + texto : texto,
    }));
  };

  // ── API pública ──────────────────────────────────────────────────────────────

  return {
    // Form state
    f, setF,
    // Sugerencia de historial
    showSuggestion, coincidenciaMoto,
    setIgnorarSugerencia,
    usarHistorial,
    // Campo falla
    agregarChip, appendToFalla,
    // Motivos dropdown
    motivosList,
    listaAbierta, setListaAbierta,
    nuevoMotivo, setNuevoMotivo, agregarMotivo,
    editandoIdx, setEditandoIdx,
    editandoTexto, setEditandoTexto, confirmarEdicion,
    eliminarMotivo,
  };
}
