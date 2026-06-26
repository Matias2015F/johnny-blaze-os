# Directiva: useBackupPanel — extracción de PantallaDatos

## Componente origen

`PantallaDatos` en `src/views/ConfigView.jsx` (~líneas 579-944)

## Criterio de éxito

- `src/hooks/useBackupPanel.js` tiene todo el estado async de backups y las tres operaciones de dominio
- `PantallaDatos` retiene: UI state de modales, navegación interna, exports inline, `SubHeader`, JSX
- Build pasa sin errores

## Frontera exacta

### Va al hook

| Qué | Por qué |
|---|---|
| `backups`, `loadingBackups` | gestionados por operación async |
| `guardandoBkp` | loading state de operación de nube |
| `restaurando` | id del backup en proceso |
| `restoreStateInfo` | dato de dominio leído de Firestore |
| `cargarBackups()` | lee Firestore (cloudBackup + restoreState) |
| `guardarEnNube()` | llama createCloudBackup, refresca lista |
| `ejecutarRestauracion(backup)` | llama restoreCloudBackup |

### Queda en la vista

| Qué | Por qué |
|---|---|
| `cloudRestoreConfirm` | UI: qué backup mostrar en modal de confirmación |
| `confirmText` | UI: texto que tipea el usuario para confirmar |
| `integrityResult` | resultado sync de runIntegrityCheckFromCache(), sin estado async |
| `datosView` | navegación entre sub-vistas |
| `useEffect` de init | llama `cargarBackups()` y toastea el error si hay |
| Handlers de export (`exportarOrdenes`, etc.) | one-liners con showToast, no tienen lógica de dominio |
| `SubHeader` component definition | UI puro |
| `handleRestaurarNube(backup)` | solo setea UI state (cloudRestoreConfirm) |

## Contrato de retorno del hook — sin toasts, sin throws

Las tres funciones async retornan `{ ok, mensaje }`. La vista llama `showToast(mensaje)` siempre. Nunca lanzan excepciones al exterior.

```js
// cargarBackups() → string | null  (null = sin error)
// guardarEnNube() → { ok: bool, mensaje: string }
// ejecutarRestauracion(backup) → { ok: bool, mensaje: string }
```

## Props que PantallaDatos recibe del padre y no cambian

- `fileInputRef`, `handleRestaurarArchivo`, `handleRestaurarAuto` — vienen de ConfigView root
- `bkpEstado`, `setBkpEstado` — idem; se actualizan con `estadoBackup()` al descargar backup local

## Regla de seguridad

NO tocar: `src/App.jsx`, `src/TallerPanel.jsx`, `src/lib/storage.js`, `src/services/saasService.js`, `api/`, `firestore.rules`

## Historial

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-06-25 | — | Directiva creada |
