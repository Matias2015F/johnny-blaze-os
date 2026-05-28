# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Propósito

PWA de gestión operativa para taller mecánico de motos (MotoGestión). Usuario real: mecánico con manos sucias, celular, apuro. Velocidad de uso y ergonomía táctil importan más que la perfección arquitectural.

---

## Comandos

```bash
npm run dev       # servidor local (Vite)
npm run build     # build de producción
npm run lint      # ESLint sobre src/
```

Deploy: `npx vercel --prod --scope matias2015fs-projects` (auto-aliasa a `app.motogestion.ar` por webhook de GitHub).

---

## Stack

| Capa | Tecnología |
|---|---|
| UI | React 18 + Vite 5 + Tailwind CSS v3 + lucide-react |
| Auth / DB | Firebase Auth + Firestore (`users/{uid}/{col}`) |
| Serverless | Vercel API routes (`api/`) — CommonJS, no ESM |
| Pagos | MercadoPago (preferencias + webhooks HMAC-SHA256) |
| Email | Resend via `api/_email.js` |
| Push | Web Push / VAPID |
| Deploy | Vercel Hobby — https://app.motogestion.ar |
| Repo | github.com/Matias2015F/johnny-blaze-os (rama `main`) |

---

## Arquitectura de la app

### Flujo de boot (`App.jsx`)

1. `onAuthStateChanged` → determina si hay usuario
2. Lee `admin_settings/global` (precios, planes, trial days) via `leerAdminSettings()`
3. Lee el doc del usuario en `usuarios/{uid}` con `onSnapshot` — campos: `estado`, `plan`, `activoHasta`, `graceEndsAt`
4. `resolveAccountAccess(account)` decide: `acceso: true | "lectura" | false`
5. Según acceso muestra: `TallerPanel` (activo/trial), `TallerPanel` en modo lectura (gracia/vencido), o `LoginScreen`
6. Rutas públicas (`/verificar/:token`, `/taller/:uid`) se resuelven antes del auth check

### Ruteo sin React Router (`TallerPanel.jsx`)

Estado `view` string + `setView(string)`. Para agregar una vista:
1. Crear componente en `src/views/`
2. Agregar `{view === "nombreVista" && <Componente ... />}` en `TallerPanel.jsx`
3. Agregar navegación desde donde corresponda

### Persistencia (`src/lib/storage.js`)

`LS` es el único punto de escritura de datos desde el frontend. Nunca escribir directamente a Firestore desde views o components.

```js
LS.addDoc(col, data)        // crea doc con id generado
LS.setDoc(col, id, data)    // crea o reemplaza
LS.updateDoc(col, id, patch) // merge parcial
LS.deleteDoc(col, id)
LS.getDoc(col, id)          // lectura sincrónica del cache
LS.getAll(col)              // lectura sincrónica del cache
useCollection(col)          // hook reactivo — suscribe a onSnapshot
```

`LS` escribe optimistamente al cache en memoria, luego sincroniza a Firestore con 3 reintentos. Expone `getSyncStatus()` / `onSyncStatus(fn)` para mostrar el estado de sync.

Colecciones válidas: ver `DATA_COLS` en `storage.js`.

### Counters (`src/services/counterService.js`)

`nextNumeroOT()` y `nextNumeroPRE()` usan transacciones Firestore en `users/{uid}/counters/{col}` para garantizar secuencialidad. Nunca calcular el próximo número manualmente.

### SaaS / suscripciones (`src/services/saasService.js`)

- `DEFAULT_SAAS_ADMIN_SETTINGS.precios`: base=125000, pro=300000, full=900000 ARS
- `PLAN_BILLING_DAYS`: base=30, pro=90, full=365 días
- Las claves internas (`base`, `pro`, `full`) **nunca se renombran** — están guardadas en Firestore en docs de usuarios
- Labels visibles: Mensual / Trimestral / Anual
- `normalizeAdminSettings(raw)` → objeto canónico con `plans.{base,pro,full}.{label, price, billingDays, active}`
- `normalizeSaasUser(raw)` → objeto canónico con `estado`, `plan`, `activoHasta`, etc.
- `resolveSaasAccess(usuario)` → `{ acceso, motivo }` — fuente de verdad del acceso

---

## Modelo de datos (Firestore)

### Colecciones de usuario (`users/{uid}/{col}`)

| Colección | Campos principales |
|---|---|
| `clientes` | nombre, tel, whatsapp, etiquetas, activo |
| `motos` | patente, marca, modelo, cilindrada, km, kilometrajeActual, clienteId |
| `trabajos` | numeroTrabajo (OT-000001), clientId, bikeId, estado, kmIngreso, total, pagos[], tareas[], repuestos[], insumos[], fletes[], proximoControl{} |
| `presupuestos` | numeroPresupuesto (PRE-000001), clientId, bikeId, estado, tareas[], total |
| `recordatorios` | trabajoId, clienteId, motoId, tipo, estado, kmObjetivo, kmAviso, unidad |
| `caja` | fecha, tipo, concepto, monto, metodo |
| `config/global` | CONFIG_DEFAULT + whatsappPlantillas |
| `counters/{col}` | ultimo: number — contador de OTs y PREs |
| `billingInvoices/{id}` | historial de pagos del usuario |

