# Directiva: onboard-profile-bootstrap (HF-OB-1)

## ID y Estado
onboard-profile-bootstrap — IMPLEMENTADO (aprobado 2026-06-29, pendiente commit/deploy)

## Origen
Hallazgo HF-OB-1 de ONBOARD-001 (RC-2 Growth, 2026-06-29).

## Estado actual de la zona a modificar

Archivo: `src/App.jsx` (Baseline de Oro — boot flow + acceso SaaS).

Bloque afectado: el callback de `onAuthStateChanged` (aprox. líneas 371-403).

Comportamiento hoy, en orden:
1. `await ensureAccountProfile()` dentro de `try/catch`. Si lanza (ej. red caída
   en el primer login de un usuario nuevo), el error se traga con `console.error`
   y la ejecución continúa.
2. Se monta `onSnapshot` sobre `usuarios/{uid}`.
3. Si el doc no existe (porque el paso 1 falló y nunca lo creó) y el snap no viene
   de cache: `setEstado("loading")`.

Resultado del borde de falla: el usuario nuevo queda en la pantalla
"Verificando tu acceso..." de forma **permanente**, sin reintento, sin mensaje
de error y sin acción posible. Solo se recupera recargando manualmente y solo si
la red ya volvió.

El camino feliz (red OK) funciona correctamente: el doc se crea awaiteado antes
del snapshot y el usuario entra en estado trial.

## Criterio de éxito

1. Si `ensureAccountProfile()` falla en el primer login, la app **no** queda
   atascada en "loading" indefinidamente.
2. Aparece un estado de error recuperable con un botón "Reintentar" que vuelve a
   ejecutar el bootstrap de perfil sin necesidad de recargar ni reloguear.
3. El usuario **existente** (que ya tiene doc en `usuarios/{uid}`) NO se ve
   afectado por una falla transitoria de red: el `onSnapshot` desde cache lo deja
   entrar igual. El estado de error solo aplica cuando no hay perfil disponible.
4. Cero cambios en la lógica de `resolveAccountAccess` ni en los estados
   `ok | lectura | bloqueado | login | loading` existentes.

## Diseño propuesto (aditivo, cirugía mínima)

- Agregar un estado nuevo `"error_perfil"` (no se reemplaza ninguno).
- Extraer el bootstrap (`ensureAccountProfile` + montaje del snapshot) a una
  función reintetable dentro del `useEffect`, o agregar un contador de reintentos.
- Si `ensureAccountProfile()` lanza: reintentar 1 vez con un pequeño backoff. Si
  vuelve a fallar y no hay doc, `setEstado("error_perfil")`.
- Renderizar para `estado === "error_perfil"` una pantalla mínima con el patrón
  visual existente (fondo `#0b0b0b`, mensaje, botón naranja "Reintentar" que
  re-dispara el bootstrap, y opción "Cerrar sesión").
- Si durante el estado de error el `onSnapshot` (o un reintento) finalmente
  entrega el doc, se aplica `applyAccountData` normal y se sale del error.

## Regla de seguridad (qué NO se toca)

- `resolveAccountAccess` y `normalizeSaasUser` en `saasService.js`: intactos.
- `ensureSaasUserProfile`: intacto (no se cambia la creación del perfil ni el
  trial de 14 días).
- La rama de usuario existente en `ensureSaasUserProfile`: intacta.
- Las rutas públicas (`/verificar`, `/oferta`, `/taller`, `/login`): intactas.
- No se modifica la lógica de pago, webhook ni los campos de suscripción.

## Plan de implementación

1. `/respaldo` — backup del Baseline antes de tocar `App.jsx`.
2. Editar solo el `useEffect` de `onAuthStateChanged` + agregar el render del
   estado `"error_perfil"`.
3. `npm run build` — sin errores.
4. `npm run lint` — sin errores nuevos.
5. `git diff` — confirmar que solo cambió `App.jsx` (+ esta directiva).
6. Commit, push, deploy, verificar `version.json`.

## Historial de cambios
| Fecha | Commit | Cambio |
|-------|--------|--------|
| 2026-06-29 | (pendiente) | Creación de la directiva (propuesta) |
| 2026-06-29 | (pendiente commit) | Implementado en App.jsx: reintento x1 + estado `error_perfil` recuperable. Build OK, lint 0 nuevos, camino feliz verificado en preview (boot a LoginScreen sin loading infinito). |
