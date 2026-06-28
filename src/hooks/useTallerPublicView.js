import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";

export function useTallerPublicView(uid) {
  const [estado, setEstado] = useState("cargando"); // cargando | ok | no_encontrado
  const [taller, setTaller] = useState(null);

  useEffect(() => {
    if (!uid) { setEstado("no_encontrado"); return; }
    getDoc(doc(db, "publicWorkshops", uid))
      .then((snap) => {
        if (!snap.exists() || !snap.data().publicProfileEnabled) {
          setEstado("no_encontrado");
          return;
        }
        setTaller(snap.data());
        setEstado("ok");
      })
      .catch(() => setEstado("no_encontrado"));
  }, [uid]);

  return { estado, taller };
}