### Colecciones globales (raíz)

| Colección | Uso |
|---|---|
| `usuarios/{uid}` | perfil SaaS: estado, plan, activoHasta, graceEndsAt |
| `admin_settings/global` | precios, duracionTrialDias, graceDaysDefault |
| `publicReceipts/{token}` | comprobantes verificables públicos (read: true) |
| `publicReceiptSecrets/{token}` | hash de teléfono para verificación (privado) |
| `publicWorkshops/{uid}` | perfil público del taller |
| `billingEvents` | log de pagos para reconciliación admin |
| `soporteTickets` | tickets de soporte |

---

## API routes (Vercel serverless — CommonJS)

**Límite crítico:** Vercel Hobby permite exactamente **12 funciones serverless**. Los archivos que empiezan con `_` no cuentan. Antes de crear un archivo nuevo en `api/`, contar los existentes sin `_`.

**Patrón de consolidación:** cuando se necesita un endpoint adicional, agregarlo como `?mode=` en una función existente y añadir el rewrite en `vercel.json`. Funciones concentradoras actuales:

| URL pública | Función real | Modos disponibles |
|---|---|---|
| `/api/send-password-reset` | `send-welcome.js` | `password-reset` |
| `/api/mp-diagnose` | `mp-create-preference.js` | `diagnose` |
| `/api/push-subscribe` | `push-send-recordatorios.js` | `subscribe` |
| `/api/public-prices` | `verify-document.js` | `public-prices` |
| `/api/public-workshops` | `verify-document.js` | `public-workshops` |
| `/api/publish-workshop` | `verify-document.js` | `publish-workshop` |
| `/api/lead` | `verify-document.js` | `lead` |

**Autenticación:** todas las rutas usan `verifyIdToken(req)` de `_firebase-admin.js`, excepto:
- `mp-webhook.js` — verificación HMAC-SHA256 (`MP_WEBHOOK_SECRET`)
- Los modos públicos de `verify-document.js` — sin auth

**Helpers (no son funciones serverless):**
- `_firebase-admin.js` — Admin SDK + `verifyIdToken`
- `_email.js` — `sendEmail` via Resend, templates transaccionales
- `_ratelimit.js` — sliding window por IP, usar `applyRateLimit(req, res, "nombre")`

---

## Capa de copy (`src/copy/`)

Strings de UI centralizados por dominio: `auth.js`, `common.js`, `documents.js`, `history.js`, `logistics.js`, `orders.js`, `payments.js`, `settings.js`. Usar estos objetos en lugar de strings inline para facilitar cambios globales.

---

## Comprobantes verificables

- `src/services/receiptService.js` — `crearPublicReceipt()` escribe en `publicReceipts/{token}` y `publicReceiptSecrets/{token}` en un batch. Usa el cliente JS SDK (no Admin).
- `src/services/receiptVerificationService.js` — re-export barrel de receiptService.
- `src/views/VerifyReceiptView.jsx` — vista pública `/verificar/:token`, flujo de validación con checkboxes + calificación.
- Formato token: `"r" + UUID sin guiones`

---

## Patrones de UI

- Fondo: `bg-[#0A0A0A]` / `zinc-950` / `zinc-900`
- Acento: `orange-600` (#ea580c)
- Labels: `text-[10px] font-black uppercase tracking-widest`
- Cards: `rounded-[2rem] border border-zinc-800 bg-zinc-900 p-4`
- Bottom sheets: `fixed inset-0 z-50 flex items-end`
- Botón primario: `rounded-2xl bg-orange-600 py-4 text-[11px] font-black uppercase tracking-widest text-white active:scale-95 transition-all`

Ver `COOKBOOK.md` para patrones detallados.

---

## Seguridad — restricciones activas

- Firestore rules: `noModificaCamposSuscripcion()` bloquea autopromociones de plan desde el cliente
- `ensureSaasUserProfile` solo puede escribir: `email`, `lastSeenAt`, `updatedAt`, `nombreTaller`, `appVersion`
- Webhook MP: HMAC-SHA256 + timestamp freshness (5 min) + HMAC failure tracker por IP
- Admin uid: `TNwwuKJsIXN29zJg8HWfORawdFm1`
- Firebase Admin SDK se inicializa con `FIREBASE_SERVICE_ACCOUNT_B64` (JSON base64)

---

## Variables de entorno requeridas (Vercel)

`FIREBASE_SERVICE_ACCOUNT_B64`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET`, `RESEND_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET`

---

## Lo que NO existe en este proyecto

- React Router, Redux, Context API, GraphQL
- Testing automatizado
- Múltiples técnicos / roles por usuario
- ESM en `api/` — todo es CommonJS (`require`/`module.exports`)

> **Reglas de cambio seguro, strings en uso y zonas protegidas: ver [DIRECTIVES.md](DIRECTIVES.md)**
