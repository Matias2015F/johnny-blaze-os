import { db } from "../firebase.js";
import { auth } from "../firebase.js";
import { doc, runTransaction } from "firebase/firestore";

async function nextContador(col) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sin sesion");
  const ref = doc(db, "users", uid, "counters", col);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const n = (snap.exists() ? (snap.data().ultimo ?? 0) : 0) + 1;
    tx.set(ref, { ultimo: n });
    return n;
  });
}

export async function nextNumeroOT(fallback = 1) {
  try {
    const n = await nextContador("trabajos");
    return `OT-${String(n).padStart(6, "0")}`;
  } catch {
    return `OT-${String(fallback).padStart(6, "0")}`;
  }
}

export async function nextNumeroPRE(fallback = 1) {
  try {
    const n = await nextContador("presupuestos");
    return `PRE-${String(n).padStart(6, "0")}`;
  } catch {
    return `PRE-${String(fallback).padStart(6, "0")}`;
  }
}
