import { describe, expect, it } from "vitest";
import {
  TASK_MANAGER_STEPS,
  buscarServicioAnteriorCompatible,
  calcularTotalTaskManager,
  crearBorradorProximoControl,
  crearBorradorReutilizacion,
  integrarBorradorReutilizacion,
  normalizarMaterialLegacy,
  obtenerPasoAnterior,
  obtenerPasoSiguiente,
  validarPasoTaskManager,
} from "./taskManagerRecovery.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

const currentOrder = {
  id: "current-order",
  workshopUid: "workshop-1",
  bikeId: "bike-1",
  createdAt: 200,
  tareas: [{ id: "existing", nombre: "Diagnostico", monto: 1000, aprobacion: "aprobado" }],
  repuestos: [{ id: "existing-r", nombre: "Filtro", cantidad: 1, monto: 500, _tareaId: "existing" }],
  insumos: [],
  fletes: [],
  pagos: [{ id: "payment-current" }],
};

const sourceOrderNested = {
  id: "source-order",
  workshopUid: "workshop-1",
  bikeId: "bike-1",
  createdAt: 100,
  estado: "cerrado",
  total: 999999,
  pagos: [{ id: "payment-old", monto: 8000 }],
  saldo: 0,
  pdfUrl: "private.pdf",
  token: "secret",
  garantia: "emitida",
  tareas: [{
    id: "old-task",
    nombre: "Cambio de aceite",
    horasBase: 1,
    horasReal: 1.2,
    dificultad: "normal",
    monto: 5000,
    margenPct: 25,
    aprobacion: "aprobado",
    repuestos: [{ id: "old-r", nombre: "Aceite", cantidad: 2, monto: 1000 }],
    insumos: [{ id: "old-i", nombre: "Limpia motor", cantidad: 1, monto: 300 }],
  }],
  proximoControl: {
    tipo: "cambio_aceite",
    descripcion: "Cambio de aceite",
    unidad: "km",
    valorObjetivo: 2500,
    kmBase: 10000,
    kmObjetivo: 12500,
  },
};

const buildDraft = (sourceOrder = sourceOrderNested, order = currentOrder) => {
  const candidate = buscarServicioAnteriorCompatible({
    currentOrder: order,
    orders: [sourceOrder],
    serviceName: "Cambio de aceite",
    workshopScopeId: "workshop-1",
  });
  return crearBorradorReutilizacion({
    candidate,
    currentOrder: order,
    currentBike: { id: "bike-1", km: 15000 },
    workshopScopeId: "workshop-1",
  });
};

