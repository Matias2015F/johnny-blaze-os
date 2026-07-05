## ID y Estado
saas-access — Estable

## Objetivo principal
Determinar si un usuario puede acceder a la app, en qué modo (completo / lectura),
y mostrar el estado correcto de suscripción en la UI.

## Criterios de éxito
- [ ] Usuario con `estado: "activo"` y `activoHasta` futuro → acceso completo
- [ ] Usuario en período de gracia → acceso lectura, banner de renovación
- [ ] Usuario vencido → pantalla de pago, no acceso a datos
- [ ] Trial no expirado → acceso completo
- [ ] Los precios mostrados en UI coinciden con Firestore `admin_settings/global`

## Entradas / Salidas
- Input: `usuarios/{uid}` doc (Firestore onSnapshot)
- Input: `admin_settings/global` (leído en boot)
- Output: `{ acceso: true | "lectura" | false, motivo: string }`

## Flujo lógico
1. App.jsx boot: leer `admin_settings/global` via `leerAdminSettings()`
2. `onAuthStateChanged` → onSnapshot de `usuarios/{uid}`
3. `normalizeSaasUser(raw)` → objeto canónico
4. `resolveSaasAccess(usuario)` → `{ acceso, motivo }`
5. Renderizar `TallerPanel` (activo), `TallerPanel` modo lectura (gracia), o `LoginScreen`

## Dependencias y zonas protegidas
- `src/services/saasService.js` — `resolveSaasAccess`, `normalizeSaasUser`
- `src/services/saasService.js` — `DEFAULT_SAAS_ADMIN_SETTINGS.precios`
- Claves de plan: `base` / `pro` / `full` — NUNCA renombrar
- `estado` valores canónicos: `"activo"`, `"trial"`, `"vencido"`, `"gracia"`

## Dependencia de precios (Firestore)
`admin_settings/global.precios` debe tener:
- `base: 65000`
- `pro: 300000`
- `full: 900000`
Si está desactualizado, la app muestra precios incorrectos. Actualizar manualmente
en Firebase Console (no hay UI admin para esto aún).

## Historial de cambios
| Fecha | Commit | Cambio |
|-------|--------|--------|
| — | inicial | Estable. |
