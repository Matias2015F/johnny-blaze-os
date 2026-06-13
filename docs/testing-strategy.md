# Testing Strategy

## Qué se puede testear ahora

- `npm run lint`
- `npm run build`
- validación manual de:
  - login
  - carga de home
  - apertura de orden
  - creación de presupuesto
  - cobro
  - comprobante público
  - vista pública del taller

## Qué falta

- script `npm test`
- tests unitarios para contratos de dominio
- tests de integración para servicios de Firestore
- tests end-to-end de flujos críticos

## Comandos actuales

- `npm run lint`
- `npm run build`
- `npm run check:plans`

## Qué convendría agregar después

- `npm test`
- suites de contratos puros para:
  - órdenes
  - comprobantes
  - reputación
  - SaaS
- pruebas e2e de smoke para login y flujo de orden

## Flujo manual crítico

1. Entrar como usuario.
2. Abrir panel del taller.
3. Crear orden.
4. Pasar a presupuesto.
5. Cobrar.
6. Generar comprobante.
7. Verificar comprobante público.
8. Revisar vista pública.
