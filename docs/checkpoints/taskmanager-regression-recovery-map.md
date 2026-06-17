# Mapa de recuperación quirúrgica de TaskManagerView

Fecha: 2026-06-15

Estado: análisis previo. No se modificó comportamiento.

## Fuentes comparadas

- Último commit funcional: `59ea5f1a808e1dfb801e0d16d474e2eb9b009043`
- Primer commit regresivo: `6caea28db410024f4104ecf06b4f34ba9a4ca085`
- Estado actual: `2dc20791fc65f17c3765744685693b1d99b53d50`
- Archivo histórico y actual: `src/components/TaskManagerView.jsx`

Comandos utilizados:

```bash
git diff 59ea5f1a808e1dfb801e0d16d474e2eb9b009043 6caea28db410024f4104ecf06b4f34ba9a4ca085 -- src/components/TaskManagerView.jsx
git diff 59ea5f1a808e1dfb801e0d16d474e2eb9b009043 HEAD -- src/components/TaskManagerView.jsx
git log --follow -- src/components/TaskManagerView.jsx
```

## Causa exacta

El commit `6caea28` reemplazó el editor unificado por una vista plana con sheets independientes. En ese reemplazo se eliminaron `obtenerServicioPrevio`, `handleSelect`, `aplicar`, `guardarProximoControl`, `AccordionSection`, `abrirSiguiente` y el estado compartido `editForm`.

El cambio dejó disponibles las operaciones independientes de tareas, repuestos, insumos y fletes, pero perdió el contexto que relacionaba una tarea seleccionada con sus materiales y su recomendación de mantenimiento.

## Matriz de recuperación

| Capacidad | Código funcional anterior | Código actual | Dependencias actuales | Riesgo |
|---|---|---|---|---|
| Reutilizar service anterior | `obtenerServicioPrevio` y `handleSelect`, líneas históricas 488-594 | `TrabajoSheet.servicios` sólo copia nombre, horas, dificultad y margen, líneas actuales 48-75 | `orders`, `bikes`, `bike`, `generateId` | Medio: el candidato actual perdió metadatos de origen |
| Clonar repuestos e insumos | `handleSelect` y `aplicar`, líneas históricas 572-581 y 705-792 | `handleSaveRepuesto`/`handleSaveInsumo` agregan elementos individuales, líneas 469-483 | arrays planos actuales, `calcularNuevoTotal`, aprobación por ítem | Medio: hay datos históricos anidados y planos |
| Recuperar próximo control | `guardarProximoControl`, líneas históricas 642-703 | el editor canónico fue trasladado a `OrderDetailView`; TaskManager sólo conserva observaciones, líneas 499-502 y 645-659 | `buildProximoControl`, shape actual de `proximoControl` | Alto si se recrean recordatorios; bajo si sólo se prepara una recomendación aceptada explícitamente |
| Asociar materiales con tarea | `aplicar` asignaba `_tareaId` con nombre normalizado, líneas históricas 723-750 | nuevos materiales usan `_tareaId: ""`, líneas 469-480 | `_tareaId` ya existe; tareas actuales no garantizan `id` | Medio: se necesita identidad estable sin romper legacy |
| Navegación secuencial | `AccordionSection` y `abrirSiguiente`, líneas históricas 76-105 y 596-604 | secciones planas visibles simultáneamente, líneas 523-675 | estado local React; sheets actuales | Bajo/medio: debe preservarse el editor plano y no tocar navegación global |

## Funciones auxiliares eliminadas

- `normalizarTexto`: equivalente actual `norm`.
- `mismaMoto`: continúa en la versión actual.
- `clonarLista`: debe reemplazarse por clonación/sanitización pura más estricta.
- `limpiarMateriales`: debe recuperarse como normalizador puro, sin side effects.
- `SECCION_POR_TIPO`: reemplazado por el mapeo de sheets; no debe restaurarse literalmente.
- `obtenerServicioPrevio`: no tiene equivalente completo actual.
- `serviciosDisponibles`: parcialmente reemplazado por `TrabajoSheet.servicios`.
- `handleSelect`: parcialmente reemplazado por `TrabajoSheet.seleccionar`, pero sin materiales ni próximo control.
- `guardarProximoControl`: su escritura de recordatorio no debe restaurarse.
- `aplicar`: sustituido por handlers independientes; no debe restaurarse como escritura monolítica.

## Shapes actuales comprobados

Orden:

```js
{
  id,
  bikeId,
  clientId,
  tareas: [],
  repuestos: [],
  insumos: [],
  fletes: [],
  pagos: [],
  observacionesProxima: "",
  proximoControl: null,
  total
}
```

