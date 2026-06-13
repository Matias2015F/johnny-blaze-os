# Orden shadow pending rules

Fuente de verdad:

- `src/modules/ordenes/orden.shadowPendingRules.js`
- `src/modules/ordenes/orden.shadowDifferential.js`
- `src/modules/ordenes/fixtures/ordenShadowDifferentialCorpus.js`

Estado global:

- Reglas unicas pendientes: 8
- Casos del corpus en indeterminacion: 8
- Decision tecnica actual: `indeterminate`
- Decision del Product Owner: `PENDIENTE`
- Estado de decision: `UNRESOLVED`

Nota de lectura:

- Cada ficha separa evidencia comprobada de inferencia.
- Mientras la decision permanezca `UNRESOLVED`, el sistema no debe pasar de `indeterminate`.

## 1. ORDER_PRESUPUESTO_PENDIENTE_NEXT_ACTION

- Rule ID: `ORDER_PRESUPUESTO_PENDIENTE_NEXT_ACTION`
- Nombre: Presupuesto pendiente - siguiente accion
- Escenario: orden con estado `PRESUPUESTADO`
- Estado actual: `PRESUPUESTADO`
- Datos disponibles: `id`, `estado`, `clientId`, `bikeId`, `tallerId`, `garantiaFinal`
- Datos faltantes: ninguno
- Comportamiento legacy comprobado: `PDF_BLOQUEADO_NO_ENTREGADO`, accion `Completar trabajo o retiro`, motivo `La orden aun no fue entregada`
- Resultado shadow actual: `status=indeterminate`, `reason=UNDEFINED_BUSINESS_RULE`, `fallback=indeterminate`
- Motivo de indeterminacion: el sistema actual bloquea el PDF, pero no define si el mecánico debe esperar aprobacion, recontactar al cliente o seguir con una tarea interna.
- Riesgo comercial: medio; una mala regla puede frenar cobros o generar pasos confusos
- Riesgo tecnico: bajo; la infraestructura ya bloquea por default
- Impacto sobre PDF: sigue bloqueado en la rama actual
- Impacto sobre estado: no debe cambiar el estado automaticamente
- Impacto sobre proxima accion: hoy sugiere `Completar trabajo o retiro`, pero esa sugerencia es provisional
- Impacto sobre pagos: sin efecto directo
- Impacto sobre retiro: sin efecto directo
- Alternativa A: conservar bloqueo generico hasta que exista aprobacion explicita
- Alternativa B: introducir un subestado de presupuesto pendiente con accion `Esperar aprobacion`
- Alternativa C: permitir un PDF de borrador no operativo
- Recomendacion tecnica: mantener `indeterminate` y pedir definicion de negocio antes de tocar el flujo
- Decision del Product Owner: PENDIENTE
- Estado de decision: UNRESOLVED

### Evidencia comprobada

- Fixture sanitizado: `presupuestoPendiente`
- Legacy y shadow coinciden en `PDF_BLOQUEADO_NO_ENTREGADO`
- La regla actual no expone una accion de negocio especifica

### Inferencia

- Es probable que el flujo correcto sea un seguimiento comercial, no una transicion operativa de taller

## 2. ORDER_PRESUPUESTO_APROBADO_NEXT_ACTION

- Rule ID: `ORDER_PRESUPUESTO_APROBADO_NEXT_ACTION`
- Nombre: Presupuesto aprobado - siguiente accion
- Escenario: orden con estado `AUTORIZADO`
- Estado actual: `AUTORIZADO`
- Datos disponibles: `id`, `estado`, `clientId`, `bikeId`, `tallerId`, `garantiaFinal`
- Datos faltantes: ninguno
- Comportamiento legacy comprobado: `PDF_BLOQUEADO_NO_ENTREGADO`, accion `Completar trabajo o retiro`, motivo `La orden aun no fue entregada`
- Resultado shadow actual: `status=indeterminate`, `reason=UNDEFINED_BUSINESS_RULE`, `fallback=indeterminate`
- Motivo de indeterminacion: la aprobacion del presupuesto existe, pero el sistema no distingue si la proxima accion es iniciar reparacion, registrar tareas o esperar otra confirmacion.
- Riesgo comercial: medio; una mala decision puede adelantar un PDF o saltar una validacion
- Riesgo tecnico: bajo
- Impacto sobre PDF: sigue bloqueado
- Impacto sobre estado: no debe mutar automaticamente a reparacion
- Impacto sobre proxima accion: hoy se muestra una accion generica, no una accion de dominio
- Impacto sobre pagos: sin efecto directo
- Impacto sobre retiro: sin efecto directo
- Alternativa A: mantener el bloqueo generico hasta que el taller arranque la reparacion
- Alternativa B: crear un estado intermedio `AUTORIZADO_ESPERANDO_INICIO`
- Alternativa C: mover la orden a `EN_REPARACION` al confirmar la aprobacion
- Recomendacion tecnica: documentar la transicion exacta antes de automatizarla
- Decision del Product Owner: PENDIENTE
- Estado de decision: UNRESOLVED

