## ID y Estado
cancel-plan — Estable (validado 2026-05-29)

## Objetivo principal
Gestionar la cancelación de plan con encuesta de salida, oferta de retención con
descuento del 30% vigente 72 hs, y ticket de soporte automático para visibilidad
del admin.

## Flujo completo

### 1. Usuario solicita cancelar (api/cancel-plan.js)
- POST /api/cancel-plan — requiere auth Bearer + rate limit
- Escribe en `usuarios/{uid}`: `cancelAtPeriodEnd: true`, `requestedAction: "cancel_plan"`, `cancellationFeedback: { reasonCode, reasonText, comment }`
- Crea doc en `usuarios/{uid}/retentionOffers/{token}`: `{ token, uid, planKey, discountPct:30, expiresAt: +72h, used:false }`
- Crea ticket en `soporteTickets` (best-effort, no bloquea respuesta)
- Envía email via `templateCancelPlanOffer` con `verifyUrl = https://app.motogestion.ar/oferta/{token}` (best-effort, no bloquea)
- Responde `{ ok: true, offerToken }`

### 2. Usuario consulta oferta (api/retention-offer.js)
- POST /api/retention-offer — requiere auth Bearer
- Lee `usuarios/{uid}/retentionOffers/{token}`
- Valida: uid match, `used === false`, `expiresAt > Date.now()`
- Responde `{ ok: true, planKey, discountPct, expiresAt }`

### 3. Usuario acepta oferta (api/mp-create-preference.js?mode=retention)
- Incluye `offerToken` en body junto con `plan`
- Valida oferta server-side: uid, not used, not expired, planKey match
- Aplica descuento: `unitPrice = Math.round(unitPrice * (1 - pct/100))`
- Flujo MP normal a partir de ahí → webhook activa suscripción

### 4. UI (src/views/RetentionOfferView.jsx)
- Accesible en `/oferta/:token`
- LoginScreen redirige a esta ruta post-login si hay `?oferta=` en URL

## Colecciones Firestore involucradas
- `usuarios/{uid}` — campos: `cancelAtPeriodEnd`, `requestedAction`, `cancellationFeedback`
- `usuarios/{uid}/retentionOffers/{token}` — oferta de descuento, una por cancelación
- `soporteTickets` — visibilidad admin (best-effort)

## Dependencias y zonas protegidas
- `api/_email.js` → `templateCancelPlanOffer` — no cambiar firma del template
- `api/mp-create-preference.js` — modo `retention` lee `retentionOffers`; cambiar validación rompe el descuento
- `src/views/RetentionOfferView.jsx` — no modificar sin entender que el token viene por URL + login redirect
- `src/LoginScreen.jsx` — tiene el redirect post-login a `/oferta/:oferta`; no eliminar sin revisar este flujo
- Los campos `cancelAtPeriodEnd` y `requestedAction` en `usuarios/{uid}` NO están en `noModificaCamposSuscripcion()` — son campos complementarios, no de acceso

## Invariantes que no deben romperse
1. El email de cancelación es best-effort: la cancelación debe procesarse aunque el email falle.
2. El token de oferta es único por operación (UUID). No reutilizar.
3. La oferta vence en exactamente 72 hs desde la creación.
4. Descuento máximo clampado al 90% en mp-create-preference (Math.min(90, ...)).

## Historial de cambios
| Fecha | Commit | Cambio |
|---|---|---|
| 2026-05-29 | 82ad841 | Creación: cancelación con encuesta + oferta de retención |
| 2026-05-29 | 65d739c | Fix: proteger contrato de planes trimestral y anual |
