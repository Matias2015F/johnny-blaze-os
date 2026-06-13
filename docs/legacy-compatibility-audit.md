# Legacy Compatibility Audit

Este documento describe la capa de auditoria de compatibilidad para snapshots legacy de ordenes.

## Objetivo

- detectar si una orden legacy puede interpretarse por la nueva arquitectura
- exponer campos reconocidos, desconocidos y criticos ausentes
- evaluar la decision de PDF y la proxima accion sugerida
- sanitizar antes de mostrar o comparar

## Flujo

1. El snapshot legacy entra por `sanitizarOrdenParaDiagnostico()`.
2. La auditoria compara el resultado contra los contratos de dominio.
3. Se calcula un reporte estructurado.
4. La vista de diagnostico muestra solo el reporte y el snapshot sanitizado.

## Salida esperada

La funcion `crearReporteCompatibilidadOrden()` devuelve:

- `compatible`
- `nivel`
- `camposReconocidos`
- `camposNoReconocidos`
- `camposCriticosAusentes`
- `decisionPdf`
- `proximaAccion`
- `warnings`
- `snapshotSanitizado`
- `fieldsSeen`

## Niveles

- `OK`: la orden puede interpretarse sin hallazgos relevantes
- `WARNING`: la orden se interpreta, pero hay campos legacy extra o un bloqueo funcional
- `INCOMPATIBLE`: faltan campos criticos para analizar la orden con seguridad

## Regla de seguridad

No usar snapshots sin sanitizar. El reporte no debe recibir datos productivos con nombres, telefonos, documentos, patentes reales, direcciones, tokens o links privados.