### Evidencia comprobada

- Fixture sanitizado: `presupuestoAprobado`
- Legacy y shadow coinciden en `PDF_BLOQUEADO_NO_ENTREGADO`
- No hay divergencia operativa, solo indeterminacion de negocio

### Inferencia

- La siguiente accion probablemente deberia ser interna del taller, no de cierre documental

## 3. ORDER_ADDITIONAL_PENDING_NEXT_ACTION

- Rule ID: `ORDER_ADDITIONAL_PENDING_NEXT_ACTION`
- Nombre: Adicional pendiente - siguiente accion
- Escenario: orden con adicional pendiente
- Estado actual: `ESPERANDO_REPUESTOS`
- Datos disponibles: `id`, `estado`, `clientId`, `bikeId`, `tallerId`, `garantiaFinal`, `adicionalEstado=PENDIENTE`
- Datos faltantes: ninguno
- Comportamiento legacy comprobado: `PDF_BLOQUEADO_NO_ENTREGADO`, accion `Completar trabajo o retiro`, motivo `La orden aun no fue entregada`
- Resultado shadow actual: `status=indeterminate`, `reason=UNDEFINED_BUSINESS_RULE`, `fallback=indeterminate`
- Motivo de indeterminacion: no esta definido si el adicional pendiente debe frenar la orden completa, congelar solo el tramo adicional o abrir una aprobacion separada.
- Riesgo comercial: medio/alto; puede afectar aprobaciones y cobros adicionales
- Riesgo tecnico: bajo
- Impacto sobre PDF: bloqueado mientras no exista una regla formal
- Impacto sobre estado: no debe crear un estado nuevo por inferencia
- Impacto sobre proxima accion: la accion generica no refleja el negocio real
- Impacto sobre pagos: puede impactar el cobro del adicional
- Impacto sobre retiro: puede impactar si la moto puede entregarse parcial o totalmente
- Alternativa A: pausar toda la orden hasta aprobar el adicional
- Alternativa B: permitir continuar el trabajo ya aprobado y bloquear solo el tramo adicional
- Alternativa C: separar el adicional en una aprobacion independiente
- Recomendacion tecnica: no decidir en el motor; esperar definicion del PO
- Decision del Product Owner: PENDIENTE
- Estado de decision: UNRESOLVED

### Evidencia comprobada

- Fixture sanitizado: `adicionalPendiente`
- Legacy y shadow coinciden en el bloqueo generico
- El campo `adicionalEstado` existe, pero no resuelve la semantica completa

### Inferencia

- La regla puede requerir un subflujo especifico de aprobacion de extras

## 4. ORDER_ADDITIONAL_AUTHORIZED_NEXT_ACTION

- Rule ID: `ORDER_ADDITIONAL_AUTHORIZED_NEXT_ACTION`
- Nombre: Adicional autorizado - siguiente accion
- Escenario: orden con adicional autorizado
- Estado actual: `AUTORIZADO`
- Datos disponibles: `id`, `estado`, `clientId`, `bikeId`, `tallerId`, `garantiaFinal`, `adicionalEstado=AUTORIZADO`
- Datos faltantes: ninguno
- Comportamiento legacy comprobado: `PDF_BLOQUEADO_NO_ENTREGADO`, accion `Completar trabajo o retiro`, motivo `La orden aun no fue entregada`
- Resultado shadow actual: `status=indeterminate`, `reason=UNDEFINED_BUSINESS_RULE`, `fallback=indeterminate`
- Motivo de indeterminacion: se sabe que el adicional ya fue aprobado, pero no esta formalizado si la orden vuelve a reparacion, si sigue en el mismo estado o si debe disparar un nuevo control de avance.
- Riesgo comercial: medio; puede confundir al cliente y al mecanico
- Riesgo tecnico: bajo
- Impacto sobre PDF: bloqueado hasta que el flujo sea formal
- Impacto sobre estado: no debe autoavanzar
- Impacto sobre proxima accion: hoy sigue siendo generica
- Impacto sobre pagos: puede habilitar o no el cobro adicional
- Impacto sobre retiro: sin efecto directo inmediato
- Alternativa A: mantener la orden en el mismo estado y registrar el adicional aprobado
- Alternativa B: regresar a reparacion con la nueva aprobacion
- Alternativa C: crear un evento auditable sin cambiar el estado operativo
- Recomendacion tecnica: registrar la aprobacion, no mutar estados automaticamente
- Decision del Product Owner: PENDIENTE
- Estado de decision: UNRESOLVED

