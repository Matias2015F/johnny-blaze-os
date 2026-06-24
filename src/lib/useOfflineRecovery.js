import { useEffect } from "react";
import { LS } from "./storage.js";
import { nextNumeroOT, nextNumeroPRE } from "../services/counterService.js";

async function renumberOfflineDocs() {
  const trabajos = (LS.getAll("trabajos") || []).filter(
    (t) => String(t.numeroTrabajo || "").startsWith("OT-S")
  );
  for (const t of trabajos) {
    try {
      const nuevo = await nextNumeroOT();
      LS.updateDoc("trabajos", t.id, { numeroTrabajo: nuevo });
    } catch {}
  }

  const presupuestos = (LS.getAll("presupuestos") || []).filter(
    (p) => String(p.numeroPresupuesto || "").startsWith("PRE-S")
  );
  for (const p of presupuestos) {
    try {
      const nuevo = await nextNumeroPRE();
      LS.updateDoc("presupuestos", p.id, { numeroPresupuesto: nuevo });
    } catch {}
  }
}

export function useOfflineRecovery() {
  useEffect(() => {
    if (navigator.onLine) renumberOfflineDocs();
    window.addEventListener("online", renumberOfflineDocs);
    return () => window.removeEventListener("online", renumberOfflineDocs);
  }, []);
}
