# Directiva Fase 2 — Estabilidad de sincronización

**Fecha:** 2026-06-21  
**Feature:** Fase 2 mejoras estabilidad  
**Estado:** por implementar

---

## Estado actual de la zona a modificar

- `useSyncStatus()` en `storage.js` emite "syncing" | "error" | "synced" — funcionando.
- Indicador en nav (`TallerPanel.jsx` línea 898-901): dot de 6px + texto de 8px, no es tappable, sin timestamp.
- `forceSyncCacheToFirestore(uid)` existe en `storage.js` y está conectada en `ConfigView.jsx:1648` (handleForzarSync).
- No existe tracking de cuándo fue el último sync exitoso.

## Criterio de éxito

1. **Error prominente:** cuando `syncStatus === "error"`, el indicador del nav se convierte en un chip rojo más visible (no solo 8px) con texto "Error — tocar para reintentar".
2. **Botón forzar sync:** tocar el chip en estado error llama `forceSyncCacheToFirestore` directamente desde el nav, sin ir a Config.
3. **Última sync OK:** cuando `syncStatus === "synced"`, el chip muestra la hora del último guardado exitoso (ej. "Guardado 14:32").

## Archivos a modificar — mínimo quirúrgico

| Archivo | Cambio |
|---|---|
| `src/lib/storage.js` | Agregar `_lastSyncedAt: null`, actualizar en `fsWrite` cuando termina sin error. Exportar `getLastSyncedAt()` y hacer que `notifySync` incluya el timestamp. |
| `src/TallerPanel.jsx` | Importar `forceSyncCacheToFirestore` + `getLastSyncedAt`. Hacer el indicador de nav tappable en estado error. Mostrar hora en estado synced. |

## Regla de seguridad — qué NO se toca

- La lógica interna de `fsWrite`, `_pending`, `_syncError` no se altera — solo se agrega tracking de timestamp.
- No se modifica el flujo de reintentos de `fsWrite`.
- `ConfigView.jsx` no se toca — el botón de Config queda como está.
- `App.jsx`, `saasService.js`, `mp-webhook.js` intactos.

## Plan de implementación

1. `storage.js` — agregar `_lastSyncedAt`, actualizarlo en `fsWrite` cuando `lastErr === null`, exportar `getLastSyncedAt()`.
2. `TallerPanel.jsx` — agregar import `forceSyncCacheToFirestore`, `getLastSyncedAt`. Reemplazar el `<div>` del indicador por un elemento interactivo que muestre la hora + llame forceSync en error.
3. `npm run build` + `npm run lint`
4. Prueba funcional: desconectar internet, hacer un cambio, verificar que aparece el error prominente y que el botón reinicia el sync.
5. Commit + push + deploy + verificar version.json

## Historial

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-06-21 | — | Directiva creada, pendiente aprobación |
