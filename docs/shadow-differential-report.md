# Shadow Differential Report

## Objetivo

Validar de forma diferencial la logica legacy y la decision sombra sobre un corpus sanitizado de 15 casos, sin escribir datos, sin tocar Firestore, sin backend y sin gobernar el flujo operativo.

## Inventario de casos

1. Orden recien ingresada
2. Presupuesto pendiente
3. Presupuesto aprobado
4. Presupuesto rechazado
5. Adicional pendiente
6. Adicional autorizado
7. Trabajo en progreso
8. Bloqueo por limite presupuestario
9. Finalizada pendiente de cobro
10. Cobrada pendiente de retiro
11. Retirada
12. Cancelada
13. Legacy incompleta
14. Referencias faltantes
15. Estado desconocido o inconsistente

## Resultados sinteticos

- Tamaño del corpus: 15
- Casos comparables: 12
- Casos no comparables: 3
- Casos alineados: 12
- Casos alineados sin ambiguedad: 4
- Divergencias criticas: 0
- Estados conocidos del dominio: BORRADOR, DIAGNOSTICO, PRESUPUESTADO, AUTORIZADO, EN_REPARACION, ESPERANDO_REPUESTOS, PENDIENTE_PAGO, COBRADO_PENDIENTE_RETIRO, LISTO_PARA_ENTREGA, ENTREGADO, CERRADO_CON_PDF, CANCELADO

## Lectura del resultado

No aparecieron divergencias criticas entre legacy y shadow en el corpus actual. Eso significa que la capa sombra esta alineada con el flujo de lectura que hoy resuelve el dominio para PDF y proxima accion.

Lo que si aparece es una separacion clara entre:

- fixtures invalidos o incompletos
- reglas de negocio aun agrupadas bajo una misma decision
- casos completamente alineados

## Reglas ambiguas encontradas

### 1. Estados previos a la entrega

Los estados PRESUPUESTADO, AUTORIZADO, ESPERANDO_REPUESTOS, PENDIENTE_PAGO y LISTO_PARA_ENTREGA siguen convergiendo en la misma salida de bloqueo de PDF por no entrega.

Esto no es una divergencia tecnica, pero si una zona de ambiguedad de negocio si mas adelante se quiere distinguir decisiones operativas finas.

### 2. Estado desconocido o inconsistente

Un estado no canonico se procesa sin escribir nada, pero debe tratarse como regla de negocio no definida hasta que haya una decision formal.

### 3. Fixtures incompletos

Los casos sin cliente, moto o taller no son buenos candidatos para comparar shadow contra legacy como equivalentes funcionales.

## Clasificacion observada

- expected_difference: 0
- legacy_bug: 0
- shadow_bug: 0
- undefined_business_rule: 8
- invalid_fixture: 3
- aligned: 4

Notas:

- `aligned` en el bloque de clasificacion significa "sin divergencia y sin marca de ambiguedad".
- `alignedCases` en el reporte significa "comparables y sin divergencia", aunque algunos casos sigan siendo ambiguos de negocio.

Casos alineados:

- presupuesto rechazado
- cobrada pendiente de retiro
- retirada
- cancelada

## Recomendacion

La capa sombra esta lista para una activacion controlada, pero no para produccion general.

Condicion minima para activar:

- staging o deployment interno
- o allowlist por `workshopUid`
- nunca activar con `VITE_ENABLE_ORDEN_SHADOW_ON_ORDER_DETAIL=true` en produccion general

Motivo: las variables `VITE_*` son globales por deployment. No permiten activar el panel solo para un taller piloto dentro del mismo despliegue publico.

## Conclusiones

- No hay divergencias criticas
- No hay exposicion de datos sensibles en el corpus
- El resultado es determinista
- Las reglas ambiguas ya quedaron documentadas
- La activacion controlada es viable, pero todavia no la generalizacion
- La registry aprobada de negocio vive en `src/modules/ordenes/orden.businessDecisions.js`
- `src/modules/ordenes/orden.shadowPendingRules.js` queda como evidencia historica de la fase anterior
- Las decisiones aprobadas siguen con `operationallyEnforced: false`
