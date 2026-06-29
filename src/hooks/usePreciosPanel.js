import { useMemo } from "react";
import { useCollection } from "../lib/storage.js";

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

export function usePreciosPanel({ busqueda, ccFiltro }) {
  const _historial = useCollection("precioHistorial");
  const historial = _historial.length > 0
    ? _historial
    : MOCK_INICIAL.map((m, i) => ({ ...m, id: `mock_${i}` }));

  const sugerencias = useMemo(() => {
    const unicas = [...new Set(historial.map((h) => h.tarea))];
    if (!busqueda) return unicas.slice(0, 5);
    return unicas
      .filter((t) => t.includes(busqueda.toUpperCase()) && t !== busqueda.toUpperCase())
      .slice(0, 5);
  }, [busqueda, historial]);

  const { stats, filtrados } = useMemo(() => {
    if (busqueda.length < 2) return { stats: null, filtrados: [] };
    const match = historial.filter((h) => h.tarea.includes(busqueda.toUpperCase()));
    if (!match.length) return { stats: null, filtrados: [] };
    const precios = match.map((h) => h.precio);
    const matchCC = match.filter((h) => Math.abs(h.cilindrada - ccFiltro) <= 50);
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

  return { historial, sugerencias, stats, filtrados };
}
