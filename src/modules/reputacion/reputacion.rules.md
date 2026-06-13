# Reputacion Rules

## Qué protege

Protege la validez de calificaciones, tokens y beneficios/descuentos.

## Flujo afectado

Orden cerrada -> calificación -> beneficio -> próxima atención.

## Funciones puras

- `evaluarCalificacion(calificacion)`
- `evaluarBeneficio(beneficio, contexto)`
- `obtenerMotivosBloqueoBeneficio(beneficio, contexto)`
- `isBeneficioAplicableEnOrden(beneficio, orden)`

## Dónde no está aplicada todavía

- No está conectada al flujo real de calificación
- No está conectada al backend público
- No está conectada al cálculo real de descuentos

## Qué falta para integrarla al flujo vivo

- conectar con la emisión real de beneficio
- conectar con la publicación de reseñas
- agregar tests de idoneidad del beneficio
