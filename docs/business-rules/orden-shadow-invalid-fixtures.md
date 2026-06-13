# Orden shadow invalid fixtures

## recienIngresada

- Por que es invalido: faltan referencias validas de cliente y moto, aunque la ausencia de `garantiaFinal` no lo invalida en etapa de ingreso.
- Campo faltante: `clientId`, `bikeId`.
- Alias legacy reconocidos: `estado` / `status` para identificar el borrador; no hubo alias validos para cliente ni moto.
- Situacion: borrador recien ingresado.
- Datos legacy reales incompletos: si, el snapshot no alcanza para validacion de ingreso completa.
- Debe corregirse: si, solo si aparecen referencias validas al normalizar legacy.
- Debe descartarse: no, porque sigue siendo un caso util para auditar ingreso incompleto.
- Revela regla de migracion: si; la garantia final no pertenece a la etapa de ingreso.
- Regla aprobada: al ingresar solo se exige cliente, moto y motivo de ingreso.

## legacyIncompleta

- Por que es invalido: falta referencia de cliente y moto.
- Campo faltante: `clientId`, `bikeId`.
- Situacion: legacy incompleto, pero con informacion parcial util.
- Datos legacy reales incompletos: si, puede representar un documento historico real.
- Debe corregirse: si la migracion puede reconstruir esas referencias.
- Debe descartarse: no, porque puede servir como alerta de datos rotos.
- Revela regla de migracion: si, puede requerir saneamiento o backfill.

## referenciasFaltantes

- Por que es invalido: falta la referencia de moto.
- Campo faltante: `bikeId`.
- Situacion: orden historica con referencia incompleta.
- Datos legacy reales incompletos: si, puede ocurrir en datos viejos.
- Debe corregirse: si existe fuente para recomponer la moto.
- Debe descartarse: no, si se quiere medir el riesgo de migracion.
- Revela regla de migracion: si, puede exigir validacion previa a publicacion.
