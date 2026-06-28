import { useState, useEffect, useMemo } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db, auth } from "../firebase.js";

function normalizar(value = "") {
  return String(value).trim().toUpperCase();
}

export function useNuevoPresupuesto({ patente, bikes, clients }) {
  const [beneficio, setBeneficio] = useState(null);

  const coincidenciaMoto = useMemo(() => {
    const pat = normalizar(patente);
    if (pat.length < 3) return null;
    const moto = bikes.find((b) => normalizar(b.patenteNormalizada || b.patente) === pat);
    if (!moto) return null;
    const cliente = clients.find((c) => c.id === moto.clienteId) || null;
    return { moto, cliente };
  }, [bikes, clients, patente]);

  useEffect(() => {
    if (!coincidenciaMoto) { setBeneficio(null); return; }
    const pat = normalizar(patente);
    const uid = auth.currentUser?.uid;
    if (!uid || !pat) { setBeneficio(null); return; }
    getDoc(doc(db, "users", uid, "clienteBeneficios", pat))
      .then((snap) => setBeneficio(snap.exists() && snap.data()?.estado === "activo" ? snap.data() : null))
      .catch(() => setBeneficio(null));
  }, [coincidenciaMoto, patente]);

  return { beneficio, coincidenciaMoto };
}
