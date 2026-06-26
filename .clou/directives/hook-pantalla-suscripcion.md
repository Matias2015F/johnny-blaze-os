# Directiva: useSuscripcionPanel — extracción de PantallaSuscripcion

## Componente origen

`PantallaSuscripcion` en `src/views/ConfigView.jsx` (~líneas 917-1538)

## Criterio de éxito

- `src/hooks/useSuscripcionPanel.js` contiene toda la lógica de datos, 2 init effects, y 5 acciones de dominio
- `PantallaSuscripcion` retiene solo form state UI, derivados de checkoutPlanKey, wrappers y JSX
- Build pasa sin errores
- ConfigView cleanup: 6 funciones de saasService y 4 funciones de firebase/firestore removidas del import

## Frontera exacta

### Va al hook

| Qué | Por qué |
|---|---|
| `loading`, `account`, `settings`, `invoices` | datos async de Firestore/saasService |
| `sending` | loading state compartido entre 5 acciones async |
| `paymentResult` | leído de URL params en init (no es estado UI, es resultado de redirect) |
| `lastAttempt` | leído de localStorage en init, actualizado por irAPagar |
| `uid` | derivado de `auth.currentUser?.uid`, necesario en varias acciones |
| `planKey`, `planLabel`, `estadoLabel`, `activoHasta`, `previousPlanKey` | derivados de account + settings |
| `latestInvoiceAttempt`, `activeAttempt` (useMemo) | derivados de invoices + lastAttempt |
| `initError` | para propagar el error de cargar() al init effect de la vista |
| `useEffect([uid])` → cargar() | carga datos al montar y cuando cambia uid |
| `useEffect([])` → lee URL params y localStorage | lectura única al montar |
| `persistPaymentAttempt(attempt)` | interno — escribe localStorage + setLastAttempt |
| `irAPagar(planKey)` → `{ ok, url, sandbox, mensaje }` | POST /api/mp-create-preference |
| `solicitarCambioPlan(targetPlanKey)` → `{ ok, mensaje }` | actualizarSuscripcionUsuario |
| `cancelarSuscripcion({ reasonCode, reasonText, comment })` → `{ ok, mensaje }` | POST /api/cancel-plan |
| `enviarReclamo(noteText)` → `{ ok, mensaje }` | crearTicketSoporte |
| `diagnosticarPago()` → `{ ok, mensaje }` | POST /api/mp-diagnose |

### Queda en la vista

| Qué | Por qué |
|---|---|
| `note` | textarea para reclamo — puro form state |
| `checkoutPlanKey` | qué plan está en el modal de confirmación (UI toggle) |
| `cancelOpen` | visibilidad del modal de cancelación (UI) |
| `cancelReasonCode`, `cancelReasonText`, `cancelComment` | form fields del modal de cancelación |
| `abrirConfirmacionPago(planKey)` | `setCheckoutPlanKey(planKey)` — solo UI |
| `cerrarConfirmacionPago()` | `setCheckoutPlanKey(null)` — solo UI |
| `checkoutPlan`, `checkoutPrice` | derivados de `settings` (del hook) + `checkoutPlanKey` (vista) |
| `useEffect([initError])` → `showToast(initError)` | notifica al usuario si el init falla |
| Clipboard copy inline | 4 líneas con browser API, sin lógica de dominio |
| Todos los `handle*` wrappers | llaman hook action + `showToast(mensaje)` |

## Contrato de retorno del hook

- `irAPagar` → `{ ok, url, sandbox, mensaje }` — vista hace `window.location.href = url` y si sandbox muestra toast separado
- `solicitarCambioPlan` → `{ ok, mensaje }` — estándar
- `cancelarSuscripcion` → `{ ok, mensaje }` — vista cierra modal (`setCancelOpen(false)`) si ok
- `enviarReclamo(noteText)` → `{ ok, mensaje }` — vista limpia `note` si ok; valida `!note.trim()` antes de llamar al hook
- `diagnosticarPago` → `{ ok, mensaje }` — estándar

## Imports que se mueven a useSuscripcionPanel.js

De saasService.js:
- `DEFAULT_SAAS_ADMIN_SETTINGS as DEFAULT_ADMIN_SETTINGS`
- `actualizarSuscripcionUsuario`
- `crearTicketSoporte`
- `leerAdminSettings`
- `leerUsuarioSaas`
- `normalizeDateMs`

De firebase/firestore:
- `getDocs` (los demás siguen en ConfigView por PantallaReputacion)

## Imports que se limpian como muertos de ConfigView

Firestore: `doc`, `getDoc`, `setDoc` (movidos a useTallerConfig/useBackupPanel en sesiones anteriores)
saasService: `guardarAdminSettings`, `normalizeAdminSettings`, `normalizeSaasUser`, `isPlatformAdminUser` (nunca se usaron directamente en ConfigView — son para AdminPanelView.jsx)

## Regla de seguridad

NO tocar: `src/services/saasService.js`, `api/mp-create-preference.js`, `api/cancel-plan.js`, `firestore.rules`
Estos archivos son Baseline de Oro. El hook solo las IMPORTA, no las modifica.

## Historial

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-06-26 | — | Directiva creada |
