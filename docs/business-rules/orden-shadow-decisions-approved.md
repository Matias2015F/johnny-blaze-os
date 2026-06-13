# Orden shadow decisions approved

Fuente canonica:

- `src/modules/ordenes/orden.businessDecisions.js`
- `src/modules/ordenes/orden.stageValidators.js`
- `src/modules/ordenes/orden.shadowDifferential.js`

Estado global:

- Decision state: `DECIDED`
- Approved by: `PRODUCT_OWNER`
- Decision version: `1`
- Operationally enforced: `false`

Nota:

- Estas decisiones ya estan formalizadas como reglas puras.
- No gobiernan flujo operativo, botones, storage ni backend.
- `src/modules/ordenes/orden.shadowPendingRules.js` queda como evidencia historica de la fase anterior.

## Registry aprobado

| Rule ID | Canonical State | Next Action | PDF Policy | Requires Manual Review | Implemented in Domain | Enforced in Runtime |
| --- | --- | --- | --- | --- | --- | --- |
| `ORDER_PRESUPUESTO_PENDIENTE_NEXT_ACTION` | `PRESUPUESTADO` | `ENVIAR_O_REENVIAR_PRESUPUESTO` | `BLOCKED_PRE_APPROVAL` | false | true | false |
| `ORDER_PRESUPUESTO_APROBADO_NEXT_ACTION` | `AUTORIZADO` | `INICIAR_TRABAJO` | `BLOCKED_IN_REPAIR` | false | true | false |
| `ORDER_ADDITIONAL_PENDING_NEXT_ACTION` | `ESPERANDO_APROBACION_ADICIONAL` | `SOLICITAR_AUTORIZACION_ADICIONAL` | `BLOCKED_ADDITIONAL_PENDING` | false | true | false |
| `ORDER_ADDITIONAL_AUTHORIZED_NEXT_ACTION` | `EN_REPARACION` | `EJECUTAR_ADICIONAL_AUTORIZADO` | `BLOCKED_ADDITIONAL_AUTHORIZED` | false | true | false |
| `ORDER_WORK_IN_PROGRESS_NEXT_ACTION` | `EN_REPARACION` | `REGISTRAR_AVANCE_O_COMPLETAR_TAREAS` | `BLOCKED_WORK_IN_PROGRESS` | false | true | false |
| `ORDER_BUDGET_LIMIT_BLOCK` | `BLOQUEADA_POR_LIMITE_PRESUPUESTARIO` | `CREAR_ADICIONAL_Y_SOLICITAR_AUTORIZACION` | `BLOCKED_BUDGET_LIMIT` | false | true | false |
| `ORDER_READY_FOR_PAYMENT_PENDING_COLLECTION` | `PENDIENTE_PAGO` | `REGISTRAR_PAGO` | `BLOCKED_PAYMENT_PENDING` | false | true | false |
| `ORDER_UNKNOWN_INCONSISTENT_STATE` | `null` | `REVISAR_Y_REPARAR_DATOS` | `MANUAL_REVIEW_REQUIRED` | true | true | false |

## Estados canonicos nuevos

- `ESPERANDO_APROBACION_ADICIONAL`
- `BLOQUEADA_POR_LIMITE_PRESUPUESTARIO`

Estos estados se reconocen en el contrato, pero todavia no se escriben en datos reales.

## Secuencia pura de cierre

```txt
PENDIENTE_PAGO
-> pago total confirmado
-> COBRADO_PENDIENTE_RETIRO
-> retiro confirmado
-> ENTREGADO
-> cierre documental completo
-> CERRADO_CON_PDF
```

Reglas aprobadas:

- pago parcial no avanza;
- pago completo sin retiro conduce a `COBRADO_PENDIENTE_RETIRO`;
- retiro confirmado conduce a `ENTREGADO`;
- sin cierre documental no se permite `CERRADO_CON_PDF`;
- estado inconsistente requiere revision manual;
- una inconsistencia nunca se autocorrige;
- una transicion invalida devuelve una decision estructurada.

