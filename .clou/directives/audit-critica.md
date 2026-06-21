# Directiva P7 — Auditoría de acciones críticas

**Fecha:** 2026-06-21  
**Feature:** CONSEJO03 P1  
**Estado:** DECIDED → por implementar

---

## Estado actual de la zona a modificar

- `adminAuditService.js` existe y loguea acciones del **admin** en `adminAuditLogs` (colección raíz). No aplica a acciones del mecánico.
- Las acciones críticas del taller (crear OT, cobrar, eliminar) no dejan rastro inmutable en Firestore hoy.
- `users/{uid}/{document=**}` en firestore.rules cubre todo con `read, write: if isOwner(uid)` — incluyendo el futuro `auditLogs`. Problema: permite update/delete de logs desde el cliente.
- `DATA_COLS` en storage.js NO incluirá `auditLogs` — los logs no deben entrar en el cache de LS ni borrarse con `clearFirestoreData`.

## Criterio de éxito

Después de cada acción crítica del mecánico, aparece un documento en `users/{uid}/auditLogs/{autoId}` con:

```js
{
  action: "orden_creada" | "orden_cerrada" | "pago_registrado" | "orden_eliminada" | "presupuesto_creado",
  targetId: string,    // id del doc afectado
  targetType: "trabajo" | "presupuesto" | "pago",
  meta: {},            // campos relevantes (numeroTrabajo, monto, etc.)
  uid: string,         // uid del mecánico
  ip: null,            // siempre null desde el frontend (no disponible client-side)
  ts: number,          // Date.now()
  createdAt: serverTimestamp()
}
```

Los logs son **append-only desde el cliente** (create OK, update/delete solo admin).  
Son **invisibles para el mecánico** (sin UI propia — admin los lee por Firebase Console).  
Son **fire-and-forget** (nunca bloquean la acción del usuario, errores silenciosos).

## Acciones a instrumentar — 5 puntos

| Acción | Archivo | Momento |
|---|---|---|
| `orden_creada` | `TallerPanel.jsx` — en `handleCreateAll` post `LS.addDoc("trabajos", ...)` | Al crear OT |
| `pago_registrado` | `PagoView.jsx` — al registrar cobro en caja | Al cobrar |
| `orden_cerrada` | `ExportPdfView.jsx` — al emitir comprobante (estado → `cerrado_emitido`) | Al cerrar OT |
| `presupuesto_creado` | `NuevoPresupuestoView.jsx` — post `LS.addDoc("presupuestos", ...)` | Al crear PRE |
| `orden_eliminada` | donde `LS.deleteDoc("trabajos", ...)` se llame | Al borrar OT |

## Archivos a crear / modificar

| Archivo | Cambio |
|---|---|
| `src/services/auditService.js` | NUEVO — `logAction(action, targetId, targetType, meta)` |
| `firestore.rules` | Agregar regla explícita para `users/{uid}/auditLogs/{logId}`: create si `isOwner(uid) && data.uid == uid`, read si `isOwner || admin`, update/delete solo admin |
| `TallerPanel.jsx` | Importar `logAction` y llamarlo en `handleCreateAll` (baseline protegido — cirugía mínima) |
| `PagoView.jsx` | Importar y llamar `logAction` al registrar cobro |
| `ExportPdfView.jsx` | Llamar `logAction("orden_cerrada")` al emitir comprobante |
| `NuevoPresupuestoView.jsx` | Llamar `logAction` al crear presupuesto |

## Regla de seguridad — qué NO se toca

- La lógica de `noModificaCamposSuscripcion()` en firestore.rules no se modifica.
- `LS` (storage.js) no se modifica — los logs van directo a Firestore vía `addDoc`, no por LS.
- `DATA_COLS` no se modifica — `auditLogs` no debe estar ahí.
- `App.jsx`, `saasService.js`, `mp-webhook.js`, `mp-create-preference.js` quedan intactos.

## Plan de implementación

1. Backup (`scripts/backup.sh`)
2. Crear `src/services/auditService.js`
3. Actualizar `firestore.rules` — agregar bloque `auditLogs`
4. `firebase deploy --only firestore:rules`
5. Grep `handleCreateAll` en TallerPanel para encontrar el punto exacto y agregar `logAction`
6. Grep de registrar pago en PagoView
7. Grep del punto de cierre en ExportPdfView
8. Grep de creación en NuevoPresupuestoView
9. Grep de deleteDoc("trabajos") para orden_eliminada
10. `npm run build` + `npm run lint`
11. Prueba funcional: crear OT, verificar en Firebase Console que aparece el log
12. Commit + push + deploy + verificación `version.json`

## Historial

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-06-21 | — | Directiva creada, pendiente aprobación |