Tarea actual:

```js
{
  nombre,
  horasBase,
  dificultad,
  monto,
  margenPct,
  aprobacion
}
```

Material actual:

```js
{
  nombre,
  cantidad,
  monto,
  montoCosto?,
  _tareaId,
  aprobacion
}
```

Compatibilidad legacy comprobada:

- Algunas tareas antiguas contienen `tarea.repuestos` y `tarea.insumos` anidados.
- Otras órdenes contienen materiales en arrays planos con `_tareaId` igual al nombre normalizado de la tarea.
- Las tareas actuales pueden no tener `id`.
- `OrderDetailView` consume arrays planos y no depende actualmente de `_tareaId`.

## Diseño propuesto

### Helper puro nuevo

Archivo justificado:

`src/modules/ordenes/taskManagerRecovery.js`

Responsabilidades exclusivas:

1. Buscar el último service compatible por marca, modelo y cilindrada.
2. Adaptar shapes anidados y planos.
3. Crear una copia sanitizada con IDs nuevos inyectados por parámetro.
4. Excluir pagos, cierre, PDF, tokens, fechas operativas y estados de aprobación anteriores.
5. Reasignar repuestos e insumos al nuevo ID de tarea mediante `_tareaId`.
6. Convertir el próximo control anterior en un borrador relativo, sin crear orden ni recordatorio.
7. Proveer validación y navegación pura de pasos.

API prevista:

```js
buscarServicioAnteriorCompatible(params)
crearBorradorReutilizacion(params)
normalizarMaterialLegacy(material)
crearBorradorProximoControl(controlAnterior, contextoActual)
validarPasoTaskManager(paso, draft)
obtenerPasoSiguiente(paso, draft)
obtenerPasoAnterior(paso)
```

El generador de IDs se recibe como dependencia para que los tests sean deterministas. El helper no importa Firebase, React, `storage.js`, localStorage ni APIs.

### Integración mínima en TaskManagerView

1. Enriquecer la selección de `TrabajoSheet` con el candidato histórico completo.
2. Mostrar una confirmación explícita para reutilizar materiales y recomendación.
3. Crear una tarea nueva con ID nuevo; nunca reutilizar el ID de origen.
4. Guardar tarea, repuestos e insumos en una sola actualización calculada dentro del componente usando el mecanismo `LS.updateDoc` ya existente.
5. Mantener `aprobacion: "pendiente"` en toda copia nueva.
6. Mantener `coleccion` y `onBack` para presupuestos.
7. Mostrar pasos locales sin cambiar `TallerPanel`.
8. Persistir `proximoControl` solamente cuando el usuario acepte la recomendación.

## Próximo control

No se restaurará la creación inmediata de documentos en `recordatorios`. Esa responsabilidad fue trasladada después de `6caea28` al cierre de orden.

Regla propuesta:

- copiar únicamente `tipo`, `descripcion`, `unidad` y `valorObjetivo` permitidos;
- recalcular fechas y kilometraje desde la orden/moto actual mediante `buildProximoControl`;
- no copiar `kmBase`, `kmObjetivo`, `kmAviso`, `fechaBase` o `fechaObjetivo` absolutos del service anterior;
- no convertir la recomendación en una orden activa;
- no tocar pagos, PDF ni estado de la orden.

## Identidad y asociación

Propuesta de compatibilidad:

- tarea nueva: asignar `id: generateId()`;
- tarea existente sin ID: conservarla sin migración masiva hasta que se edite o reutilice;
- materiales clonados: asignar ID nuevo cuando el shape lo admita y siempre `_tareaId` igual al ID de la tarea nueva;
- lectura legacy: aceptar `_tareaId` por ID o por nombre normalizado;
- no modificar registros históricos.

No se crea una segunda fuente de verdad: los arrays planos de la orden continúan siendo los datos operativos.

## Navegación secuencial propuesta

Pasos locales:

1. `trabajo`
2. `repuestos`
3. `insumos_fletes`
4. `proximo_control`
5. `resumen`

Validación mínima:

- no avanzar desde `trabajo` si no existe al menos una tarea válida;
- los materiales son opcionales;
- el próximo control es opcional;
- avanzar y retroceder no limpia estado local ni listas persistidas;
- el botón global de regreso conserva el comportamiento actual.

## Código posterior que debe preservarse

- aprobación por ítem introducida en `14a9e90`;
- inputs numéricos seguros y soporte de `coleccion`/`onBack` de `d2c8bf6`;
- sheets independientes actuales;
- cálculo actual con `calcularNuevoTotal`;
- catálogo por moto y aprendizaje de horas;
- telemetría existente;
- edición de presupuestos mediante `coleccion="presupuestos"`;
- editor canónico de próximo control en `OrderDetailView`;
- creación diferida de recordatorios al cierre;
- arquitectura shadow y reglas de dominio posteriores.

