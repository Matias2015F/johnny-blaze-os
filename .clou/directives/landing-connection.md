## ID y Estado
landing-connection — Estable (validado 2026-05-29)

## Objetivo principal
Conectar la app con la landing pública (motogestion.ar) a través de la API:
talleres públicos para el mapa, publicación de perfil, leads de nuevos talleres
y verificación de comprobantes.

## Endpoint: api/verify-document.js

Función multipropósito con CORS configurado para:
- `https://motogestion.ar`
- `https://www.motogestion.ar`
- `https://motogestion-landing-rose.vercel.app` (preview Vercel de la landing)
- `https://app.motogestion.ar`

### Modo GET (default) — verificar comprobante
- Verifica documento por `uid` + `ot` en query params
- Público, sin auth

### Modo GET ?mode=public-workshops — lista talleres para el mapa
- Sin auth — alimenta el mapa y ranking de la landing
- Rate limit: key "public-workshops"
- Cache: `public, max-age=300, s-maxage=300`
- Devuelve hasta 50 talleres con `publicProfileEnabled === true`
- Campos públicos: nombreTaller, ciudad, provincia, lat, lng, nivel, ratingAvg, ratingCount, recomiendaPct, trabajosDocumentados, garantiasRegistradas, comentariosRecientes (máx 3)
- Función `reputacion(totalOTs, mesesActivo)` calcula nivel: Nuevo → Registrado → En crecimiento → Activo → Verificado → Elite

### Modo POST ?mode=publish-workshop — publicar perfil del taller
- Requiere auth Bearer
- Escribe en `publicWorkshops/{uid}`

### Modo POST ?mode=lead — capturar lead de la landing
- Sin auth — formulario de contacto de motogestion.ar
- Rate limited
- Envía email a matias4604@gmail.com con los datos del lead

## Colecciones Firestore involucradas
- `publicWorkshops/{uid}` — perfiles públicos; campo `publicProfileEnabled` controla visibilidad
- `publicReceipts/{token}` — comprobantes verificables (modo default)

## Dependencias y zonas protegidas
- **CORS**: los orígenes permitidos están hardcodeados en `ALLOWED_ORIGINS`. Si la landing
  cambia de dominio o se agrega un preview, actualizar esa lista o la landing no podrá
  hacer fetch al API.
- `publicWorkshops` — los campos que devuelve son los que consume el mapa de la landing.
  Cambiar nombres de campos rompe el mapa sin tocar la landing.
- `reputacion()` — función que calcula el nivel del taller. Los umbrales (5/20/50/100/200 OTs)
  están sincronizados con la expectativa del usuario en la landing.
- No eliminar ni renombrar los modos `public-workshops`, `publish-workshop` ni `lead`
  sin actualizar la landing simultáneamente.

## Invariantes que no deben romperse
1. El modo `public-workshops` siempre es público (sin auth). La landing lo llama sin credenciales.
2. Los campos devueltos en `public-workshops` no deben incluir datos privados del taller
   (emails, teléfonos, uid no enmascarados).
3. El modo `lead` no requiere auth — es intencional. El formulario de la landing es público.
4. El CORS debe incluir el dominio de preview de Vercel de la landing mientras exista ese proyecto.

## Historial de cambios
| Fecha | Commit | Cambio |
|---|---|---|
| 2026-05-25 | 0b22a6d | Creación: publish-workshop + TallerPublicView |
| 2026-05-26 | 3501254 | Modo lead: captura de talleres interesados |
| 2026-05-27 | 413867a | Fix: evitar cache en precios públicos |
| 2026-05-27 | 8e20915 | Fix: variar CORS para precios públicos |
