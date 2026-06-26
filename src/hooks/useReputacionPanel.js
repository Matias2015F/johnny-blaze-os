import { useState, useEffect } from "react";
import { auth, db } from "../firebase.js";
import { collection, getDocsFromServer, query, limit, orderBy, where } from "firebase/firestore";

// Claves Firestore del modelo de calificaciones
const RATING_CAT_KEYS = ["scoreAtencion", "scoreClaridad", "scoreTrabajo", "scoreCumplimiento"];

export function useReputacionPanel() {
  const [ratings, setRatings] = useState(null); // null = cargando
  const [err,     setErr]     = useState(null);

  // Normaliza createdAt a milisegundos para el ordenamiento del fallback
  const toMs = (r) => {
    const v = r?.createdAt;
    if (!v) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "string") return new Date(v).getTime() || 0;
    return v?.toMillis?.() || v?.seconds * 1000 || 0;
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    const run = async () => {
      try {
        // Intenta con ordenamiento + limit. Si falta el índice compuesto, usa fallback.
        const snap = await getDocsFromServer(query(
          collection(db, "ratings"),
          where("uidTaller", "==", auth.currentUser.uid),
          orderBy("createdAt", "desc"),
          limit(60),
        ));
        setRatings(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        const msg = e?.message || String(e || "");
        const isMissingIndex =
          e?.code === "failed-precondition" ||
          msg.toLowerCase().includes("requires an index");
        if (isMissingIndex) {
          try {
            const snap2 = await getDocsFromServer(query(
              collection(db, "ratings"),
              where("uidTaller", "==", auth.currentUser.uid),
            ));
            setRatings(
              snap2.docs
                .map((d) => ({ id: d.id, ...d.data() }))
                .sort((a, b) => toMs(b) - toMs(a))
                .slice(0, 60)
            );
            return;
          } catch (e2) {
            setErr(e2?.message || String(e2 || ""));
            return;
          }
        }
        setErr(msg);
      }
    };
    run();
  }, []);

  // Promedio de un campo numérico de rating (0 excluido)
  const avg = (key) => {
    if (!ratings) return null;
    const vals = ratings.filter((r) => r[key] > 0).map((r) => r[key]);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };

  const ga = ratings ? (() => {
    const avgs = RATING_CAT_KEYS.map(avg).filter((v) => v !== null);
    return avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  })() : null;

  const pr = ratings ? (() => {
    const con = ratings.filter((r) => r.recomienda !== undefined && r.recomienda !== null);
    if (!con.length) return null;
    return Math.round(
      (con.filter((r) => r.recomienda === true || r.recomienda === "si").length / con.length) * 100
    );
  })() : null;

  const pendientes = ratings
    ? ratings.filter((r) => !r.status || r.status === "pendiente_validacion").length
    : 0;

  return { ratings, err, avg, ga, pr, pendientes };
}
