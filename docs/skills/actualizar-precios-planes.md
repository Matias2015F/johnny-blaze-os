# SOP — Actualizar Precios y Planes (MotoGestion)

Ultima actualizacion: 2026-05-27

## Objetivo
Actualizar importes y textos visibles de planes (Mensual / Trimestral / Anual) sin romper suscripciones ya activas.

## Regla principal: NO cambiar claves internas
Las claves internas `base`, `pro` y `full` ya viven en Firestore dentro de los documentos de cada usuario y en registros de cobros.

Si se cambian a `mensual` / `trimestral` / `anual` se rompe el acceso de talleres que ya pagaron (porque el sistema deja de reconocer el plan contratado).

Lo que SI se cambia:
- montos (precios)
- labels visibles (nombres y periodos)
- textos mostrados en UI y en Mercado Pago

## Orden de implementacion (5 archivos, 5 commits)
Implementar en el orden exacto y con 1 commit por paso.

### 1) `src/services/saasService.js`
- Actualizar precios fallback:
  - antes: 5k / 12k / 45k
  - ahora: 125k / 300k / 900k
- Actualizar labels visibles:
  - "Plan Base" -> "Mensual"
  - "Plan Pro"  -> "Trimestral"
  - "Plan Full" -> "Anual"
- Activar el plan `full` si estaba `active: false`.

Commit sugerido:
`feat: actualizar precios y labels fallback de planes`

### 2) `api/mp-create-preference.js`
- Replicar los mismos precios fallback en la API.
- Corregir el titulo del item que llega a Mercado Pago:
  - antes: "Johnny Blaze OS - Plan Base"
  - ahora: "MotoGestion - Mensual" (y equivalentes segun plan)

Commit sugerido:
`fix: alinear MP preference con planes y marca MotoGestion`

### 3) `src/views/ConfigView.jsx`
- Reemplazar strings hardcodeados (nombres de plan) por labels dinamicos del settings (o del modelo central).
- Se identificaron 6 strings.

Commit sugerido:
`refactor: eliminar labels hardcodeados de planes en ConfigView`

### 4) `src/services/adminValidationService.js`
- Ajustar el mensaje de error del validador para que sea coherente con los nuevos labels/periodos.

Commit sugerido:
`chore: alinear mensajes del validador con planes`

### 5) Landing (`index.html` del proyecto de landing)
- Actualizar importes visibles.
- Corregir periodo del plan trimestral (30 -> 90 dias).
- Agregar el card del plan Anual.
- Actualizar JSON-LD (SEO) para que coincida con el contenido.

Commit sugerido (repo landing):
`refactor: actualizar precios/planes en landing + JSON-LD`

## Paso final (manual, obligatorio)
Actualizar Firestore con los valores nuevos desde panel admin o consola, porque el codigo lee DB primero antes del fallback.

Nota:
- Si Firestore ya tiene valores viejos, el usuario vera los viejos aunque el fallback se haya actualizado.
- El fallback es solo "respaldo" y no debe ser la fuente principal en produccion.

