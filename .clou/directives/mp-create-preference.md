## ID y Estado
mp-create-preference — Estable (validado 2026-05-29)

## Objetivo principal
Crear una preferencia de pago en MercadoPago y devolver `preferenceId` + `url`
al cliente para iniciar el checkout.

## Criterios de éxito
- [ ] MP responde 201 con `id` y `init_point` sin errores
- [ ] `back_urls` pasan validación de MP (dominio registrado, sin query params)
- [ ] El usuario es redirigido a la app tras el pago con `collection_status`
- [ ] Los precios vienen de Firestore `admin_settings/global`, con fallback al código

## Entradas / Salidas
- Input: `{ plan: "base" | "pro" | "full" }` en el body POST
- Auth: Bearer token Firebase del usuario (uid en el token)
- Output éxito: `{ preferenceId: string, url: string }`
- Output error: `{ error: string, mpBody?: object }`

## Flujo lógico
1. Verificar method === POST
2. Rate limit: `applyRateLimit(req, res, "mp-create-preference")`
3. Verificar token Firebase → extraer `uid`
4. Validar que `plan` es "base", "pro" o "full"
5. Verificar `MP_ACCESS_TOKEN` en env
6. Leer precios de Firestore `admin_settings/global` (fallback a PLANES_FALLBACK)
7. Construir payload MP con `items`, `external_reference: uid`, `back_urls`
8. POST a `https://api.mercadopago.com/checkout/preferences`
9. Devolver `{ preferenceId, url }` o `{ error, mpBody }`

## Dependencias y zonas protegidas
- `src/views/ConfigView.jsx` consume `preferenceId` y `url` de la respuesta
- `BASE_URL` debe ser el dominio registrado en la cuenta MP (actualmente bajo diagnóstico)
- `external_reference` = uid del usuario (el webhook lo usa para activar suscripción)
- Claves de plan `"base"/"pro"/"full"` NO cambiar — están en Firestore
- `notification_url` fue removida temporalmente para diagnóstico (2026-05-28)

## Solución aplicada a back_urls (cerrado 2026-05-29)
- Problema original: MP 400 back_urls invalid — causado por URLs sin scheme o con formato incorrecto
- Solución: función `normalizePublicBaseUrl()` fuerza https://, elimina trailing slashes, valida formato
- Fallback: `getBaseUrlFromRequest(req)` usa el host del request cuando `PUBLIC_APP_URL` no está configurado
- Hardcode final: `"https://app.motogestion.ar"` como último fallback
- Resultado: back_urls siempre son `https://app.motogestion.ar/` — validadas por MP

## Historial de cambios
| Fecha | Commit | Cambio |
|-------|--------|--------|
| 2026-05-27 | 36a93eb | BASE_URL hardcodeado a johnny-blaze-os.vercel.app — funcionaba |
| 2026-05-27 | 205ca5f | Cambio a env var PUBLIC_APP_URL — primer punto de falla |
| 2026-05-27 | 4bf0433 | Mostrar detalle de error MP en respuesta |
| 2026-05-28 | 7183765 | Remover notification_url + log + mpBody en error |
