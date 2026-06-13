# Shadow Decision Panel

Este panel muestra decisiones calculadas en modo sombra.

## Qué muestra

- decisión de PDF
- motivos de bloqueo
- próxima acción sugerida
- warnings
- divergencias
- origen de la decisión

## Por qué está en modo sombra

Porque sólo debe observar y diagnosticar, no intervenir en el flujo real.

## Qué no hace

- no tiene botones
- no modifica estado
- no escribe datos
- no llama APIs
- no toca Firestore
- no toca localStorage
- no dispara PDF
- no envía WhatsApp

## Qué archivo consume

- `src/modules/ordenes/orden.shadowIntegration.js`
- `src/modules/ordenes/orden.shadowPresenter.js`

## Cómo se integrará después

Primero puede montarse como panel lateral o tarjeta de diagnóstico en una vista.  
Más adelante puede convivir con acciones visibles, pero sólo cuando la divergencia esté controlada.

## Riesgos que evita

- bloquear una acción real antes de tiempo
- cambiar el comportamiento visible por error
- acoplar la UI a reglas inmaduras

## Qué falta para habilitarlo en una pantalla real

- elegir una vista candidata
- decidir el criterio de render
- confirmar que el panel no altera el flujo
- conectar sin bloquear acciones

