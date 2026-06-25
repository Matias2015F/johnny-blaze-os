# Directiva: useOrderDetailView — extracción de lógica de dominio

## Estado actual

`src/components/OrderDetailView.jsx` (1729 líneas) concentra todo: derivaciones de datos, mutaciones LS, side effects de browser (timer con setInterval, AudioContext), y JSX. Está en `components/` (no en `views/`) porque fue importado por `TallerPanel.jsx` como lazy.

## Criterio de éxito

- `src/hooks/useOrderDetailView.js` contiene toda la lógica de dominio
- `src/components/OrderDetailView.jsx` contiene solo UI state, timer display, sheet state, JSX y navegación
- Build pasa sin errores
- La vista sigue navegando igual (setView) y mostrando toasts

## Frontera exacta

### Va al hook
- `config`, `kmPresets`, `bike`, `client` — derivados de cache LS y props
- `res = calcularResultadosOrden(order)` — useMemo
- `esCierreRechazo`, `isLocked`, `valorHora`, `totalPagado`, `saldoPendiente`, `trabajoLabel`
- `detallePresupuesto`, `totalDetallePresupuesto`, `puedeEditarPresupuesto`
- `currentStepIndex`, `nivelRiesgo`, `canApprove`, `presBase`, `estadoPaso`
- `promedioHoras` — price learning
- Todas las funciones LS: `guardarCliente`, `guardarItemEditado`, `eliminarItem`
- `cambiarEstado(nuevo)` — retorna label o false (view llama showToast)
- `confirmarAprobacion(max)` — LS + trackEvent
- `toggleAprobacion`, `aprobarTodo`
- `startDiag`, `pauseDiag`, `cargarDiag` — retorna horasLabel para toast
- `startTimer`, `pauseTimer`, `stopTimer`, `sinCronometro`
- `guardarProximoControl(params)` — retorna true/false
- `quitarProximoControl()`
- `cerrarPorRechazo(params)` — retorna true/false; view navega + toast
- `marcarPresupuestoEnviado(tipo)` — LS + cambiarEstado + trackEvent
- `buildMensajePresupuesto(sheetParams)` — genera texto WhatsApp; view llama abrirWhatsApp

### Queda en la vista
- `tiempoActual`, `tiempoDiag` + setInterval (display de reloj)
- `ultimoAviso` + AudioContext beep (Web Audio API side effect)
- `clientNombre`, `clientTel`, `editingClient` (UI inline edit)
- Todo el estado de los sheets (showPresupuestoSheet, sheetMin, sheetMax, etc.)
- `rechazoModo`, `rechazoExtraPct`, etc. (estado del sheet de rechazo)
- `editandoItem`, `localConfirm`, `showImprevistoSheet`, etc.
- `unidadProximo`, `kmProximoStr`, `diasProximoStr`
- `accionPrincipal` (contiene setView callbacks)
- `ejecutarPaso`, `abrirSheet`, `abrirRechazoSheet`
- `mensajeAutoSheet` (derivado de sheet state + buildMensajePresupuesto)
- `costoActual`, `estadoCron`, `cronMsg`, `rechazoBaseManoObra`, `rechazoTotal`, `pct`, `restante`
  (todos dependen de tiempoActual/tiempoDiag que es view state)

## Regla de seguridad

NO tocar: `src/App.jsx`, `src/TallerPanel.jsx`, `src/lib/storage.js`, `api/`, `firestore.rules`

## Historial

| Fecha | Commit | Cambio |
|---|---|---|
| 2026-06-25 | — | Directiva creada. Implementación pendiente. |
