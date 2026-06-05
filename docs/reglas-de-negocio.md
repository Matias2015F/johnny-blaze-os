# Reglas de Negocio - MotoGestion

## Reglas generales

- No se puede crear pago Mercado Pago sin usuario autenticado.
- Todo pago debe incluir `uid`, `externalReference` y `metadata.uid`.
- No se puede publicar un taller en la red si `publicProfile.enabled` es false.
- La landing solo puede mostrar datos publicos.
- Un comprobante publico no puede exponer telefono completo, DNI, direccion privada, notas internas ni costos internos.

## Ordenes

- Una orden nace con cliente y moto asociados.
- Una orden puede avanzar, pero no deberia retroceder sin auditoria.
- Una orden cerrada con comprobante emitido no debe permitir cambios que alteren el comprobante.
- Si el cliente rechaza presupuesto, se emite constancia de diagnostico/presupuesto cerrado.

## Presupuestos

- El presupuesto debe tener total claro y estado claro.
- Aprobar presupuesto habilita reparacion.
- Rechazar presupuesto no debe crear una reparacion falsa.

## Comprobantes

- Cada comprobante emitido debe tener `receiptToken`.
- El link publico debe apuntar a `/verificar/{token}`.
- El QR es canal secundario, no la unica forma de calificar.
- El bloque de pago debe mostrar `saldoPendiente` y `estado`, no textos ambiguos.

## Ratings y reputacion

- El taller no puede crear calificaciones manualmente.
- Una calificacion debe estar asociada a un comprobante real.
- Una calificacion no debe poder editarse desde el taller.
- Solo ratings aprobados/validados suman reputacion publica.
- La reputacion publica debe salir de `workshopReputation`, no de `users/{uid}`.

## Beneficios y fidelizacion

- El descuento por calificar debe estar configurado por el taller.
- El beneficio debe quedar asociado a cliente/moto para la proxima visita.
- El presupuesto futuro debe mostrar si se aplico descuento de fidelizacion.
- El beneficio no debe aplicarse dos veces al mismo trabajo.

## Mapa publico

- El pin publico solo se muestra si el taller habilito perfil publico y ubicacion.
- El mapa usa coordenadas guardadas y bloqueadas por el taller.
- El boton "Como llegar" debe abrir Google Maps con lat/lng.
