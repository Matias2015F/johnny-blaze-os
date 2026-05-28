## ID y Estado
mp-webhook — Estable (no tocar sin diagnóstico completo de pago)

## Objetivo principal
Recibir notificaciones de pago de MercadoPago, verificar HMAC-SHA256,
y activar/renovar la suscripción del usuario en Firestore.

## Criterios de éxito
- [ ] Rechaza requests sin firma HMAC válida
- [ ] Rechaza notificaciones con timestamp > 5 minutos
- [ ] Activa `estado: "activo"` en `usuarios/{uid}` al recibir pago aprobado
- [ ] Escribe en `billingEvents` para auditoría
- [ ] Responde 200 a MP inmediatamente (< 500ms) para evitar reintentos

## Entradas / Salidas
- Input: webhook POST de MercadoPago con header `x-signature`
- Output: HTTP 200 (siempre, para no causar reintentos de MP)

## Flujo lógico
1. Verificar HMAC-SHA256 con `MP_WEBHOOK_SECRET`
2. Verificar freshness del timestamp (máx 5 minutos)
3. Si type !== "payment", responder 200 y salir
4. Fetch del pago real a MP API con payment_id
5. Extraer `external_reference` (= uid del usuario)
6. Si `status === "approved"`: calcular `activoHasta` según plan, escribir a Firestore
7. Escribir a `billingEvents` para auditoría
8. Responder 200

## Dependencias y zonas protegidas
- `MP_WEBHOOK_SECRET` env var — NUNCA loggear
- `external_reference` = uid (viene de mp-create-preference)
- Campos que escribe: `estado`, `plan`, `activoHasta`, `graceEndsAt` en `usuarios/{uid}`
- Estos campos están protegidos en Firestore rules por `noModificaCamposSuscripcion()`

## Historial de cambios
| Fecha | Commit | Cambio |
|-------|--------|--------|
| — | inicial | Funcionando. No modificar sin necesidad documentada. |
