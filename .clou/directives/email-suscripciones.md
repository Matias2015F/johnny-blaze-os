## ID y Estado
email-suscripciones — Estable (validado 2026-05-29)

## Objetivo principal
Enviar emails transaccionales relacionados a suscripciones: bienvenida al
registrarse y reset de contraseña.

## Flujo: email de bienvenida (api/send-welcome.js — modo default)
- POST /api/send-welcome — requiere auth Bearer
- Rate limit: 5/1h (key "send-welcome")
- **Idempotente**: si `usuarios/{uid}.welcomeEmailSentAt` existe → responde 200 sin reenviar
- Lee `usuarios/{uid}` para obtener `emailNotificacion || email` y `activoHasta/trialEndsAt`
- Envía via `templateBienvenida({ email, diasTrial, trialHasta })`
- Si ok, escribe `welcomeEmailSentAt: Date.now()` en `usuarios/{uid}`
- Si el uid no existe en Firestore → responde 200 silencioso (no expone estado)

## Flujo: reset de contraseña (api/send-welcome.js?mode=password-reset)
- POST /api/send-welcome?mode=password-reset — SIN auth (endpoint público)
- Rate limit: 5/15min (key "send-password-reset")
- Valida que `body.email` tenga formato `@`
- Genera link via `adminAuth.generatePasswordResetLink(email, { url: "https://app.motogestion.ar" })`
- Envía via `buildResetEmail({ email, link })`
- Si `auth/user-not-found` → responde 200 igualmente (no expone si el email existe)

## Dependencias y zonas protegidas
- `api/_email.js` → `sendEmail`, `templateBienvenida`, `buildResetEmail` — no cambiar firmas
- `api/_firebase-admin.js` → `getAuth()` para generar reset links
- Campo `welcomeEmailSentAt` en `usuarios/{uid}` — es el guardia de idempotencia; no eliminarlo
- `usuarios/{uid}.emailNotificacion` tiene prioridad sobre `.email` para destino

## Invariantes que no deben romperse
1. El endpoint de password-reset nunca confirma ni deniega si un email existe.
2. El email de bienvenida solo se envía una vez por uid (idempotencia por campo Firestore).
3. El modo password-reset no requiere auth — es intencional; tiene rate limit como protección.

## Historial de cambios
| Fecha | Commit | Cambio |
|---|---|---|
| — | inicial | Estable. |
