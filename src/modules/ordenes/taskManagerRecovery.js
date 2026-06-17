const INVALID_ORDER_STATES = new Set(["cancelado", "cancelled", "canceled"]);
const VALID_CONTROL_UNITS = new Set(["km", "dias"]);

export const TASK_MANAGER_STEPS = [
  "trabajo",
  "repuestos",
  "insumos_fletes",
  "proximo_control",
  "resumen",
];

const text = (value) => String(value ?? "").trim();
const normalized = (value) => text(value).toLowerCase();
const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const positiveNumber = (value, fallback = 0) => {
  const number = finiteNumber(value, fallback);
  return number > 0 ? number : fallback;
};
const cloneArray = (items) => Array.isArray(items) ? items.map((item) => ({ ...item })) : [];
const materialFields = ["repuestos", "insumos"];

const stableHash = (value) => {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const recoveryId = (type, recoveryKey, detail = "") =>
  `rec_${type}_${stableHash(`${recoveryKey}|${detail}`)}`;

const orderWorkshopKey = (order = {}, fallbackScope = "") =>
  text(order.workshopUid || order.tallerId || order.workshopId || fallbackScope);

const orderTimestamp = (order = {}) => {
  const raw = order.updatedAt ?? order.createdAt ?? order.fechaIngreso ?? 0;
  if (typeof raw === "number") return raw;
  if (typeof raw?.toMillis === "function") return raw.toMillis();
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const orderSequence = (order = {}) => {
  const match = text(order.numeroTrabajo).match(/\d+/g);
  if (!match) return null;
  const parsed = Number(match.join(""));
  return Number.isFinite(parsed) ? parsed : null;
};

const isPreviousOrder = (sourceOrder = {}, currentOrder = {}) => {
  const sourceTimestamp = orderTimestamp(sourceOrder);
  const currentTimestamp = orderTimestamp(currentOrder);
  if (sourceTimestamp && currentTimestamp) return sourceTimestamp < currentTimestamp;

  const sourceSequence = orderSequence(sourceOrder);
  const currentSequence = orderSequence(currentOrder);
  return sourceSequence != null && currentSequence != null && sourceSequence < currentSequence;
};

const taskMatches = (task = {}, serviceName = "") =>
  normalized(task.nombre || task.descripcion) === normalized(serviceName);

const materialFingerprint = (material = {}) => [
  normalized(material.nombre || material.descripcion),
  positiveNumber(material.cantidad, 1),
  finiteNumber(material.monto ?? material.precio, 0),
  finiteNumber(material.montoCosto ?? material.costo, 0),
].join("|");

const taskReferences = (task = {}) => new Set([
  text(task.id),
  normalized(task.nombre || task.descripcion),
].filter(Boolean));

const isMaterialForTask = (material = {}, task = {}) => {
  const reference = text(material._tareaId || material.tareaId);
  return Boolean(reference && taskReferences(task).has(reference)) ||
    Boolean(reference && taskReferences(task).has(normalized(reference)));
};

const collectTaskMaterials = (sourceOrder = {}, sourceTask = {}, field) => {
  const nested = cloneArray(sourceTask[field]);
  const flat = cloneArray(sourceOrder[field]).filter((item) => isMaterialForTask(item, sourceTask));
  const unique = new Map();

  [...nested, ...flat].forEach((item) => {
    const fingerprint = materialFingerprint(item);
    if (fingerprint.startsWith("|")) return;
    if (!unique.has(fingerprint)) unique.set(fingerprint, item);
  });

  return [...unique.values()];
};

const allTaskReferences = (tasks = []) => new Set(tasks.flatMap((task) => [...taskReferences(task)]));

const collectOrphanMaterials = (sourceOrder = {}) => {
  const knownTaskRefs = allTaskReferences(Array.isArray(sourceOrder.tareas) ? sourceOrder.tareas : []);
  return materialFields.flatMap((field) => cloneArray(sourceOrder[field])
    .filter((material) => {
      const reference = text(material._tareaId || material.tareaId);
      return reference && !knownTaskRefs.has(reference) && !knownTaskRefs.has(normalized(reference));
    })
    .map((material) => ({
      type: field,
      reason: "ORPHAN_LEGACY_MATERIAL",
      name: text(material.nombre || material.descripcion),
      reference: text(material._tareaId || material.tareaId),
    })));
};

const normalizePreviewMaterial = (material = {}, { sourceTaskRef, type, index } = {}) => {
  const nombre = text(material.nombre || material.descripcion);
  const monto = finiteNumber(material.monto ?? material.precio, 0);
  if (!nombre || monto < 0) return null;

  const normalizedMaterial = {
    previewKey: stableHash(`${type}|${sourceTaskRef}|${materialFingerprint(material)}|${index}`),
    sourceMaterialRef: text(material.id) || `${sourceTaskRef}:${type}:${index}:${materialFingerprint(material)}`,
    sourceTaskRef,
    type,
    nombre,
    cantidad: Math.max(1, positiveNumber(material.cantidad, 1)),
    monto,
    aprobacion: "pendiente",
  };

  const montoCosto = finiteNumber(material.montoCosto ?? material.costo, NaN);
  if (Number.isFinite(montoCosto) && montoCosto >= 0) normalizedMaterial.montoCosto = montoCosto;
  return normalizedMaterial;
};

export function normalizarMaterialLegacy(material = {}, { id, taskId } = {}) {
  const nombre = text(material.nombre || material.descripcion);
  const monto = finiteNumber(material.monto ?? material.precio, 0);
  if (!nombre || monto < 0 || !id || !taskId) return null;

  const normalizedMaterial = {
    id,
    nombre,
    cantidad: Math.max(1, positiveNumber(material.cantidad, 1)),
    monto,
    _tareaId: taskId,
    aprobacion: "pendiente",
  };

  const montoCosto = finiteNumber(material.montoCosto ?? material.costo, NaN);
  if (Number.isFinite(montoCosto) && montoCosto >= 0) normalizedMaterial.montoCosto = montoCosto;
  return normalizedMaterial;
}

export function crearBorradorProximoControl(control = {}, { currentBike = {}, currentOrder = {} } = {}) {
  const unidad = text(control.unidad).toLowerCase();
  if (!VALID_CONTROL_UNITS.has(unidad)) return null;

  let valorObjetivo = positiveNumber(control.valorObjetivo, 0);
  if (!valorObjetivo && unidad === "km") {
    const previousTarget = finiteNumber(control.kmObjetivo, 0);
    const previousBase = finiteNumber(control.kmBase, 0);
    valorObjetivo = Math.max(0, previousTarget - previousBase);
  }
  if (!valorObjetivo && unidad === "dias" && control.fechaBase && control.fechaObjetivo) {
    const base = new Date(control.fechaBase).getTime();
    const target = new Date(control.fechaObjetivo).getTime();
    if (Number.isFinite(base) && Number.isFinite(target) && target > base) {
      valorObjetivo = Math.round((target - base) / 86400000);
    }
  }
  if (!valorObjetivo) return null;

  const currentKm = finiteNumber(
    currentBike.kilometrajeActual ?? currentBike.km ?? currentOrder.kmIngreso ?? currentOrder.km,
    0,
  );

  return {
    tipo: text(control.tipo || "service"),
    descripcion: text(control.descripcion || "Service recomendado"),
    unidad,
    valorObjetivo,
    kmBaseActual: unidad === "km" ? currentKm : null,
    origen: "service_anterior",
  };
}

export function buscarServicioAnteriorCompatible({
  currentOrder = {},
  orders = [],
  serviceName = "",
  workshopScopeId = "",
} = {}) {
  const targetWorkshop = orderWorkshopKey(currentOrder, workshopScopeId);
  const targetBikeId = text(currentOrder.bikeId);
  if (!text(currentOrder.id) || !targetWorkshop || !targetBikeId || !normalized(serviceName)) return null;

  return (Array.isArray(orders) ? orders : [])
    .filter((sourceOrder) => {
      if (!sourceOrder || !text(sourceOrder.id) || sourceOrder.id === currentOrder.id) return false;
      if (orderWorkshopKey(sourceOrder, workshopScopeId) !== targetWorkshop) return false;
      if (text(sourceOrder.bikeId) !== targetBikeId) return false;
      if (INVALID_ORDER_STATES.has(normalized(sourceOrder.estado))) return false;
      return isPreviousOrder(sourceOrder, currentOrder);
    })
    .map((sourceOrder) => ({
      sourceOrder,
      sourceTasks: (Array.isArray(sourceOrder.tareas) ? sourceOrder.tareas : [])
        .filter((task) => taskMatches(task, serviceName)),
      timestamp: orderTimestamp(sourceOrder),
    }))
    .filter(({ sourceTasks }) => sourceTasks.length === 1)
    .sort((a, b) => b.timestamp - a.timestamp)
    .map(({ sourceOrder, sourceTasks }) => ({ sourceOrder, sourceTask: sourceTasks[0] }))[0] || null;
}

export function crearBorradorReutilizacion({
  candidate,
  currentOrder = {},
  currentBike = {},
  workshopScopeId = "",
} = {}) {
  if (!candidate?.sourceOrder || !candidate?.sourceTask) {
    return { ok: false, code: "INVALID_RECOVERY_SOURCE" };
  }

  const { sourceOrder, sourceTask } = candidate;
  const sourceWorkshop = orderWorkshopKey(sourceOrder, workshopScopeId);
  const targetWorkshop = orderWorkshopKey(currentOrder, workshopScopeId);
  if (!text(currentOrder.id) || !text(sourceOrder.id) || sourceOrder.id === currentOrder.id) {
    return { ok: false, code: "INVALID_ORDER_IDENTITY" };
  }
  if (!sourceWorkshop || sourceWorkshop !== targetWorkshop || text(sourceOrder.bikeId) !== text(currentOrder.bikeId)) {
    return { ok: false, code: "RECOVERY_SCOPE_MISMATCH" };
  }
  if (currentBike.id && text(currentBike.id) !== text(currentOrder.bikeId)) {
    return { ok: false, code: "CURRENT_BIKE_MISMATCH" };
  }
  if (!isPreviousOrder(sourceOrder, currentOrder)) {
    return { ok: false, code: "SOURCE_ORDER_NOT_PREVIOUS" };
  }

  const nombre = text(sourceTask.nombre || sourceTask.descripcion);
  if (!nombre) return { ok: false, code: "INVALID_SOURCE_TASK" };

  const sourceTaskRef = text(sourceTask.id) || normalized(nombre);
  const recoveryKey = [text(currentOrder.id), text(sourceOrder.id), sourceTaskRef].join(":");
  const task = {
    sourceTaskRef,
    nombre,
    horasBase: positiveNumber(sourceTask.horasBase, 1),
    dificultad: text(sourceTask.dificultad || "normal"),
    monto: Math.max(0, finiteNumber(sourceTask.monto, 0)),
    margenPct: Math.max(0, finiteNumber(sourceTask.margenPct, 0)),
    aprobacion: "pendiente",
  };
  const horasReal = positiveNumber(sourceTask.horasReal, 0);
  if (horasReal) task.horasReal = horasReal;

  const createMaterials = (field) => collectTaskMaterials(sourceOrder, sourceTask, field)
    .map((material, index) => normalizePreviewMaterial(material, {
      sourceTaskRef,
      type: field,
      index,
    }))
    .filter(Boolean);
  const exclusions = [
    ...collectOrphanMaterials(sourceOrder),
    ...["pagos", "saldo", "pdfUrl", "token", "garantia", "total"]
      .filter((field) => sourceOrder[field] != null)
      .map((field) => ({ type: field, reason: "OPERATIONAL_FIELD_EXCLUDED" })),
  ];
  const warnings = exclusions.length
    ? [{ code: "RECOVERY_EXCLUSIONS_DETECTED", count: exclusions.length }]
    : [];
  const conflicts = currentOrder.proximoControl
    ? [{ code: "NEXT_CONTROL_ALREADY_EXISTS" }]
    : [];

  return {
    ok: true,
    recoveryKey,
    source: {
      orderId: text(sourceOrder.id),
      taskId: sourceTaskRef,
      serviceName: nombre,
    },
    task,
    repuestos: createMaterials("repuestos"),
    insumos: createMaterials("insumos"),
    warnings,
    exclusions,
    conflicts,
    nextControlDraft: crearBorradorProximoControl(
      sourceOrder.proximoControl || sourceTask.proximoControl,
      { currentBike, currentOrder },
    ),
  };
}

export function calcularTotalTaskManager({ tareas = [], repuestos = [], insumos = [], fletes = [] } = {}) {
  const allowed = (item) => item?.aprobacion !== "rechazado";
  const taskTotal = tareas.filter(allowed).reduce((sum, item) => sum + finiteNumber(item.monto, 0), 0);
  const materialTotal = (items) => items.filter(allowed).reduce(
    (sum, item) => sum + finiteNumber(item.monto, 0) * Math.max(1, positiveNumber(item.cantidad, 1)),
    0,
  );
  const freightTotal = fletes.filter(allowed).reduce((sum, item) => sum + finiteNumber(item.monto, 0), 0);
  return taskTotal + materialTotal(repuestos) + materialTotal(insumos) + freightTotal;
}

export function integrarBorradorReutilizacion({ currentOrder = {}, draft, calculateTotal } = {}) {
  if (!draft?.ok || !draft.recoveryKey) return { ok: false, code: "INVALID_RECOVERY_DRAFT" };

  const tareas = cloneArray(currentOrder.tareas);
  const repuestos = cloneArray(currentOrder.repuestos);
  const insumos = cloneArray(currentOrder.insumos);
  const fletes = cloneArray(currentOrder.fletes);
  const taskId = recoveryId("task", draft.recoveryKey);
  const alreadyApplied = tareas.some((task) => text(task.id) === taskId);
  if (alreadyApplied) {
    return {
      ok: true,
      applied: false,
      code: "RECOVERY_ALREADY_APPLIED",
      reason: "RECOVERY_ALREADY_APPLIED",
      addedTasks: 0,
      addedMaterials: 0,
      addedAmount: 0,
      addedNextControls: 0,
      patch: null,
    };
  }

  const recoveredTask = { ...draft.task, id: taskId };
  delete recoveredTask.sourceTaskRef;
  const recoverMaterials = (materials = [], type = "material") => cloneArray(materials).map((material, index) => {
    const recovered = normalizarMaterialLegacy(material, {
      id: recoveryId(type, draft.recoveryKey, `${material.sourceMaterialRef || materialFingerprint(material)}|${index}`),
      taskId,
    });
    return recovered;
  }).filter(Boolean);
  const recoveredRepuestos = recoverMaterials(draft.repuestos, "repuestos");
  const recoveredInsumos = recoverMaterials(draft.insumos, "insumos");
  const nextTareas = [...tareas, recoveredTask];
  const nextRepuestos = [...repuestos, ...recoveredRepuestos];
  const nextInsumos = [...insumos, ...recoveredInsumos];
  const totalCalculator = typeof calculateTotal === "function"
    ? calculateTotal
    : (nextTasks, nextParts, nextFreight, nextSupplies) => calcularTotalTaskManager({
      tareas: nextTasks,
      repuestos: nextParts,
      fletes: nextFreight,
      insumos: nextSupplies,
    });
  const patch = {
    tareas: nextTareas,
    repuestos: nextRepuestos,
    insumos: nextInsumos,
    total: totalCalculator(nextTareas, nextRepuestos, fletes, nextInsumos),
  };
  const previousTotal = totalCalculator(tareas, repuestos, fletes, insumos);

  return {
    ok: true,
    applied: true,
    code: "RECOVERY_APPLIED",
    reason: "RECOVERY_APPLIED",
    addedTasks: 1,
    addedMaterials: recoveredRepuestos.length + recoveredInsumos.length,
    addedAmount: patch.total - previousTotal,
    addedNextControls: currentOrder.proximoControl || !draft.nextControlDraft ? 0 : 1,
    patch,
    nextControlDraft: draft.nextControlDraft ? { ...draft.nextControlDraft } : null,
  };
}

export function validarPasoTaskManager(step, state = {}) {
  if (!TASK_MANAGER_STEPS.includes(step)) return { ok: false, code: "UNKNOWN_STEP" };
  if (step === "trabajo") {
    const hasTask = (state.tareas || []).some((task) => text(task?.nombre));
    return hasTask
      ? { ok: true, code: "STEP_VALID" }
      : { ok: false, code: "TASK_REQUIRED", message: "Agrega al menos un trabajo antes de continuar." };
  }
  return { ok: true, code: "STEP_VALID" };
}

export function obtenerPasoSiguiente(step, state = {}) {
  const validation = validarPasoTaskManager(step, state);
  if (!validation.ok) return { ...validation, step };
  const index = TASK_MANAGER_STEPS.indexOf(step);
  return { ok: true, step: TASK_MANAGER_STEPS[Math.min(index + 1, TASK_MANAGER_STEPS.length - 1)] };
}

export function obtenerPasoAnterior(step) {
  const index = TASK_MANAGER_STEPS.indexOf(step);
  if (index < 0) return { ok: false, code: "UNKNOWN_STEP", step };
  return { ok: true, step: TASK_MANAGER_STEPS[Math.max(index - 1, 0)] };
}
