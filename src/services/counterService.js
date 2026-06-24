import { db } from "../firebase.js";
import { auth } from "../firebase.js";
import { doc, runTransaction } from "firebase/firestore";

const COUNTER_MAX_RETRIES = 3;
const COUNTER_RETRY_BASE_MS = 500;

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

async function nextContadorConRetry(col) {
  let lastErr;
  for (let i = 0; i < COUNTER_MAX_RETRIES; i++) {
    try {
      return await nextContador(col);
    } catch (err) {
      lastErr = err;
      if (i < COUNTER_MAX_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, COUNTER_RETRY_BASE_MS * (i + 1)));
      }
    }
  }
  throw lastErr;
}

function offlineId() {
  return Date.now().toString(36).toUpperCase().slice(-5);
}

export async function nextNumeroOT() {
  try {
    const n = await nextContadorConRetry("trabajos");
    return `OT-${String(n).padStart(6, "0")}`;
  } catch (err) {
    console.error("[counterService] nextNumeroOT offline fallback:", err?.message);
    return `OT-S${offlineId()}`;
  }
}

export async function nextNumeroPRE() {
  try {
    const n = await nextContadorConRetry("presupuestos");
    return `PRE-${String(n).padStart(6, "0")}`;
  } catch (err) {
    console.error("[counterService] nextNumeroPRE offline fallback:", err?.message);
    return `PRE-S${offlineId()}`;
  }
}
