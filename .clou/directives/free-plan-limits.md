## ID y Estado
free-plan-limits - CAPTACION-001-B en implementacion

## Objetivo principal
Alinear el contrato comercial del Plan Free con el runtime real de la app, el panel admin,
el copy base y la documentacion de estado.

## Decision comercial vigente
Plan Free:
- 30 dias de prueba.
- 1 usuario / duenio del taller.
- Hasta 10 clientes.
- Hasta 10 motos.
- Hasta 10 ordenes.
- Hasta 10 presupuestos.
- Hasta 10 comprobantes.
- Todas las funciones habilitadas.
- Sin tarjeta.
- Sin publicidad.

## Estado actual antes del cambio
- `src/services/usageLimitService.js` enforcea limites distintos:
  - 60 clientes.
  - 60 motos.
  - 20 trabajos.
  - 20 presupuestos.
  - 15 comprobantes.
- `TallerPanel.jsx` consume `canUseFreeResource()` para bloquear creacion de ordenes y
  presupuestos.
- `AdminPanelView.jsx` lee `FREE_PLAN_LIMITS` para alertas de uso Free.
- `index.html` y `api/send-welcome.js` todavia tienen fallback/copy heredado de 14 dias.
- `docs/landing.html` contiene copy viejo de Trial ilimitado y precio Base desactualizado.

## Criterio de exito
- El codigo central expone `FREE_PLAN_LIMITS` con valor 10 para:
  - trabajosTotal.
  - presupuestosTotal.
  - clientesTotal.
  - motosTotal.
  - comprobantesEmitidos.
- Crear orden o presupuesto en modo Free bloquea solo si la accion superaria algun limite.
- Usar cliente/moto existente no debe bloquear por estar en el limite de clientes/motos.
- Abrir emision de comprobante queda bloqueado si ya se alcanzo el limite de comprobantes.
- AdminPanelView sigue leyendo la misma constante central.
- Copy base de app/email/docs no contradice el trial de 30 dias ni promete uso ilimitado.

## Regla de seguridad
- No tocar `resolveSaasAccess`, estados de suscripcion ni logica de pagos.
- No tocar Mercado Pago, webhook ni precios de planes pagos salvo copy/documentacion desfasada.
- No crear archivos nuevos en `api/`.
- No modificar `firestore.rules`.

## Plan de implementacion
1. Actualizar `FREE_PLAN_LIMITS` a 10.
2. Agregar preview sin escritura para saber si una orden/presupuesto creara cliente o moto.
3. Permitir que `canUseFreeResource()` reciba deltas prospectivos por recurso.
4. Conectar el limite de comprobantes al view `prePdf`.
5. Actualizar copy heredado de 14 dias a 30 dias.
6. Actualizar documentacion/estado del ticket.
7. Validar con build, lint y diff.

## Historial de cambios
| Fecha | Commit | Cambio |
|---|---|---|
| 2026-07-05 | pendiente | Directiva creada para CAPTACION-001-B. |