### Evidencia comprobada

- Fixture sanitizado: `adicionalAutorizado`
- Legacy y shadow coinciden en el bloqueo generico
- El dato adicional esta presente, pero no formaliza la transicion

### Inferencia

- La aprobacion deberia quedar auditable antes de afectar el flujo de orden

## 5. ORDER_WORK_IN_PROGRESS_NEXT_ACTION

- Rule ID: `ORDER_WORK_IN_PROGRESS_NEXT_ACTION`
- Nombre: Trabajo en progreso - siguiente accion
- Escenario: orden en reparacion activa
- Estado actual: `EN_REPARACION`
- Datos disponibles: `id`, `estado`, `clientId`, `bikeId`, `tallerId`, `garantiaFinal`
- Datos faltantes: ninguno
- Comportamiento legacy comprobado: `PDF_BLOQUEADO_NO_ENTREGADO`, accion `Completar trabajo o retiro`, motivo `La orden aun no fue entregada`
- Resultado shadow actual: `status=indeterminate`, `reason=UNDEFINED_BUSINESS_RULE`, `fallback=indeterminate`
- Motivo de indeterminacion: el estado operativo existe, pero no esta explicitado si la accion siguiente es continuar trabajo, registrar pausa, pedir repuestos o finalizar parcial.
- Riesgo comercial: bajo/medio
- Riesgo tecnico: bajo
- Impacto sobre PDF: bloqueado
- Impacto sobre estado: no debe autoavanzar a entregado
- Impacto sobre proxima accion: la accion generica no captura el avance real
- Impacto sobre pagos: sin efecto directo
- Impacto sobre retiro: sin efecto directo
- Alternativa A: conservar el estado actual hasta finalizar
- Alternativa B: introducir un subestado de avance o pausa
- Alternativa C: permitir solo eventos de trabajo y bloquear cierre documental
- Recomendacion tecnica: mantener el bloqueo actual hasta que se defina el subestado correcto
- Decision del Product Owner: PENDIENTE
- Estado de decision: UNRESOLVED

### Evidencia comprobada

- Fixture sanitizado: `trabajoEnProgreso`
- Legacy y shadow coinciden en el bloqueo de PDF
- No hay evidencia de transicion automatica segura

### Inferencia

- El flujo podria necesitar eventos de progreso, no solo un estado plano

## 6. ORDER_BUDGET_LIMIT_BLOCK

- Rule ID: `ORDER_BUDGET_LIMIT_BLOCK`
- Nombre: Bloqueo por limite presupuestario
- Escenario: orden con bloqueo presupuestario
- Estado actual: `PENDIENTE_PAGO`
- Datos disponibles: `id`, `estado`, `clientId`, `bikeId`, `tallerId`, `garantiaFinal`, `bloqueoPresupuestario=true`
- Datos faltantes: ninguno
- Comportamiento legacy comprobado: `PDF_BLOQUEADO_NO_ENTREGADO`, accion `Completar trabajo o retiro`, motivo `La orden aun no fue entregada`
- Resultado shadow actual: `status=indeterminate`, `reason=UNDEFINED_BUSINESS_RULE`, `fallback=indeterminate`
- Motivo de indeterminacion: el sistema no distingue si el limite presupuestario bloquea solo pagos, solo continuidad de trabajo o tambien retiro y PDF.
- Riesgo comercial: alto; puede afectar autorizaciones, descuentos y cobro
- Riesgo tecnico: bajo
- Impacto sobre PDF: bloqueado por ahora
- Impacto sobre estado: no debe autogenerar un estado financiero
- Impacto sobre proxima accion: la accion generica no expresa el bloqueo real
- Impacto sobre pagos: puede requerir una regla propia de aprobacion
- Impacto sobre retiro: puede impedir entrega hasta aclaracion
- Alternativa A: pausar toda la orden hasta resolver el limite
- Alternativa B: permitir continuar y bloquear solo pagos adicionales
- Alternativa C: crear un flujo de override auditable
- Recomendacion tecnica: exigir decision de negocio antes de mover este caso al runtime
- Decision del Product Owner: PENDIENTE
- Estado de decision: UNRESOLVED

