# Fase 4 — Checklist de integridad

## Prueba mínima

1. Crear cliente.
2. Crear moto.
3. Crear OT.
4. Crear presupuesto.
5. Convertir presupuesto a OT.
6. Exportar backup local.
7. Verificar JSON:
   - v = 3
   - schema = motogestion-backup
   - integrity existe
   - counts existe
   - data tiene 12 colecciones
8. Crear backup cloud.
9. Restaurar backup cloud.
10. Verificar Firestore:
    - users/{uid}/restoreState/current.status = completed
    - users/{uid}/counters/trabajos.ultimo >= último número OT
    - users/{uid}/counters/presupuestos.ultimo >= último número PRE
11. Ejecutar integridad desde caché (en consola del navegador):
    ```js
    import("/src/lib/integrityTest.js").then(m => m.logIntegrityCheckFromCache())
    ```
12. Confirmar:
    - errors vacío
    - warnings revisados

## Prueba de backup viejo

Importar un backup con:
- ordenes
- serviciosCatalogo

Resultado esperado:
- ordenes se importa como trabajos
- serviciosCatalogo se importa como catalogoTareas

## Prueba de backup inválido

Crear JSON inválido o sin estructura data válida.

Resultado esperado:
- No se borra nada.
- No se restaura nada.
- Se informa error.

## Prueba de referencias rotas

Crear backup con un trabajo cuyo clientId no exista.

Resultado esperado:
- No bloquea la restauración.
- Aparece warning en el reporte.

## Prueba de duplicados

Crear backup con dos trabajos con mismo numeroTrabajo.

Resultado esperado:
- Aparece warning de número duplicado.
- La restauración procede igual.

## Prueba de contadores

Si el backup tiene:
- OT-000010
- PRE-000007

Después de restaurar:
- users/{uid}/counters/trabajos.ultimo = 10
- users/{uid}/counters/presupuestos.ultimo = 7

La próxima OT debe ser OT-000011.
El próximo presupuesto debe ser PRE-000008.

## Criterios de aceptación

Fase 4 queda aprobada si:

1. Export local genera backup v3.
2. Import local valida antes de importar.
3. Restore cloud valida antes de borrar.
4. Restore cloud crea backup de seguridad previo.
5. Restore cloud usa writeBatch en bloques de 400 ops.
6. Restore cloud registra restoreState/current.
7. Restore cloud reconstruye contadores OT/PRE.
8. Existe helper de integridad manual (integrityTest.js).
9. No se modificó UI.
10. No se rompió Vercel build.
11. Deploy en success.
12. App sigue creando OT/PRE correctamente.
