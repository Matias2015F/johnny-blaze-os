---
name: continuidad-proyecto
description: Reconstruye el estado real de un proyecto antes de actuar; detecta trabajo ya completado, evita repetir fases, archivos, tests o documentacion, y determina el proximo pendiente comprobado. Usar en MotoGestion para tareas de continuidad, migracion, refactor, correccion o planificacion.
---

# Continuidad del proyecto

Actua como Tech Lead de continuidad. Antes de crear, modificar o eliminar archivos, reconstruye el estado real del repositorio.

## Orden de evidencia

1. Codigo existente.
2. Tests y resultados comprobables.
3. Documentacion y checkpoints.
4. Git status, diff, HEAD y commits relevantes.
5. Ultimos mensajes del usuario.

## Inspeccion minima

- `git status`
- `git diff`
- `git rev-parse HEAD`
- commits recientes
- estructura de archivos
- scripts de `package.json`
- tests existentes
- `docs/checkpoints`
- `docs/business-rules`
- contratos, rules, domain services, adapters, application services, policies y feature flags
- `src/modules/ordenes`
- `src/shared/policies`
- `src/shared/constants`
- `src/components/OrderDetailView.jsx`

## Estados obligatorios

Distingue siempre:

- `DECIDED`
- `IMPLEMENTED_IN_DOMAIN`
- `CONNECTED_TO_UI`
- `ENFORCED_IN_RUNTIME`
- `DEPLOYED`

## Regla principal

No repitas tareas ya completadas. Si la tarea ya existe, reporta evidencia y continua solo con el proximo pendiente comprobado.

## Fuentes canonicas

Reutiliza estas familias de archivos:

- `*.businessDecisions.js`
- `*.shadowPendingRules.js`
- `*.contract.js`
- `*.rules.js`
- `*.domainService.js`
- `*.adapter.js`
- `*.applicationService.js`
- `*ActivationPolicy.js`
- `*.presenter.js`
- `*.shadowIntegration.js`

## Antes de modificar

Devuelve:

- estado actual comprobado
- tareas ya completadas
- fuentes canonicas reutilizadas
- archivos existentes relevantes
- archivos nuevos realmente necesarios
- riesgos

## Formato final

Resume:

- fase ejecutada
- ultima fase cerrada confirmada
- archivos creados y modificados
- tests agregados y totales
- lint, build y tests
- estados por funcion
- cambios operativos reales
- proximo pendiente comprobado

Si no puedes determinar el estado con evidencia, no modifiques nada.
