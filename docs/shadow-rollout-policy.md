# Shadow Rollout Policy

## Objetivo

Centralizar la activacion de la capa shadow con una politica pura, testeable y deny-by-default.

La politica separa tres capacidades:

- `computeEnabled`
- `comparisonEnabled`
- `uiVisible`

## Kill switch

El kill switch maestro es obligatorio.

Si el master switch esta apagado, todo queda apagado aunque el resto de la configuracion sea valida.

## Reglas base

- todo apagado por defecto
- solo el string exacto `"true"` activa una capacidad
- no hay autoactivacion en development
- no se activa por query params
- no se activa por localStorage
- workshopUid ausente => apagado
- allowlist vacia o workshop no incluido => apagado
- produccion general sigue bloqueada

## Reason codes

- `MASTER_DISABLED`
- `ENVIRONMENT_NOT_ALLOWED`
- `WORKSHOP_MISSING`
- `WORKSHOP_NOT_ALLOWLISTED`
- `SURFACE_NOT_ALLOWED`
- `ROLE_NOT_ALLOWED`
- `CONFIG_INVALID`
- `ENABLED_INTERNAL`
- `ENABLED_STAGING`

## Matriz de activacion

| Entorno | Master | Allowlist | UI | Resultado |
| --- | ---: | ---: | ---: | --- |
| Produccion | off | si/no | si/no | apagado |
| Produccion | on | no | si/no | apagado |
| Produccion | on | si | off | calculo interno permitido |
| Produccion | on | si | on | solo si existe autorizacion interna explicita |
| Staging | on | si | on | permitido |
| Desarrollo | off | si | si | apagado |
| Configuracion invalida | cualquiera | cualquiera | cualquiera | apagado |

## Regla de negocio indefinida

Los casos clasificados como `undefined_business_rule` no se convierten en decisiones operativas.

Se expresan como:

```js
{
  status: "indeterminate",
  reason: "UNDEFINED_BUSINESS_RULE"
}
```

## Superficies autorizadas

La UI solo puede mostrarse en superficies explicitamente autorizadas por la politica.

Si la superficie no esta habilitada, el calculo puede seguir existiendo internamente, pero la UI queda oculta.

## Roles autorizados

La UI solo se habilita para roles o contextos internos explicitamente autorizados.

## Estado de produccion general

La produccion general permanece deshabilitada hasta que exista una etapa posterior de rollout con autorizacion controlada.