## Tests previstos

Archivo:

`src/modules/ordenes/taskManagerRecovery.test.js`

Casos:

1. Copia nueva con ID distinto.
2. Exclusión de pagos y cierre documental.
3. Clonación de repuestos.
4. Clonación de insumos.
5. Normalización de cantidades.
6. Asociación `_tareaId` correcta.
7. Próximo control relativo recuperado.
8. Ausencia de creación de orden o recordatorio.
9. Navegación siguiente conserva draft.
10. Navegación anterior conserva draft.
11. Bloqueo de avance sin tarea.
12. Inmutabilidad del origen.
13. Falla segura con legacy incompleto.
14. Compatibilidad con materiales planos.
15. Preservación de `aprobacion: "pendiente"`, `coleccion`, cálculo y shape actual.

No se agregarán dependencias de test.

## Riesgos pendientes

1. Las tareas actuales sin ID requieren fallback legacy por nombre.
2. Dos tareas con el mismo nombre dentro de una orden antigua pueden ser ambiguas.
3. Los materiales históricos pueden existir duplicados en forma anidada y plana; el adapter debe deduplicar.
4. La captura before/after autenticada no es posible todavía sin fixture seguro. La fase puede demostrar lógica con fixtures puros, pero la validación UI quedará explícitamente pendiente.
5. La recuperación de próximo control debe evitar duplicar recordatorios al cierre.

## Correspondencia R2 reformulada

Esta tabla es la puerta previa a la implementacion. La fuente funcional es
`59ea5f1`; la apariencia y el orden se contrastan con
`johnny-blaze-os-backup-20260507`; la base productiva que se conserva es
`2dc2079`.

| Funcion historica | Responsabilidad | Equivalente actual | Accion |
|---|---|---|---|
| `obtenerServicioPrevio` | Encontrar el ultimo service compatible y sus datos asociados | El catalogo de `TrabajoSheet` mezcla historial, catalogo y defaults, pero no conserva la orden fuente ni valida identidad exacta | Adaptar mediante `buscarServicioAnteriorCompatible`, exigiendo mismo scope de taller, mismo `bikeId`, orden anterior verificable y coincidencia exacta del servicio |
| `handleSelect` | Cargar horas, dificultad, materiales y proximo control del service elegido | `seleccionar` solo carga nombre, horas, dificultad y margen | Adaptar: mantener la carga actual y crear un preview read-only separado; no modificar la orden hasta confirmacion explicita |
| `aplicar` | Integrar tarea, materiales, totales y observaciones | Los handlers actuales guardan cada tipo de item y usan `calcularNuevoTotal` | Adaptar: generar IDs nuevos, reconstruir `_tareaId`, integrar en un unico patch, preservar aprobaciones existentes y recalcular con `calcularNuevoTotal` |
| `guardarProximoControl` | Construir el control y crear un recordatorio inmediato | `buildProximoControl` sigue vigente; la creacion de recordatorios fue diferida a otros flujos | Recuperar solo la construccion y guardado explicito del control. Descartar la creacion inmediata de recordatorios |
| `AccordionSection` | Mostrar jerarquia visual y estado de avance por pasos | La pantalla actual muestra tarjetas planas y conserva sheets independientes | Adaptar como wrapper visual local alrededor de las secciones actuales, sin reemplazar sheets ni navegacion global |
| `abrirSiguiente` | Avanzar secuencialmente sin perder el formulario | No existe un paso local; todas las secciones estan visibles | Adaptar con `TASK_MANAGER_STEPS`, validacion minima y acciones anterior/siguiente que no escriben ni limpian datos |

Partes historicas descartadas:

- Coincidencia por marca/modelo/cilindrada como identidad suficiente: se reemplaza por `bikeId` exacto.
- IDs derivados del nombre de la tarea: se reemplazan por IDs nuevos y estables de recuperacion.
- Escritura inmediata en `recordatorios`: no corresponde a la arquitectura actual.
- Copia de pagos, cierre, PDF, autorizaciones, fechas y total historico: queda expresamente excluida.
- Reemplazo monolitico del editor actual: se conservan sheets, aprobacion por item, catalogo, telemetria, `coleccion` y `onBack`.

## Puerta antes de implementación

No modificar `TaskManagerView.jsx` ni crear tests hasta aprobar este mapa o confirmar que la autorización inicial de FASE R1 incluye explícitamente su ejecución después de esta presentación.
