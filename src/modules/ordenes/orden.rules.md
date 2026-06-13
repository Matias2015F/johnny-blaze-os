# Orden Rules

## Qué protege

Protege el ciclo de vida de la orden y el paso a PDF final.

## Flujo afectado

Orden -> retiro -> cierre -> PDF final.

## Funciones puras

- `evaluarEstadoOrden(orden)`
- `evaluarCierreOrden(orden)`
- `evaluarPdfFinal(orden)`
- `obtenerMotivosBloqueoPdf(orden)`
- `obtenerProximaAccionOrden(orden)`

## Dónde no está aplicada todavía

- No está conectada a `OrderDetailView.jsx`
- No está conectada al backend
- No está conectada al PDF real

## Qué falta para integrarla al flujo vivo

- conectar la UI con la capa de reglas
- decidir si el PDF final consume `evaluarPdfFinal`
- agregar tests de contrato y de reglas
