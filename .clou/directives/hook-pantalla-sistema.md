# Directiva: useSistemaActions — extracción de PantallaSistema

## Componente origen

`PantallaSistema` en `src/views/ConfigView.jsx` (~líneas 1540-2005)

## Criterio de éxito

- `src/hooks/useSistemaActions.js` tiene todo el estado async y las 10 acciones de dominio/PWA
- `PantallaSistema` retiene: `showDeleteConfirm`, `deleteConfirmText`, derivados de browser API, wrappers, JSX
- Build pasa sin errores

## Frontera exacta

### Va al hook

| Qué | Por qué |
|---|---|
| `migrando` | loading state compartido entre migrarRaiz y forzarSync |
| `deletingAccount` | loading state de deleteUser |
| `remoteBuild` | dato async de fetchRemoteVersion |
| `checkingUpdate`, `updatingApp` | loading states PWA |
| `installAvailable` | estado del install prompt (browser event) |
| `pushStatus` | estado del service worker push |
| `hasRemoteUpdate` | derivado de remoteBuild (isNewerBuild) |
| `useEffect` de init | bindInstallPromptCapture + fetchRemoteVersion + getPushStatus |
| `migrarRaiz()` → `{ ok, mensaje }` | migrateFromRootCollections |
| `forzarSync()` → `{ ok, mensaje }` | forceSyncCacheToFirestore |
| `toggleTestMode()` → `{ ok, mensaje }` | LS write + setCfg |
| `toggleAnalytics()` → `{ ok, mensaje }` | LS write + setCfg |
| `toggleAlertasNavegador()` → `{ ok, mensaje }` | push subscription + LS write + setCfg |
| `probarNotificacion()` → `{ ok, mensaje }` | sendTestNotification |
| `buscarActualizacion()` → `{ ok, mensaje }` | fetchRemoteVersion + setRemoteBuild |
| `instalarActualizacion()` → `{ ok, mensaje }` | applyRemoteUpdate |
| `instalarApp()` → `{ ok, mensaje }` | promptInstallApp |
| `eliminarCuenta()` → `{ ok, mensaje }` | clearFirestoreData + deleteUser |

### Queda en la vista

| Qué | Por qué |
|---|---|
| `showDeleteConfirm`, `deleteConfirmText` | UI state del modal de confirmación |
| `displayMode = getDisplayModeInfo()` | lectura de browser API, solo display |
| `permissionLabel`, `permisoTexto` | lectura de `window.Notification.permission` |
| `alertasActivas = cfg.alertasNavegadorActivas ?? true` | derivado simple de cfg |
| `isPushSupported()` en JSX | check de capacidad del browser, solo display |
| Todos los `handle*` wrappers | llaman hook action + `showToast(mensaje)` |

## Contrato uniforme — sin toasts, sin throws

Todas las acciones retornan `{ ok: bool, mensaje: string | null }`. La vista llama `showToast(mensaje)` si `mensaje` no es null.

Excepción: `eliminarCuenta()` — si `ok: true`, Firebase Auth cierra sesión automáticamente, no hay toast de éxito.

## Validación que queda en la vista

`handleEliminarCuenta` verifica `deleteConfirmText !== "ELIMINAR"` antes de llamar al hook. El hook asume que la confirmación ya fue validada.

## Imports que se mueven de ConfigView al hook

- `deleteUser` from `"firebase/auth"`
- `migrateFromRootCollections`, `forceSyncCacheToFirestore`, `clearFirestoreData` from `"../lib/storage.js"`
- `applyRemoteUpdate`, `bindInstallPromptCapture`, `canPromptInstall`, `ensureNotificationPermission`, `fetchRemoteVersion`, `isNewerBuild`, `promptInstallApp`, `sendTestNotification` from `"../lib/appUpdate.js"`
- `subscribeToPush`, `unsubscribeFromPush`, `getPushStatus` from `"../lib/pushService.js"`

`getDisplayModeInfo` y `isPushSupported` siguen en ConfigView (usados en JSX de la vista).

## Regla de seguridad

NO tocar: `src/App.jsx`, `src/TallerPanel.jsx`, `src/lib/storage.js`, `src/services/saasService.js`, `api/`, `firestore.rules`

## Historial

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-06-26 | — | Directiva creada |