describe("taskManagerRecovery", () => {
  it("recovers nested materials", () => {
    const draft = buildDraft();
    expect(draft.repuestos).toHaveLength(1);
    expect(draft.insumos).toHaveLength(1);
  });

  it("recovers flat materials associated by historical task id", () => {
    const source = {
      ...sourceOrderNested,
      tareas: [{ ...sourceOrderNested.tareas[0], repuestos: [], insumos: [] }],
      repuestos: [{ nombre: "Aceite", cantidad: 1, monto: 1000, _tareaId: "old-task" }],
      insumos: [{ nombre: "Grasa", cantidad: 1, monto: 200, _tareaId: "old-task" }],
    };
    const draft = buildDraft(source);
    expect(draft.repuestos[0].nombre).toBe("Aceite");
    expect(draft.insumos[0].nombre).toBe("Grasa");
  });

  it("allows tasks without materials", () => {
    const source = { ...sourceOrderNested, tareas: [{ ...sourceOrderNested.tareas[0], repuestos: [], insumos: [] }] };
    const draft = buildDraft(source);
    expect(draft.ok).toBe(true);
    expect(draft.repuestos).toEqual([]);
    expect(draft.insumos).toEqual([]);
  });

  it("ignores orphan flat materials", () => {
    const source = {
      ...sourceOrderNested,
      tareas: [{ ...sourceOrderNested.tareas[0], repuestos: [], insumos: [] }],
      repuestos: [{ nombre: "Orphan", cantidad: 1, monto: 100, _tareaId: "another-task" }],
    };
    expect(buildDraft(source).repuestos).toEqual([]);
  });

  it("creates a new task id", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    expect(result.patch.tareas.at(-1).id).toMatch(/^rec_task_/);
  });

  it("creates new material ids", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    expect(result.patch.repuestos.at(-1).id).toMatch(/^rec_repuestos_/);
    expect(result.patch.insumos.at(-1).id).toMatch(/^rec_insumos_/);
  });

  it("creates stable recovery ids for idempotency across reloads", () => {
    const first = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    const second = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    expect(second.patch.tareas.at(-1).id).toBe(first.patch.tareas.at(-1).id);
    expect(second.patch.repuestos.at(-1).id).toBe(first.patch.repuestos.at(-1).id);
  });

  it("does not reuse historical ids", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    expect(result.patch.tareas.at(-1).id).not.toBe("old-task");
    expect(result.patch.repuestos.at(-1).id).not.toBe("old-r");
    expect(result.patch.insumos.at(-1).id).not.toBe("old-i");
  });

  it("keeps preview plan free of final ids and task-material links", () => {
    const draft = buildDraft();
    expect(draft.task).not.toHaveProperty("id");
    expect(draft.repuestos[0]).not.toHaveProperty("id");
    expect(draft.repuestos[0]).not.toHaveProperty("_tareaId");
    expect(draft.repuestos[0].sourceMaterialRef).toBe("old-r");
  });

  it("associates every material with the new task id", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    const recoveredTaskId = result.patch.tareas.at(-1).id;
    const recoveredMaterials = [
      result.patch.repuestos.at(-1),
      result.patch.insumos.at(-1),
    ];
    expect(recoveredMaterials.every((item) => item._tareaId === recoveredTaskId)).toBe(true);
  });

  it("does not expose payments in the draft", () => {
    expect(buildDraft()).not.toHaveProperty("pagos");
  });

  it("does not expose balances or charges", () => {
    const draft = buildDraft();
    expect(draft).not.toHaveProperty("saldo");
    expect(draft).not.toHaveProperty("cobros");
  });

  it("does not expose pdf fields", () => {
    const draft = buildDraft();
    expect(draft).not.toHaveProperty("pdfUrl");
    expect(draft.task).not.toHaveProperty("pdfUrl");
  });

  it("does not expose tokens", () => {
    expect(JSON.stringify(buildDraft())).not.toContain("secret");
  });

  it("resets historical approval state", () => {
    const draft = buildDraft();
    expect(draft.task.aprobacion).toBe("pendiente");
    expect(draft.repuestos[0].aprobacion).toBe("pendiente");
  });

  it("does not copy emitted warranty", () => {
    expect(buildDraft()).not.toHaveProperty("garantia");
  });

  it("recalculates totals from current and recovered items", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    expect(result.patch.total).toBe(8800);
  });

  it("does not copy the historical consolidated total", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    expect(result.patch.total).not.toBe(sourceOrderNested.total);
  });

  it("does not overwrite current data", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    expect(result.patch.tareas[0]).toEqual(currentOrder.tareas[0]);
    expect(result.patch.repuestos[0]).toEqual(currentOrder.repuestos[0]);
    expect(currentOrder.pagos).toEqual([{ id: "payment-current" }]);
  });

  it("is idempotent when the same recovery is applied twice", () => {
    const draft = buildDraft();
    const first = integrarBorradorReutilizacion({ currentOrder, draft });
    const second = integrarBorradorReutilizacion({ currentOrder: { ...currentOrder, ...first.patch }, draft });
    expect(second.applied).toBe(false);
    expect(second).toMatchObject({
      code: "RECOVERY_ALREADY_APPLIED",
      reason: "RECOVERY_ALREADY_APPLIED",
      addedTasks: 0,
      addedMaterials: 0,
      addedAmount: 0,
      addedNextControls: 0,
      patch: null,
    });
  });

  it("builds next control for the current bike context", () => {
    const draft = buildDraft();
    expect(draft.nextControlDraft.kmBaseActual).toBe(15000);
    expect(draft.nextControlDraft.valorObjetivo).toBe(2500);
  });

  it("preserves an existing next control", () => {
    const existing = { activo: true, unidad: "km", kmObjetivo: 20000 };
    const result = integrarBorradorReutilizacion({
      currentOrder: { ...currentOrder, proximoControl: existing },
      draft: buildDraft(),
    });
    expect(result.patch).not.toHaveProperty("proximoControl");
    expect(result.nextControlDraft).toMatchObject({ unidad: "km", valorObjetivo: 2500 });
  });

  it("never creates an immediate reminder", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    expect(result.patch).not.toHaveProperty("recordatorios");
    expect(result.patch).not.toHaveProperty("recordatorio");
  });

  it("does not mutate the historical source", () => {
    const before = clone(sourceOrderNested);
    buildDraft();
    expect(sourceOrderNested).toEqual(before);
  });

  it("fails safely with incomplete data", () => {
    const result = crearBorradorReutilizacion({ candidate: null });
    expect(result).toEqual({ ok: false, code: "INVALID_RECOVERY_SOURCE" });
  });

  it("ignores unknown material formats", () => {
    const material = normalizarMaterialLegacy({ strange: true }, {
      id: "new-material",
      taskId: "new-task",
    });
    expect(material).toBeNull();
  });

  it("rejects a different workshop", () => {
    const candidate = buscarServicioAnteriorCompatible({
      currentOrder,
      orders: [{ ...sourceOrderNested, workshopUid: "workshop-2" }],
      serviceName: "Cambio de aceite",
      workshopScopeId: "workshop-1",
    });
    expect(candidate).toBeNull();
  });

  it("rejects a different bike even if service name matches", () => {
    const candidate = buscarServicioAnteriorCompatible({
      currentOrder,
      orders: [{ ...sourceOrderNested, bikeId: "bike-2" }],
      serviceName: "Cambio de aceite",
      workshopScopeId: "workshop-1",
    });
    expect(candidate).toBeNull();
  });

  it("uses exact service names instead of partial matches", () => {
    const candidate = buscarServicioAnteriorCompatible({
      currentOrder,
      orders: [sourceOrderNested],
      serviceName: "Cambio",
      workshopScopeId: "workshop-1",
    });
    expect(candidate).toBeNull();
  });

  it("rejects canceled source orders", () => {
    const candidate = buscarServicioAnteriorCompatible({
      currentOrder,
      orders: [{ ...sourceOrderNested, estado: "cancelado" }],
      serviceName: "Cambio de aceite",
      workshopScopeId: "workshop-1",
    });
    expect(candidate).toBeNull();
  });

  it("deduplicates the same material from nested and flat shapes", () => {
    const source = {
      ...sourceOrderNested,
      repuestos: [{ nombre: "Aceite", cantidad: 2, monto: 1000, _tareaId: "old-task" }],
    };
    expect(buildDraft(source).repuestos).toHaveLength(1);
  });

  it("normalizes invalid quantities to one", () => {
    const normalized = normalizarMaterialLegacy({ nombre: "Aceite", monto: 100, cantidad: 0 }, {
      id: "new-material",
      taskId: "new-task",
    });
    expect(normalized.cantidad).toBe(1);
  });

  it("derives a relative kilometer control from historical base and target", () => {
    const control = crearBorradorProximoControl({ unidad: "km", kmBase: 10000, kmObjetivo: 12500 }, {
      currentBike: { km: 18000 },
    });
    expect(control).toMatchObject({ unidad: "km", valorObjetivo: 2500, kmBaseActual: 18000 });
  });

  it("ignores unknown next-control formats", () => {
    expect(crearBorradorProximoControl({ unidad: "months", valorObjetivo: 2 })).toBeNull();
  });

  it("blocks moving forward without a task", () => {
    expect(obtenerPasoSiguiente("trabajo", { tareas: [] })).toMatchObject({ ok: false, code: "TASK_REQUIRED" });
  });

  it("moves forward without mutating state", () => {
    const state = { tareas: [{ nombre: "Service" }], marker: { value: 1 } };
    const before = clone(state);
    expect(obtenerPasoSiguiente("trabajo", state).step).toBe("repuestos");
    expect(state).toEqual(before);
  });

  it("moves backward without mutating state", () => {
    const state = { tareas: [{ nombre: "Service" }] };
    expect(obtenerPasoAnterior("insumos_fletes").step).toBe("repuestos");
    expect(state.tareas).toHaveLength(1);
  });

  it("preserves the canonical step order", () => {
    expect(TASK_MANAGER_STEPS).toEqual([
      "trabajo", "repuestos", "insumos_fletes", "proximo_control", "resumen",
    ]);
    expect(validarPasoTaskManager("resumen", {})).toEqual({ ok: true, code: "STEP_VALID" });
  });

  it("matches current total logic for rejected items", () => {
    expect(calcularTotalTaskManager({
      tareas: [{ monto: 1000 }, { monto: 5000, aprobacion: "rechazado" }],
      repuestos: [{ monto: 100, cantidad: 2 }],
    })).toBe(1200);
  });

  it("recovers mixed nested and flat material shapes", () => {
    const source = {
      ...sourceOrderNested,
      repuestos: [{ nombre: "Filtro", cantidad: 1, monto: 500, _tareaId: "old-task" }],
    };
    const draft = buildDraft(source);
    expect(draft.repuestos.map((item) => item.nombre)).toEqual(["Aceite", "Filtro"]);
  });

  it("handles null and empty legacy collections safely", () => {
    const source = {
      ...sourceOrderNested,
      tareas: [{ ...sourceOrderNested.tareas[0], repuestos: null, insumos: [] }],
      repuestos: null,
      insumos: [],
    };
    const draft = buildDraft(source);
    expect(draft.ok).toBe(true);
    expect(draft.repuestos).toEqual([]);
  });

  it("rejects source orders without verifiable chronology", () => {
    const source = { ...sourceOrderNested };
    const order = { ...currentOrder };
    delete source.createdAt;
    delete order.createdAt;
    expect(buscarServicioAnteriorCompatible({
      currentOrder: order,
      orders: [source],
      serviceName: "Cambio de aceite",
      workshopScopeId: "workshop-1",
    })).toBeNull();
  });

  it("accepts a previous order using sequential work numbers", () => {
    const source = { ...sourceOrderNested, createdAt: null, numeroTrabajo: "OT-000010" };
    const order = { ...currentOrder, createdAt: null, numeroTrabajo: "OT-000011" };
    expect(buscarServicioAnteriorCompatible({
      currentOrder: order,
      orders: [source],
      serviceName: "Cambio de aceite",
      workshopScopeId: "workshop-1",
    })?.sourceOrder.id).toBe("source-order");
  });

  it("rejects missing current or source order identities", () => {
    expect(buscarServicioAnteriorCompatible({
      currentOrder: { ...currentOrder, id: "" },
      orders: [sourceOrderNested],
      serviceName: "Cambio de aceite",
      workshopScopeId: "workshop-1",
    })).toBeNull();
    const candidate = { sourceOrder: { ...sourceOrderNested, id: "" }, sourceTask: sourceOrderNested.tareas[0] };
    expect(crearBorradorReutilizacion({
      candidate,
      currentOrder,
      currentBike: { id: "bike-1" },
      workshopScopeId: "workshop-1",
    }).code).toBe("INVALID_ORDER_IDENTITY");
  });

  it("keeps recovery metadata out of persisted items", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    const recoveredTask = result.patch.tareas.at(-1);
    const recoveredMaterial = result.patch.repuestos.at(-1);
    expect(recoveredTask).not.toHaveProperty("_recoveryKey");
    expect(recoveredTask).not.toHaveProperty("_origenOrdenId");
    expect(recoveredMaterial).not.toHaveProperty("_recoveryKey");
  });

  it("uses the current canonical total calculator when supplied", () => {
    const calculateTotal = (tasks, parts, freight, supplies) =>
      tasks.length * 1000 + parts.length * 100 + freight.length * 10 + supplies.length;
    const result = integrarBorradorReutilizacion({
      currentOrder,
      draft: buildDraft(),
      calculateTotal,
    });
    expect(result.patch.total).toBe(2201);
  });

  it("returns an atomic patch without operational fields", () => {
    const result = integrarBorradorReutilizacion({ currentOrder, draft: buildDraft() });
    expect(Object.keys(result.patch).sort()).toEqual(["insumos", "repuestos", "tareas", "total"]);
  });

  it("reports orphan legacy materials as exclusions without assigning them", () => {
    const source = {
      ...sourceOrderNested,
      tareas: [{ ...sourceOrderNested.tareas[0], repuestos: [], insumos: [] }],
      repuestos: [{ nombre: "Orphan", cantidad: 1, monto: 100, _tareaId: "missing-task" }],
    };
    const draft = buildDraft(source);
    expect(draft.repuestos).toEqual([]);
    expect(draft.exclusions).toContainEqual({
      type: "repuestos",
      reason: "ORPHAN_LEGACY_MATERIAL",
      name: "Orphan",
      reference: "missing-task",
    });
    expect(draft.warnings[0]).toMatchObject({ code: "RECOVERY_EXCLUSIONS_DETECTED" });
  });

  it("keeps same-named materials linked to different destination tasks", () => {
    const makeSource = (taskId, taskName) => ({
      ...sourceOrderNested,
      tareas: [{
        ...sourceOrderNested.tareas[0],
        id: taskId,
        nombre: taskName,
        repuestos: [{ nombre: "Aceite", cantidad: 1, monto: 1000 }],
        insumos: [],
      }],
    });
    const firstDraft = buildDraft(makeSource("task-a", "Cambio de aceite"));
    const first = integrarBorradorReutilizacion({ currentOrder, draft: firstDraft });
    const secondOrder = { ...currentOrder, ...first.patch };
    const secondDraft = buildDraft(makeSource("task-b", "Cambio de aceite"), secondOrder);
    const second = integrarBorradorReutilizacion({ currentOrder: secondOrder, draft: secondDraft });
    const recoveredA = first.patch.tareas.at(-1).id;
    const recoveredB = second.patch.tareas.at(-1).id;
    expect(recoveredA).not.toBe(recoveredB);
    expect(second.patch.repuestos.at(-1)).toMatchObject({ nombre: "Aceite", _tareaId: recoveredB });
  });

  it("reports next-control conflict in the preview plan", () => {
    const draft = buildDraft(sourceOrderNested, {
      ...currentOrder,
      proximoControl: { activo: true, unidad: "km", valorObjetivo: 2500 },
    });
    expect(draft.conflicts).toContainEqual({ code: "NEXT_CONTROL_ALREADY_EXISTS" });
  });
});
