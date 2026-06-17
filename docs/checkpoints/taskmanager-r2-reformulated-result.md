# FASE R2 reformulada - resultado

Fecha: 2026-06-16

## Fuentes de verdad

- Base actual preservada: `2dc20791fc65f17c3765744685693b1d99b53d50`.
- Fuente funcional: `59ea5f1a808e1dfb801e0d16d474e2eb9b009043`.
- Referencia visual: `C:\Users\Usuario\johnny-blaze-os-backup-20260507`.
- Archivo productivo recuperado: `src/components/TaskManagerView.jsx`.

## Auditoria del borrador R2 anterior

| Bloque anterior | Clasificacion | Motivo | Resultado final |
|---|---|---|---|
| Helper `taskManagerRecovery.js` | CORREGIR | El borrador ya concentraba la recuperacion en un helper unico, pero el preview generaba IDs finales y la segunda aplicacion usaba `ALREADY_APPLIED`. | Se mantuvo el helper unico. El preview ya no genera IDs finales ni `_tareaId`; la aplicacion confirmada genera IDs estables y devuelve `RECOVERY_ALREADY_APPLIED`. |
| Integracion en `TaskManagerView.jsx` | CORREGIR | La UI ya conectaba seleccion, preview y confirmacion, pero no mostraba exclusiones/conflictos del plan. | Se conservaron sheets y flujo actual. El preview muestra exclusiones y conflictos sin escribir hasta confirmar. |
| Tests R2 | CORREGIR | Cubrian recuperacion general, pero faltaban checks explicitos de preview puro, orphans, conflictos e idempotencia estructurada. | Se ampliaron a 50 tests R2 deterministas. |
| Fixture runtime externo | REUTILIZAR | El fixture era seguro, local y sin Firebase. | Se actualizo con el codigo productivo actual y mocks locales. La ejecucion runtime volvio a pasar completa. |
| Alternativa de copiar archivo historico completo | DESCARTAR | Rompia arquitectura posterior, sheets actuales, aprobacion por item y logica vigente. | No se reemplazo el archivo completo ni se revirtio `6caea28`. |

No se detecto una segunda implementacion paralela de recuperacion: la recuperacion vive en `src/modules/ordenes/taskManagerRecovery.js` y la UI la consume desde `TaskManagerView.jsx`.

## Capacidades recuperadas

1. Seleccion de un service anterior de la misma moto y del mismo scope autenticado.
2. Preview read-only de tarea, repuestos, insumos, importes y proximo control.
3. Deteccion visible de exclusiones y conflictos antes de confirmar.
4. Confirmacion explicita antes de escribir.
5. IDs nuevos, estables y distintos de los historicos, generados solo al aplicar.
6. Reconstruccion de `_tareaId` hacia el ID nuevo de la tarea destino.
7. Aplicacion idempotente, incluso despues de recargar o regenerar el preview.
8. Exclusiones de pagos, saldo, PDF, cierre, retiro, tokens, garantia y total historico.
9. Recalculo mediante `calcularNuevoTotal`, que sigue siendo la logica canonica actual.
10. Recuperacion de proximo control con `buildProximoControl`, sin crear recordatorios.
11. Preservacion explicita de un control existente, salvo reemplazo elegido por el usuario.
12. Flujo local anterior/siguiente con la jerarquia visual del backup.
13. Sheets actuales, aprobacion por item, `coleccion`, `onBack` y edicion posterior preservados.

## Evidencia runtime segura

Se uso un fixture externo, sanitizado y sin Firebase:

`C:\Users\Usuario\Proyectos\MotoGestion\codex\auditoria-global-20260615\r2-candidate-ui`

Script:

`C:\Users\Usuario\Proyectos\MotoGestion\codex\auditoria-global-20260615\run-r2-runtime.mjs`

Resultado reproducible:

- preview sin escritura: OK;
- cancelar preview sin escritura: OK;
- tarea, repuesto e insumo mostrados: OK;
- exclusiones visibles en preview: OK;
- aplicacion atomica: 2 tareas, 1 repuesto y 1 insumo;
- pagos y PDF historicos copiados: no;
- total recalculado: ARS 49.500;
- aprobacion existente conservada: `aprobado`;
- aprobacion recuperada reiniciada: `pendiente`;
- proximo control recuperado: 2.500 km;
- relacion tarea-material visible: OK;
- edicion posterior del repuesto: 8.500 -> 9.000;
- total posterior a edicion: ARS 50.500;
- persistencia tras recarga: OK;
- segunda aplicacion: bloqueada sin duplicados;
- segunda aplicacion no agrego tareas: 2 se mantiene;
- segunda aplicacion no agrego materiales: 1 repuesto se mantiene;
- navegacion siguiente/anterior: OK;
- consola: 0 errores;
- red: 0 requests fallidos.

Capturas:

- `C:\Users\Usuario\Proyectos\MotoGestion\codex\auditoria-global-20260615\screenshots\r2-candidate-initial.png`;
- `C:\Users\Usuario\Proyectos\MotoGestion\codex\auditoria-global-20260615\screenshots\r2-candidate-preview.png`;
- `C:\Users\Usuario\Proyectos\MotoGestion\codex\auditoria-global-20260615\screenshots\r2-candidate-applied.png`;
- `C:\Users\Usuario\Proyectos\MotoGestion\codex\auditoria-global-20260615\screenshots\r2-candidate-material-links.png`;
- `C:\Users\Usuario\Proyectos\MotoGestion\codex\auditoria-global-20260615\screenshots\r2-candidate-next-control.png`;
- referencia visual: `C:\Users\Usuario\Proyectos\MotoGestion\codex\auditoria-global-20260615\screenshots\backup-ui-task.png`.

La ejecucion historica autenticada exacta de `59ea5f1` queda `NO_VERIFICADO`: no se usaron credenciales ni datos productivos. La responsabilidad de sus funciones fue verificada por diff y la experiencia visual mediante la captura ya existente del backup.

## Campos internos

- `_tareaId` permanece en el modelo operativo para mantener la relacion material-tarea.
- PDF y WhatsApp renderizan campos seleccionados (`nombre`, `cantidad`, importes), no `_tareaId`.
- `publicReceipts` se construye con un resumen sanitizado en `receiptService.js`; no publica `_tareaId`.
- El snapshot final privado de la orden conserva los arrays completos dentro de la coleccion del usuario. No se cambio ese contrato en R2.
- Los metadatos temporales de recuperacion no se persisten en tareas ni materiales.
- El preview contiene `sourceTaskRef`, `sourceMaterialRef` y `previewKey`, pero no IDs finales ni `_tareaId`.

## Validacion tecnica

- `npm run lint`: OK, 0 errores y 50 warnings heredados.
- `npm run build`: OK, 2262 modulos transformados.
- `npm test`: OK, 27 archivos y 180 tests aprobados.
- `BASELINE_TESTS`: 130/130.
- `NEW_R2_TESTS`: 50/50.
- `TOTAL_TESTS`: 130+50 / 130+50.
- `git diff --check`: sin errores; solo aviso de conversion LF/CRLF de Git para `TaskManagerView.jsx`.

## Estado de continuidad

- `DECIDED`: si.
- `IMPLEMENTED_IN_DOMAIN`: si.
- `CONNECTED_TO_UI`: si, exclusivamente en `TaskManagerView`.
- `ENFORCED_IN_RUNTIME`: si en fixture local seguro; la escritura requiere confirmacion explicita del usuario.
- `DEPLOYED`: no.

No se ejecuto `git add`, commit, push ni deploy.
