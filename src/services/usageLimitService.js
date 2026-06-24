import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

export const FREE_PLAN_LIMITS = {
  trabajosTotal: 20,
  presupuestosTotal: 20,
  clientesTotal: 60,
  motosTotal: 60,
  comprobantesEmitidos: 15,
};

const RESOURCE_LABELS = {
  trabajosTotal: "trabajos",
  presupuestosTotal: "presupuestos",
  clientesTotal: "clientes",
  motosTotal: "motos",
  comprobantesEmitidos: "comprobantes emitidos",
};

const RESOURCE_ACTION_MAP = {
  nuevaOrden: ["trabajosTotal", "clientesTotal", "motosTotal"],
  nuevoPresupuesto: ["presupuestosTotal", "clientesTotal", "motosTotal"],
  emitirComprobante: ["comprobantesEmitidos"],
};

function todayKey() {
  return new Date().toLocaleDateString("sv-SE");
}

function countCurrentMonth(items = []) {
  const month = todayKey().slice(0, 7);
  return items.filter((item) => String(item.fechaIngreso || item.createdAt || "").startsWith(month)).length;
}

export function isFreeAccount(account = {}) {
  const estado = String(account?.estado || "").toLowerCase();
  const plan = String(account?.plan || "").toLowerCase();
  if (account?.rol === "admin" || account?.isPlatformAdmin) return false;
  if (estado === "activo" || estado === "gracia") return false;
  return estado === "trial" || plan === "trial";
}

export function buildUsageSnapshot({ account, orders = [], bikes = [], clients = [], presupuestos = [] }) {
  const counts = {
    trabajosTotal: orders.length,
    trabajosMes: countCurrentMonth(orders),
    presupuestosTotal: presupuestos.length,
    clientesTotal: clients.length,
    motosTotal: bikes.length,
    comprobantesEmitidos: orders.filter((order) =>
      order.numeroComprobante || order.receiptToken || order.pdfEntregado || order.estado === "cerrado_emitido"
    ).length,
  };

  return {
    uid: account?.uid || auth.currentUser?.uid || "",
    email: account?.email || auth.currentUser?.email || "",
    accountId: account?.uid || auth.currentUser?.uid || "",
    fecha: todayKey(),
    estado: account?.estado || "",
    plan: account?.currentPlanKey || account?.plan || "",
    freeMode: isFreeAccount(account),
    counts,
    limits: FREE_PLAN_LIMITS,
    estimatedInitialReads: counts.trabajosTotal + counts.presupuestosTotal + counts.clientesTotal + counts.motosTotal + counts.comprobantesEmitidos + 10,
  };
}

export function getFreeUsageStatus(account, snapshot) {
  if (!snapshot || !isFreeAccount(account)) {
    return { freeMode: false, blocked: false, warnings: [], blocks: [], maxPercent: 0 };
  }

  const warnings = [];
  const blocks = [];
  let maxPercent = 0;

  for (const [key, limit] of Object.entries(FREE_PLAN_LIMITS)) {
    const used = Number(snapshot.counts?.[key] || 0);
    const percent = limit > 0 ? Math.round((used / limit) * 100) : 0;
    maxPercent = Math.max(maxPercent, percent);

    if (used >= limit) {
      blocks.push({ key, used, limit, label: RESOURCE_LABELS[key] || key });
    } else if (percent >= 80) {
      warnings.push({ key, used, limit, label: RESOURCE_LABELS[key] || key });
    }
  }

  return {
    freeMode: true,
    blocked: blocks.length > 0,
    warnings,
    blocks,
    maxPercent,
  };
}

export function canUseFreeResource(account, snapshot, action) {
  const status = getFreeUsageStatus(account, snapshot);
  if (!status.freeMode) return { ok: true, status };

  const resourceKeys = RESOURCE_ACTION_MAP[action];
  if (!resourceKeys?.length) return { ok: true, status };

  const blockedKey = resourceKeys.find((key) => {
    const limit = FREE_PLAN_LIMITS[key];
    const used = Number(snapshot?.counts?.[key] || 0);
    return limit && used >= limit;
  });

  if (blockedKey) {
    const limit = FREE_PLAN_LIMITS[blockedKey];
    const used = Number(snapshot?.counts?.[blockedKey] || 0);
    return {
      ok: false,
      status,
      message: `Modo free: limite de ${RESOURCE_LABELS[blockedKey]} alcanzado (${used}/${limit}). Activa un plan para seguir creando.`,
    };
  }

  return { ok: true, status };
}

export async function persistUsageSnapshot(snapshot) {
  const uid = snapshot?.uid || auth.currentUser?.uid;
  if (!uid || !snapshot?.fecha) return;

  const cacheKey = `jbos_usage_snapshot_${uid}_${snapshot.fecha}`;
  const compact = JSON.stringify({
    counts: snapshot.counts,
    estado: snapshot.estado,
    plan: snapshot.plan,
    freeMode: snapshot.freeMode,
  });

  try {
    if (window.localStorage.getItem(cacheKey) === compact) return;
    window.localStorage.setItem(cacheKey, compact);
  } catch {
    // If storage is unavailable, still try to persist remotely.
  }

  await setDoc(doc(db, "usageSnapshots", `${uid}_${snapshot.fecha}`), {
    ...snapshot,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}
