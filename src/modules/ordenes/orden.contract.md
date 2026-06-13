# Contrato de Ordenes

Coleccion actual: `trabajos`

Campos base usados por UI y backend:
- `id`
- `clientId`
- `bikeId`
- `estado`
- `numeroTrabajo`
- `tareas`
- `repuestos`
- `fletes`
- `insumos`
- `pagos`
- `total`
- `cierreTipo`
- `cierreRechazo`
- `proximoControl`
- `updatedAt`

Estados canonicos nuevos reconocidos por contrato:

- `ESPERANDO_APROBACION_ADICIONAL`
- `BLOQUEADA_POR_LIMITE_PRESUPUESTARIO`

Estos estados se reconocen en validacion y documentacion, pero todavia no se escriben en datos vivos.

Etapas contextuales de validacion:

- `INGRESO`
- `PRESUPUESTO`
- `EJECUCION`
- `CIERRE_DOCUMENTAL`

Regla operativa:
- No cambiar nombres de campo ni estado en esta fase.