### Evidencia comprobada

- Fixture sanitizado: `bloqueoPresupuestario`
- Legacy y shadow coinciden en bloqueo generico
- El flag `bloqueoPresupuestario` existe, pero no define la accion final

### Inferencia

- Es una regla de negocio sensible; no conviene improvisarla en el motor

## 7. ORDER_READY_FOR_PAYMENT_PENDING_COLLECTION

- Rule ID: `ORDER_READY_FOR_PAYMENT_PENDING_COLLECTION`
- Nombre: Finalizada pendiente de cobro
- Escenario: orden lista para entrega pero sin cobro final
- Estado actual: `LISTO_PARA_ENTREGA`
- Datos disponibles: `id`, `estado`, `clientId`, `bikeId`, `tallerId`, `garantiaFinal`, `cobrado=false`, `retirado=false`
- Datos faltantes: ninguno
- Comportamiento legacy comprobado: `PDF_BLOQUEADO_NO_ENTREGADO`, accion `Completar trabajo o retiro`, motivo `La orden aun no fue entregada`
- Resultado shadow actual: `status=indeterminate`, `reason=UNDEFINED_BUSINESS_RULE`, `fallback=indeterminate`
- Motivo de indeterminacion: la orden esta lista para entrega, pero no se sabe si la regla correcta es cobrar primero, retirar primero o permitir PDF con validacion manual.
- Riesgo comercial: alto; toca cobro, retiro y cierre
- Riesgo tecnico: bajo
- Impacto sobre PDF: bloqueado por la regla actual
- Impacto sobre estado: no debe pasar automaticamente a entregado
- Impacto sobre proxima accion: la accion generica puede ocultar la necesidad de cobro
- Impacto sobre pagos: potencialmente alto
- Impacto sobre retiro: potencialmente alto
- Alternativa A: exigir cobro antes de cualquier entrega
- Alternativa B: habilitar retiro y dejar el cobro como pendiente
- Alternativa C: permitir PDF de cierre solo con confirmacion manual
- Recomendacion tecnica: pedir definicion explicita porque afecta caja y entrega
- Decision del Product Owner: PENDIENTE
- Estado de decision: UNRESOLVED

### Evidencia comprobada

- Fixture sanitizado: `finalizadaPendienteCobro`
- Legacy y shadow coinciden en bloqueo generico
- El caso toca caja y retiro, pero no define el orden

### Inferencia

- La regla probablemente requiera separar cobro de entrega en el modelo

## 8. ORDER_UNKNOWN_INCONSISTENT_STATE

- Rule ID: `ORDER_UNKNOWN_INCONSISTENT_STATE`
- Nombre: Estado desconocido o inconsistente
- Escenario: orden con estado legacy inconsistente
- Estado actual: `MODO_RARO`
- Datos disponibles: `id`, `estado`, `clientId`, `bikeId`, `tallerId`, `garantiaFinal`, `status=AUTORIZADO`
- Datos faltantes: ninguno
- Comportamiento legacy comprobado: `PDF_BLOQUEADO_NO_ENTREGADO`, accion `Completar trabajo o retiro`, motivo `La orden aun no fue entregada`
- Resultado shadow actual: `status=indeterminate`, `reason=UNDEFINED_BUSINESS_RULE`, `fallback=indeterminate`
- Motivo de indeterminacion: el dato legacy expone una contradiccion entre `estado` y `status`, por lo que no se puede inferir una transicion segura.
- Riesgo comercial: alto; una clasificacion equivocada podria ocultar un problema de migracion
- Riesgo tecnico: medio; puede revelar inconsistencias de datos reales
- Impacto sobre PDF: bloqueado
- Impacto sobre estado: no debe normalizarse automaticamente sin migracion
- Impacto sobre proxima accion: debe permanecer provisional
- Impacto sobre pagos: sin efecto automatico
- Impacto sobre retiro: sin efecto automatico
- Alternativa A: tratarlo como error de migracion y pedir revision manual
- Alternativa B: normalizarlo a un estado canonico solo en migracion, no en runtime
- Alternativa C: dejarlo indeterminado hasta resolver la inconsistencia
- Recomendacion tecnica: mantenerlo como caso de auditoria, no como regla operativa
- Decision del Product Owner: PENDIENTE
- Estado de decision: UNRESOLVED

### Evidencia comprobada

- Fixture sanitizado: `estadoInconsistente`
- Legacy y shadow coinciden en bloqueo generico
- Existe contradiccion entre `estado` y `status`

### Inferencia

- Este caso sugiere una regla de migracion o saneamiento de datos, no una regla operativa
