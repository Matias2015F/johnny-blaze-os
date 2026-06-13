# Orden shadow decision matrix

| Rule ID | Caso | Legacy comprobado | Alternativas | Recomendacion | Decision Product Owner | Estado |
| ------- | ---- | ----------------- | ------------ | ------------- | ---------------------- | ------ |
| ORDER_PRESUPUESTO_PENDIENTE_NEXT_ACTION | presupuestoPendiente | Bloqueo generico `PDF_BLOQUEADO_NO_ENTREGADO` | A: mantener bloqueo; B: subestado de aprobacion; C: borrador no operativo | Mantener `indeterminate` hasta definicion de negocio | PENDIENTE | UNRESOLVED |
| ORDER_PRESUPUESTO_APROBADO_NEXT_ACTION | presupuestoAprobado | Bloqueo generico `PDF_BLOQUEADO_NO_ENTREGADO` | A: esperar inicio; B: mover a reparacion; C: PDF de borrador | Definir transicion exacta antes de automatizar | PENDIENTE | UNRESOLVED |
| ORDER_ADDITIONAL_PENDING_NEXT_ACTION | adicionalPendiente | Bloqueo generico `PDF_BLOQUEADO_NO_ENTREGADO` | A: pausar toda la orden; B: bloquear solo tramo adicional; C: aprobacion independiente | No decidir en runtime | PENDIENTE | UNRESOLVED |
| ORDER_ADDITIONAL_AUTHORIZED_NEXT_ACTION | adicionalAutorizado | Bloqueo generico `PDF_BLOQUEADO_NO_ENTREGADO` | A: mantener estado; B: volver a reparacion; C: evento auditable sin mutar estado | Registrar aprobacion, no autoavanzar | PENDIENTE | UNRESOLVED |
| ORDER_WORK_IN_PROGRESS_NEXT_ACTION | trabajoEnProgreso | Bloqueo generico `PDF_BLOQUEADO_NO_ENTREGADO` | A: seguir igual; B: subestado de avance; C: solo eventos de trabajo | Mantener bloqueo actual hasta formalizar subestado | PENDIENTE | UNRESOLVED |
| ORDER_BUDGET_LIMIT_BLOCK | bloqueoPresupuestario | Bloqueo generico `PDF_BLOQUEADO_NO_ENTREGADO` | A: pausar toda la orden; B: bloquear solo pagos; C: override auditable | Exigir definicion explicita | PENDIENTE | UNRESOLVED |
| ORDER_READY_FOR_PAYMENT_PENDING_COLLECTION | finalizadaPendienteCobro | Bloqueo generico `PDF_BLOQUEADO_NO_ENTREGADO` | A: cobrar primero; B: permitir retiro; C: PDF con confirmacion manual | Definir orden de cobro y retiro | PENDIENTE | UNRESOLVED |
| ORDER_UNKNOWN_INCONSISTENT_STATE | estadoInconsistente | Bloqueo generico `PDF_BLOQUEADO_NO_ENTREGADO` con estado contradictorio | A: revisar migracion; B: normalizar solo en migracion; C: indeterminado hasta resolver | Tratar como auditoria de datos | PENDIENTE | UNRESOLVED |

## 3C-L Decision registry approved

La fuente canonica aprobada vive en `src/modules/ordenes/orden.businessDecisions.js`.
Esta tabla formaliza el estado `DECIDED` sin cambiar enforcement operativo.

| Rule ID | Canonical State | Next Action | Decision State | Implemented in Domain | Enforced in Runtime | PDF Policy | Requires Manual Review |
| ------- | --------------- | ----------- | -------------- | --------------------- | ------------------- | ---------- | ---------------------- |
| ORDER_PRESUPUESTO_PENDIENTE_NEXT_ACTION | PRESUPUESTADO | ENVIAR_O_REENVIAR_PRESUPUESTO | DECIDED | true | false | BLOCKED_PRE_APPROVAL | false |
| ORDER_PRESUPUESTO_APROBADO_NEXT_ACTION | AUTORIZADO | INICIAR_TRABAJO | DECIDED | true | false | BLOCKED_IN_REPAIR | false |
| ORDER_ADDITIONAL_PENDING_NEXT_ACTION | ESPERANDO_APROBACION_ADICIONAL | SOLICITAR_AUTORIZACION_ADICIONAL | DECIDED | true | false | BLOCKED_ADDITIONAL_PENDING | false |
| ORDER_ADDITIONAL_AUTHORIZED_NEXT_ACTION | EN_REPARACION | EJECUTAR_ADICIONAL_AUTORIZADO | DECIDED | true | false | BLOCKED_ADDITIONAL_AUTHORIZED | false |
| ORDER_WORK_IN_PROGRESS_NEXT_ACTION | EN_REPARACION | REGISTRAR_AVANCE_O_COMPLETAR_TAREAS | DECIDED | true | false | BLOCKED_WORK_IN_PROGRESS | false |
| ORDER_BUDGET_LIMIT_BLOCK | BLOQUEADA_POR_LIMITE_PRESUPUESTARIO | CREAR_ADICIONAL_Y_SOLICITAR_AUTORIZACION | DECIDED | true | false | BLOCKED_BUDGET_LIMIT | false |
| ORDER_READY_FOR_PAYMENT_PENDING_COLLECTION | PENDIENTE_PAGO | REGISTRAR_PAGO | DECIDED | true | false | BLOCKED_PAYMENT_PENDING | false |
| ORDER_UNKNOWN_INCONSISTENT_STATE | null | REVISAR_Y_REPARAR_DATOS | DECIDED | true | false | MANUAL_REVIEW_REQUIRED | true |

Notas:

- `orden.shadowPendingRules.js` queda como evidencia historica de FASE 3C-K.
- `DECIDED` no significa `ENFORCED_IN_RUNTIME`.
- Los nuevos estados canonicos se reconocen en contrato, pero todavia no se escriben en Firestore.
